-- LOCAL TEST ONLY. Uses the voting preview clock; never push this to production.
create table if not exists private.vote_preview_completions (
 workout_date date not null references private.vote_preview_results(workout_date),
 user_id uuid not null references auth.users(id) on delete cascade,
 points smallint not null default 3 check(points=3),
 completed_at timestamptz not null,
 primary key(workout_date,user_id)
);
create index if not exists vote_preview_completions_user_idx on private.vote_preview_completions(user_id);
alter table private.vote_preview_completions enable row level security;
revoke all on private.vote_preview_completions from public,anon,authenticated;

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
  'completion',(select jsonb_build_object('completed_at',completed_at,'points',points) from private.vote_preview_completions where user_id=p_actor and workout_date=d.workout_date),
  'own_vote',(select option_id from private.vote_preview_votes where user_id=p_actor and workout_date=d.workout_date),
  'options',(select jsonb_agg(jsonb_build_object('id',o.option_id,'title',o.task->>'label','description',o.task->>'description','votes',(select count(*) from private.vote_preview_votes v where v.workout_date=o.workout_date and v.option_id=o.option_id)) order by o.option_id) from private.vote_preview_options o where o.workout_date=d.workout_date),
  'result',(select to_jsonb(r)-'workout_date' from private.vote_preview_results r where r.workout_date=d.workout_date)
 ) order by d.workout_date) from (select distinct workout_date from private.vote_preview_options)d)
 );
$$;

create or replace function private.vote_preview_action(p_action text,p_date date,p_option integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; day date; actor_status text;
begin
 if actor is null then raise exception 'Logga in för att rösta.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','vote','complete','uncomplete') then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
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
 elsif p_action in ('complete','uncomplete') then
  perform pg_advisory_xact_lock(260019,coalesce(p_date,date '2026-01-01')-date '2026-01-01');
  select coalesce(test_now,clock_timestamp()) into instant from private.vote_preview_settings where singleton;
  if p_date is null or p_date<>timezone('Europe/Stockholm',instant)::date
     or not exists(select 1 from private.vote_preview_results where workout_date=p_date) then
   raise exception 'Du kan klarmarkera dagens pass först när omröstningen är avgjord.' using errcode='42501';
  end if;
  if p_action='complete' then
   if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan klarmarkera pass.' using errcode='42501'; end if;
   insert into private.vote_preview_completions(workout_date,user_id,completed_at) values(p_date,actor,instant) on conflict do nothing;
  else
   delete from private.vote_preview_completions where workout_date=p_date and user_id=actor;
  end if;
 end if;
 return private.vote_preview_state(actor,instant);
end; $$;

create or replace function private.vote_preview_admin(p_action text,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; previous timestamptz; day date;
begin
 if actor is null or not exists(select 1 from public.profiles where id=actor and is_admin) then raise exception 'Endast lokal admin kan styra testet.' using errcode='42501'; end if;
 select test_now into previous from private.vote_preview_settings where singleton for update;
 if p_action='reset' then
  delete from private.vote_preview_completions where workout_date between date '2026-10-19' and date '2026-10-25';
  delete from private.vote_preview_votes where workout_date between date '2026-10-19' and date '2026-10-25'; delete from private.vote_preview_results where workout_date between date '2026-10-19' and date '2026-10-25';
  update private.vote_preview_settings set test_now=timestamptz '2026-10-18 20:59:00+02' where singleton;
 elsif p_action='clock' then
  if p_now is null or p_now<timestamptz '2026-10-18 19:59:00+02' or p_now>timestamptz '2026-10-26 00:00:00+01' then raise exception 'Välj ett testdatum 18–26 oktober.' using errcode='22023'; end if;
  if previous is not null and p_now<previous then raise exception 'Testklockan går bara framåt. Återställ testet för att börja om.' using errcode='22023'; end if;
  update private.vote_preview_settings set test_now=p_now where singleton;
 elsif p_action='real_time' then
  update private.vote_preview_settings set test_now=null where singleton;
 else raise exception 'Ogiltig teståtgärd.' using errcode='22023'; end if;
 instant:=private.vote_preview_clock();
 for day in select distinct workout_date from private.vote_preview_options where workout_date::timestamp at time zone 'Europe/Stockholm'<=instant order by workout_date loop
  perform private.vote_preview_settle(day,instant);
 end loop;
 return private.vote_preview_state(actor,instant);
end; $$;

CREATE OR REPLACE FUNCTION private.competition_day_complete(p_user uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when p_date between date '2026-10-19' and date '2026-10-25' then exists(select 1 from private.vote_preview_completions c where c.user_id=p_user and c.workout_date=p_date) when p_date between date '2026-10-12' and date '2026-10-18' then exists(select 1 from public.roulette_daily_scores r where r.user_id=p_user and r.result_date=p_date) when private.bingo_enabled() and p_date between date '2026-10-05' and date '2026-10-11' then
   exists(select 1 from public.bingo_results b where b.user_id=p_user and (p_date=any(b.repeat_dates) or exists(select 1 from jsonb_each_text(b.completed_cells) c where c.value=p_date::text)))
 else exists(select 1 from public.daily_results r where r.user_id=p_user and r.result_date=p_date) end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_leaderboard()
 RETURNS TABLE(rank_position bigint, display_name text, total_points numeric, completed_days bigint, is_current_user boolean, is_eliminated boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with scores as(
 select r.user_id,sum(r.points)::numeric points from public.daily_results r where not(private.bingo_enabled() and r.result_date between date '2026-10-05' and date '2026-10-11') and r.result_date not between date '2026-10-12' and date '2026-10-25' group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from public.daily_bonus_claims c group by c.user_id
 union all select b.user_id,(private.bingo_score(b.completed_cells)->>'total_points')::numeric from public.bingo_results b where private.bingo_enabled()
 union all select r.user_id,sum(r.points)::numeric from public.roulette_daily_scores r group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from private.vote_preview_completions c group by c.user_id
 ), participants as(
 select p.id,p.display_name,coalesce((select sum(s.points) from scores s where s.user_id=p.id),0)::numeric total_points,
 (select count(*) from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day') d where private.competition_day_complete(p.id,d::date))::bigint completed_days,
 p.competition_status='eliminated' is_eliminated from public.profiles p where p.display_name is not null
 ), ranked as(select *,rank() over(order by total_points desc,completed_days desc)::bigint rank_position from participants)
 select rank_position,display_name,total_points,completed_days,id=(select auth.uid()),is_eliminated from ranked
 order by rank_position,total_points desc,completed_days desc,lower(display_name),id;
$function$
;

create or replace function private.guard_vote_preview_daily_result() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'Den dagen gäller Dagens val. Klarmarkera det framröstade passet för 3 poäng.' using errcode='42501'; end; $$;
revoke all on function private.guard_vote_preview_daily_result() from public,anon,authenticated;
drop trigger if exists guard_vote_preview_daily_result on public.daily_results;
create trigger guard_vote_preview_daily_result before insert or update on public.daily_results
for each row when(new.result_date between date '2026-10-19' and date '2026-10-25')
execute function private.guard_vote_preview_daily_result();
notify pgrst,'reload schema';
