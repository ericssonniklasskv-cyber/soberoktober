-- LOCAL TEST ONLY. Alternative to the daily winning workout; never deploy this preview SQL.
alter table private.vote_preview_completions add column if not exists kind text not null default 'workout';
alter table private.vote_preview_completions drop constraint if exists vote_preview_completions_points_check;
alter table private.vote_preview_completions drop constraint if exists vote_preview_completion_kind_points;
alter table private.vote_preview_completions add constraint vote_preview_completion_kind_points
 check((kind='workout' and points=3) or (kind='steps' and points=1));

create or replace function private.vote_preview_state(p_actor uuid,p_instant timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'now',p_instant,'today',timezone('Europe/Stockholm',p_instant)::date,
 'is_admin',coalesce((select is_admin from public.profiles where id=p_actor),false),
 'can_vote',coalesce((select competition_status='active' from public.profiles where id=p_actor),false),
 'simulated',(select test_now is not null from private.vote_preview_settings where singleton),
 'days',(select jsonb_agg(jsonb_build_object(
  'date',d.workout_date,'opens',private.vote_preview_opens(d.workout_date),
  'closes',d.workout_date::timestamp at time zone 'Europe/Stockholm',
  'completion',(select jsonb_build_object('completed_at',completed_at,'points',points,'kind',kind) from private.vote_preview_completions where user_id=p_actor and workout_date=d.workout_date),
  'own_vote',(select option_id from private.vote_preview_votes where user_id=p_actor and workout_date=d.workout_date),
  'options',(select jsonb_agg(jsonb_build_object('id',o.option_id,'title',o.task->>'label','description',o.task->>'description','votes',(select count(*) from private.vote_preview_votes v where v.workout_date=o.workout_date and v.option_id=o.option_id)) order by o.option_id) from private.vote_preview_options o where o.workout_date=d.workout_date),
  'result',(select to_jsonb(r)-'workout_date' from private.vote_preview_results r where r.workout_date=d.workout_date)
 ) order by d.workout_date) from (select distinct workout_date from private.vote_preview_options)d)
 );
$$;

create or replace function private.vote_preview_action(p_action text,p_date date,p_option integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; day date; actor_status text; existing_kind text; chosen_kind text;
begin
 if actor is null then raise exception 'Logga in för att rösta.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','vote','complete','uncomplete','steps','unsteps') then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
 perform 1 from private.vote_preview_settings where singleton for share;
 instant:=private.vote_preview_clock();
 select competition_status into actor_status from public.profiles where id=actor and nullif(btrim(display_name),'') is not null for share;
 if not found then raise exception 'Välj ett deltagarnamn först.' using errcode='42501'; end if;
 for day in select distinct workout_date from private.vote_preview_options where workout_date::timestamp at time zone 'Europe/Stockholm'<=instant order by workout_date loop
  perform private.vote_preview_settle(day,instant);
 end loop;
 if p_action='vote' then
  if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan rösta.' using errcode='42501'; end if;
  if p_date is null or not exists(select 1 from private.vote_preview_options where workout_date=p_date and option_id=p_option) then raise exception 'Välj ett av de fyra passen.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(260019,p_date-date '2026-01-01');
  -- Recheck after waiting for the poll lock; a request started before midnight
  -- must not insert a vote after the deadline.
  select coalesce(test_now,clock_timestamp()) into instant from private.vote_preview_settings where singleton;
  if instant<private.vote_preview_opens(p_date) or instant>=p_date::timestamp at time zone 'Europe/Stockholm'
   or exists(select 1 from private.vote_preview_results where workout_date=p_date) then
   raise exception 'Omröstningen är inte öppen. Du röstar dagen före passet.' using errcode='42501'; end if;
  begin
   insert into private.vote_preview_votes values(p_date,actor,p_option,instant);
  exception when unique_violation then raise exception 'Du har redan röstat för den här dagen. Rösten kan inte ändras.' using errcode='23505'; end;
 elsif p_action in ('complete','uncomplete','steps','unsteps') then
  perform pg_advisory_xact_lock(260019,coalesce(p_date,date '2026-01-01')-date '2026-01-01');
  select coalesce(test_now,clock_timestamp()) into instant from private.vote_preview_settings where singleton;
  if p_date is null or p_date<>timezone('Europe/Stockholm',instant)::date
     or not exists(select 1 from private.vote_preview_results where workout_date=p_date) then
   raise exception 'Du kan klarmarkera dagens pass först när omröstningen är avgjord.' using errcode='42501';
  end if;
  chosen_kind:=case when p_action in ('steps','unsteps') then 'steps' else 'workout' end;
  if p_action in ('complete','steps') then
   if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan klarmarkera pass.' using errcode='42501'; end if;
   select kind into existing_kind from private.vote_preview_completions where workout_date=p_date and user_id=actor;
   if existing_kind is not null and existing_kind<>chosen_kind then
    if existing_kind='steps' then raise exception 'Klicka ur 10 000 steg innan du klarmarkerar passet.' using errcode='42501';
    else raise exception 'Ångra klarmarkeringen innan du väljer 10 000 steg.' using errcode='42501'; end if;
   end if;
   insert into private.vote_preview_completions(workout_date,user_id,points,kind,completed_at)
   values(p_date,actor,case when chosen_kind='steps' then 1 else 3 end,chosen_kind,instant) on conflict do nothing;
  else
   delete from private.vote_preview_completions where workout_date=p_date and user_id=actor and kind=chosen_kind;
  end if;
 end if;
 return private.vote_preview_state(actor,instant);
end; $$;


create or replace function private.guard_vote_preview_daily_result() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'Den dagen gäller Dagens val. Registrera dagens pass eller 10 000 steg där.' using errcode='42501'; end; $$;
revoke all on function private.guard_vote_preview_daily_result() from public,anon,authenticated;
notify pgrst,'reload schema';
