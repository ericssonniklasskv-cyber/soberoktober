-- Restore own historical result corrections for resolved voting-week days.
-- Voting deadlines, ownership, configured points and elimination rules stay unchanged.
create or replace function private.workout_vote_action(p_action text,p_date date,p_option integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); instant timestamptz; day date; actor_status text; existing_kind text; chosen_kind text;
begin
 if actor is null then raise exception 'Logga in för att rösta.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','vote','complete','uncomplete','steps','unsteps','save_result') then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
 instant:=private.workout_vote_clock();
 select competition_status into actor_status from public.profiles where id=actor and nullif(btrim(display_name),'') is not null for share;
 if not found then raise exception 'Välj ett deltagarnamn först.' using errcode='42501'; end if;
 for day in select distinct workout_date from private.workout_vote_options where workout_date::timestamp at time zone 'Europe/Stockholm'<=instant order by workout_date loop
  perform private.workout_vote_settle(day,instant);
 end loop;
 if p_action='vote' then
  if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan rösta.' using errcode='42501'; end if;
  if p_date is null or not exists(select 1 from private.workout_vote_options where workout_date=p_date and option_id=p_option) then raise exception 'Välj ett av de fyra passen.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(260119,p_date-date '2026-01-01');
  -- Recheck after waiting for the poll lock; a request started before midnight
  -- must not insert a vote after the deadline.
  instant:=clock_timestamp();
  if instant<private.workout_vote_opens(p_date) or instant>=p_date::timestamp at time zone 'Europe/Stockholm'
   or exists(select 1 from private.workout_vote_results where workout_date=p_date) then
   raise exception 'Omröstningen är inte öppen. Du röstar dagen före passet.' using errcode='42501'; end if;
  begin
   insert into private.workout_vote_votes values(p_date,actor,p_option,instant);
  exception when unique_violation then raise exception 'Du har redan röstat för den här dagen. Rösten kan inte ändras.' using errcode='23505'; end;
 elsif p_action in ('complete','uncomplete','steps','unsteps','save_result') then
  perform pg_advisory_xact_lock(260119,coalesce(p_date,date '2026-01-01')-date '2026-01-01');
  instant:=clock_timestamp();
  if p_date is null or p_date not between date '2026-10-19' and date '2026-10-25' or p_date>timezone('Europe/Stockholm',instant)::date
     or not exists(select 1 from private.workout_vote_results where workout_date=p_date) then
   raise exception 'Du kan registrera ett avgjort pass för idag eller en tidigare dag under röstveckan.' using errcode='42501';
  end if;
  -- Save one historical choice atomically. A repeated identical save preserves
  -- its original timestamp, activity key and any kudos already received.
  if p_action='save_result' then
   if p_option is null or p_option not in(0,1,2) then raise exception 'Välj pass, 10 000 steg eller inte registrerat.' using errcode='22023'; end if;
   chosen_kind:=case p_option when 1 then 'workout' when 2 then 'steps' else null end;
   select kind into existing_kind from private.workout_vote_completions where workout_date=p_date and user_id=actor;
   if existing_kind is not distinct from chosen_kind then return private.workout_vote_state(actor,instant); end if;
   if existing_kind is not null then
    perform private.workout_vote_action(case existing_kind when 'steps' then 'unsteps' else 'uncomplete' end,p_date,null);
   end if;
   if chosen_kind is not null then
    return private.workout_vote_action(case chosen_kind when 'steps' then 'steps' else 'complete' end,p_date,null);
   end if;
   return private.workout_vote_state(actor,instant);
  end if;
  chosen_kind:=case when p_action in ('steps','unsteps') then 'steps' else 'workout' end;
  if p_action in ('complete','steps') then
   if actor_status<>'active' then raise exception 'Bara aktiva deltagare kan klarmarkera pass.' using errcode='42501'; end if;
   select kind into existing_kind from private.workout_vote_completions where workout_date=p_date and user_id=actor;
   if existing_kind is not null and existing_kind<>chosen_kind then
    if existing_kind='steps' then raise exception 'Klicka ur 10 000 steg innan du klarmarkerar passet.' using errcode='42501';
    else raise exception 'Ångra klarmarkeringen innan du väljer 10 000 steg.' using errcode='42501'; end if;
   end if;
   insert into private.workout_vote_completions(workout_date,user_id,points,kind,completed_at)
   values(p_date,actor,case when chosen_kind='steps' then 1 else 3 end,chosen_kind,instant) on conflict do nothing;
  else
   delete from private.workout_vote_completions where workout_date=p_date and user_id=actor and kind=chosen_kind;
  end if;
 end if;
 return private.workout_vote_state(actor,instant);
end; $$;


notify pgrst,'reload schema';
