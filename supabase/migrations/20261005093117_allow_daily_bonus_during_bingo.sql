-- Daily bonus stays separate from bingo attendance. Existing ownership checks,
-- elimination rules, configured points and unique claims remain unchanged.
CREATE OR REPLACE FUNCTION public.get_leaderboard()
 RETURNS TABLE(rank_position bigint, display_name text, total_points numeric, completed_days bigint, is_current_user boolean, is_eliminated boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with scores as(
 select r.user_id,sum(r.points)::numeric points from public.daily_results r where not(private.bingo_enabled() and r.result_date between date '2026-10-05' and date '2026-10-11') group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from public.daily_bonus_claims c group by c.user_id
 union all select b.user_id,(private.bingo_score(b.completed_cells)->>'total_points')::numeric from public.bingo_results b where private.bingo_enabled()
 ), participants as(
 select p.id,p.display_name,coalesce((select sum(s.points) from scores s where s.user_id=p.id),0)::numeric total_points,
 (select count(*) from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day') d where private.competition_day_complete(p.id,d::date))::bigint completed_days,
 p.competition_status='eliminated' is_eliminated from public.profiles p where p.display_name is not null
 ), ranked as(select *,rank() over(order by total_points desc,completed_days desc)::bigint rank_position from participants)
 select rank_position,display_name,total_points,completed_days,id=(select auth.uid()),is_eliminated from ranked
 order by rank_position,total_points desc,completed_days desc,lower(display_name),id;
$function$
;

CREATE OR REPLACE FUNCTION private.self_daily_result(p_date date, p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid := (select auth.uid());
 v_today date := (pg_catalog.timezone('Europe/Stockholm',now()))::date;
 v_profile public.profiles%rowtype;
 v_challenge public.daily_challenges%rowtype;
 v_result public.daily_results%rowtype;
 v_before jsonb;
 v_after jsonb;
 v_parts text[];
 v_multiplier integer;
 v_restored boolean := false;
 v_bonus integer;
 v_bonus_before integer;
begin
 if v_user is null then raise exception 'Logga in först.' using errcode='42501'; end if;
 if p_date is null or p_date<date '2026-10-01' or p_date>date '2026-10-31' or p_date>v_today then
   raise exception 'Välj en påbörjad dag i oktober 2026.' using errcode='22023'; end if;
 if p_action is null or p_action not in ('get','save') or p_payload is null or jsonb_typeof(p_payload)<>'object' then
   raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
 select * into v_profile from public.profiles where id=v_user and nullif(btrim(display_name),'') is not null for update;
 if not found then raise exception 'Välj ditt namn först.' using errcode='42501'; end if;
 select * into v_challenge from public.daily_challenges where challenge_date=p_date for share;
 if not found then raise exception 'Den dagen saknar ett publicerat pass.' using errcode='22023'; end if;
 select * into v_result from public.daily_results where user_id=v_user and result_date=p_date for update;
 if found then v_before:=jsonb_build_object('multiplier',v_result.multiplier,'completed_parts',v_result.completed_parts,'points',v_result.points,'updated_at',v_result.updated_at); end if;
 v_after:=v_before;
 if p_action='save' and p_payload->'multiplier' is not null and p_payload->'multiplier'<>'null'::jsonb and private.bingo_enabled() and p_date between date '2026-10-05' and date '2026-10-11' then raise exception 'Den dagen gäller bingo. Registrera på bingobrickan.' using errcode='42501'; end if;
 if p_action='save' then
   if not(p_payload ? 'expected') or p_payload->'expected' is distinct from coalesce(v_before,'null'::jsonb) then
     raise exception 'Resultatet har ändrats. Öppna dagen igen innan du sparar.' using errcode='40001'; end if;
   if p_payload ? 'multiplier' and p_payload->'multiplier'<>'null'::jsonb then
     if coalesce(p_payload->>'multiplier','') not in ('1','2','3') then
       raise exception 'Välj 1×, 2× eller 3×.' using errcode='22023'; end if;
     v_multiplier:=(p_payload->>'multiplier')::integer;
     if jsonb_typeof(p_payload->'completed_parts') is distinct from 'array' then
       raise exception 'Välj genomförd del.' using errcode='22023'; end if;
     select array_agg(value order by value) into v_parts from pg_catalog.jsonb_array_elements_text(p_payload->'completed_parts');
     if v_parts is null or not(v_parts=array['first'] or v_parts=array['second'] or v_parts=array['first','second'])
       or (v_challenge.completion_mode='single' and v_parts<>array['first'])
       or (v_challenge.completion_mode='and' and v_parts<>array['first','second']) then
       raise exception 'Delarna måste följa passets regler.' using errcode='22023'; end if;
     if v_before is null or v_result.multiplier<>v_multiplier or v_result.completed_parts<>v_parts then
       insert into private.self_result_write_context values(pg_catalog.txid_current(),v_user,p_date);
       insert into public.daily_results(user_id,result_date,multiplier,completed_parts)
       values(v_user,p_date,v_multiplier,v_parts)
       on conflict(user_id,result_date) do update set multiplier=excluded.multiplier,completed_parts=excluded.completed_parts
       returning * into v_result;
       delete from private.self_result_write_context where transaction_id=pg_catalog.txid_current();
       v_after:=jsonb_build_object('multiplier',v_result.multiplier,'completed_parts',v_result.completed_parts,'points',v_result.points,'updated_at',v_result.updated_at);
       insert into private.daily_result_corrections(actor_id,user_id,result_date,before_result,after_result,reason)
       values(v_user,v_user,p_date,v_before,v_after,'Egen efterregistrering i Min oktober');
     end if;
   end if;
   select points into v_bonus_before from public.daily_bonus_claims where user_id=v_user and challenge_date=p_date for update;
   if p_payload ? 'unclaim_bonus' and jsonb_typeof(p_payload->'unclaim_bonus')<>'boolean' then
     raise exception 'Ogiltigt bonusval.' using errcode='22023'; end if;
   if p_payload->'unclaim_bonus'='true'::jsonb then
     if p_payload->'claim_bonus'='true'::jsonb then
       raise exception 'Välj ett bonusval.' using errcode='22023'; end if;
     if not(p_payload ? 'expected_bonus_points') or p_payload->'expected_bonus_points' is distinct from coalesce(to_jsonb(v_bonus_before),'null'::jsonb) then
       raise exception 'Bonusen har ändrats. Öppna dagen igen innan du sparar.' using errcode='40001'; end if;
     delete from public.daily_bonus_claims where user_id=v_user and challenge_date=p_date;
     if v_bonus_before is not null then
       insert into private.daily_result_corrections(actor_id,user_id,result_date,before_result,after_result,reason)
       values(v_user,v_user,p_date,
         coalesce(v_after,'{}'::jsonb)||jsonb_build_object('bonus_points',v_bonus_before),
         coalesce(v_after,'{}'::jsonb)||jsonb_build_object('bonus_points',null),
         'Egen avmarkering av bonuspoäng i Min oktober');
     end if;
   end if;
   if p_payload ? 'claim_bonus' and jsonb_typeof(p_payload->'claim_bonus')<>'boolean' then
     raise exception 'Ogiltigt bonusval.' using errcode='22023'; end if;
   if p_payload->'claim_bonus'='true'::jsonb then
     -- Current-day awards obey the same server status as bingo/daily results.
     -- Historical self-corrections keep their existing backfill behavior.
     if p_date=v_today and v_bonus_before is null then
       perform private.evaluate_user_elimination(v_user,v_today-1);
       if exists(select 1 from public.profiles where id=v_user and competition_status='eliminated') then
         raise exception 'Du är utslagen ur tävlingen.' using errcode='42501';
       end if;
     end if;
     if nullif(btrim(v_challenge.bonus_description),'') is null or v_challenge.bonus_points is null
       or v_challenge.bonus_points not between 1 and 100 then
       raise exception 'Den dagen saknar en bonusuppgift.' using errcode='22023'; end if;
     insert into public.daily_bonus_claims(user_id,challenge_date,points)
     values(v_user,p_date,v_challenge.bonus_points) on conflict(user_id,challenge_date) do nothing;
   end if;
   -- Reuse the existing server-side definition of two missed closed Swedish days.
   if v_profile.competition_status='eliminated' and v_profile.elimination_reason='Två missade dagar i rad'
     and private.find_missed_day_elimination(v_user,v_today-1) is null then
     update public.elimination_events set is_active=false where event_id=v_profile.current_elimination_event_id;
     update public.profiles set competition_status='active',eliminated_at=null,elimination_reason=null,current_elimination_event_id=null where id=v_user;
     v_restored:=true;
   elsif v_profile.competition_status='active' then
     perform private.evaluate_user_elimination(v_user,v_today-1);
   end if;
 end if;
 select points into v_bonus from public.daily_bonus_claims where user_id=v_user and challenge_date=p_date;
 return jsonb_build_object('result',v_after,'bonus_points',v_bonus,'restored',v_restored,
   'challenge',jsonb_build_object('title',v_challenge.title,'description',v_challenge.description,
     'unit',v_challenge.unit,'base_amount',v_challenge.base_amount,'completion_mode',v_challenge.completion_mode,
     'second_description',v_challenge.second_description,'second_unit',v_challenge.second_unit,'second_base_amount',v_challenge.second_base_amount,
     'bonus_description',v_challenge.bonus_description,'bonus_points',v_challenge.bonus_points));
end; $function$
;

CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (pg_catalog.timezone('Europe/Stockholm', now()))::date;
  v_status text;
  v_points integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_today < date '2026-10-01' or v_today > date '2026-10-31' then
    raise exception 'Bonuspoäng kan bara hämtas under tävlingen.' using errcode = '42501';
  end if;

  select profile.competition_status into v_status
  from public.profiles as profile
  where profile.id = v_user_id
  for update;

  if not found or v_status <> 'active' then
    raise exception 'Du är utslagen ur tävlingen.' using errcode = '42501';
  end if;

  select challenge.bonus_points into v_points
  from public.daily_challenges as challenge
  where challenge.challenge_date = v_today
    and challenge.bonus_description is not null
    and challenge.bonus_points between 1 and 100;

  if not found or v_points is null then
    raise exception 'Ingen bonusuppgift är publicerad för idag.' using errcode = 'P0001';
  end if;

  insert into public.daily_bonus_claims (user_id, challenge_date, points)
  values (v_user_id, v_today, v_points);

  return v_points;
end;
$function$
;
