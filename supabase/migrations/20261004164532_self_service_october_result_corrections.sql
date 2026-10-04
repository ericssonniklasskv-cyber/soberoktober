-- A transaction-scoped capability, never exposed to the Data API.
create table private.self_result_write_context (
  transaction_id bigint primary key,
  user_id uuid not null,
  result_date date not null
);
alter table private.self_result_write_context enable row level security;
revoke all on private.self_result_write_context from public, anon, authenticated;

create or replace function public.reject_eliminated_competition_score()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status text; v_actor uuid := (select auth.uid());
begin
  if private.is_daily_result_correction() then return new; end if;
  if exists(select 1 from private.self_result_write_context c
    where c.transaction_id=pg_catalog.txid_current() and c.user_id=v_actor
      and c.user_id=new.user_id and c.result_date=new.result_date) then return new; end if;
  if v_actor is not null and v_actor<>new.user_id then
    raise exception 'Users may only submit their own competition results.' using errcode='42501';
  end if;
  perform private.evaluate_user_elimination(new.user_id,(pg_catalog.timezone('Europe/Stockholm',now()))::date-1);
  select competition_status into v_status from public.profiles where id=new.user_id for share;
  if v_status='eliminated' then raise exception 'Du är utslagen ur tävlingen.' using errcode='42501'; end if;
  return new;
end; $$;

create or replace function private.record_daily_result_activity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if private.is_daily_result_correction() or exists(
    select 1 from private.self_result_write_context c
    where c.transaction_id=pg_catalog.txid_current() and c.user_id=(select auth.uid())
      and c.user_id=new.user_id and c.result_date=new.result_date
  ) then return new; end if;
  if tg_op='INSERT' then
    insert into public.daily_result_activity_events(daily_result_id,user_id,result_date,multiplier,activity_type)
    values(new.id,new.user_id,new.result_date,new.multiplier,'completed');
  elsif new.multiplier>old.multiplier then
    insert into public.daily_result_activity_events(daily_result_id,user_id,result_date,multiplier,previous_multiplier,activity_type)
    values(new.id,new.user_id,new.result_date,new.multiplier,old.multiplier,'upgraded');
  end if;
  return new;
end; $$;

create function private.self_daily_result(p_date date,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
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
   if p_payload ? 'claim_bonus' and jsonb_typeof(p_payload->'claim_bonus')<>'boolean' then
     raise exception 'Ogiltigt bonusval.' using errcode='22023'; end if;
   if p_payload->'claim_bonus'='true'::jsonb then
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
end; $$;
revoke all on function private.self_daily_result(date,text,jsonb) from public,anon;
grant execute on function private.self_daily_result(date,text,jsonb) to authenticated;
create function public.self_daily_result(p_date date,p_action text default 'get',p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$
 select private.self_daily_result(p_date,p_action,p_payload);
$$;
revoke all on function public.self_daily_result(date,text,jsonb) from public,anon;
grant execute on function public.self_daily_result(date,text,jsonb) to authenticated;
