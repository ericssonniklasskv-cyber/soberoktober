create table private.daily_result_corrections (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  user_id uuid not null references public.profiles(id),
  result_date date not null,
  before_result jsonb,
  after_result jsonb not null,
  reason text not null check (length(btrim(reason)) between 3 and 240),
  created_at timestamptz not null default now()
);
create index daily_result_corrections_user_date_idx on private.daily_result_corrections(user_id,result_date,created_at desc);
create index daily_result_corrections_actor_idx on private.daily_result_corrections(actor_id);
alter table private.daily_result_corrections enable row level security;
revoke all on private.daily_result_corrections from public,anon,authenticated;

-- A transaction-local marker alone is never authorization: require the stored admin flag too.
create function private.is_daily_result_correction() returns boolean
language sql stable set search_path = ''
as $f$ select coalesce(current_setting('sober.admin_daily_correction',true),'')='on'
  and exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin is true); $f$;
revoke all on function private.is_daily_result_correction() from public,anon,authenticated;

create or replace function public.reject_eliminated_competition_score() returns trigger
language plpgsql security definer set search_path = ''
as $f$
declare v_status text; v_actor uuid := (select auth.uid());
begin
  if private.is_daily_result_correction() then return new; end if;
  if v_actor is not null and v_actor <> new.user_id then
    raise exception 'Users may only submit their own competition results.' using errcode='42501';
  end if;
  perform private.evaluate_user_elimination(new.user_id,(pg_catalog.timezone('Europe/Stockholm',now()))::date-1);
  select competition_status into v_status from public.profiles where id=new.user_id for share;
  if v_status='eliminated' then raise exception 'Du är utslagen ur tävlingen.' using errcode='42501'; end if;
  return new;
end; $f$;

create or replace function private.record_daily_result_activity() returns trigger
language plpgsql security definer set search_path = ''
as $f$ begin
  if private.is_daily_result_correction() then return new; end if;
  if tg_op='INSERT' then
    insert into public.daily_result_activity_events(daily_result_id,user_id,result_date,multiplier,activity_type)
    values(new.id,new.user_id,new.result_date,new.multiplier,'completed');
  elsif new.multiplier>old.multiplier then
    insert into public.daily_result_activity_events(daily_result_id,user_id,result_date,multiplier,previous_multiplier,activity_type)
    values(new.id,new.user_id,new.result_date,new.multiplier,old.multiplier,'upgraded');
  end if;
  return new;
end; $f$;

create function private.admin_daily_result(p_user_id uuid,p_date date,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $f$
declare
 v_actor uuid := (select auth.uid());
 v_profile public.profiles%rowtype;
 v_challenge public.daily_challenges%rowtype;
 v_before jsonb;
 v_after jsonb;
 v_result public.daily_results%rowtype;
 v_multiplier integer;
 v_parts text[];
 v_reason text;
 v_history jsonb;
 v_flag text;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and is_admin is true)
 then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','save') or p_payload is null or jsonb_typeof(p_payload)<>'object'
 then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
 if p_date is null or p_date<date '2026-10-01' or p_date>date '2026-10-31'
   or p_date>(pg_catalog.timezone('Europe/Stockholm',now()))::date
 then raise exception 'Välj en påbörjad dag i oktober 2026.' using errcode='22023'; end if;
 select * into v_profile from public.profiles where id=p_user_id and nullif(btrim(display_name),'') is not null for update;
 if not found then raise exception 'Deltagaren saknas.' using errcode='22023'; end if;
 select * into v_challenge from public.daily_challenges where challenge_date=p_date for share;
 if not found then raise exception 'Den dagen saknar ett pass.' using errcode='22023'; end if;
 select * into v_result from public.daily_results where user_id=p_user_id and result_date=p_date for update;
 if found then v_before:=jsonb_build_object('multiplier',v_result.multiplier,'completed_parts',v_result.completed_parts,'points',v_result.points,'updated_at',v_result.updated_at); end if;
 if p_action='save' then
   if not (p_payload ? 'expected') or (p_payload->'expected') is distinct from coalesce(v_before,'null'::jsonb)
   then raise exception 'Resultatet har ändrats. Ladda om innan du sparar.' using errcode='40001'; end if;
   if coalesce(p_payload->>'multiplier','') not in ('1','2','3')
   then raise exception 'Välj 1×, 2× eller 3×.' using errcode='22023'; end if;
   v_multiplier:=(p_payload->>'multiplier')::integer;
   if jsonb_typeof(p_payload->'completed_parts') is distinct from 'array'
   then raise exception 'Välj genomförd del.' using errcode='22023'; end if;
   select array_agg(value order by value) into v_parts from pg_catalog.jsonb_array_elements_text(p_payload->'completed_parts');
   if v_parts is null or not(v_parts=array['first'] or v_parts=array['second'] or v_parts=array['first','second'])
     or (v_challenge.completion_mode='single' and v_parts<>array['first'])
     or (v_challenge.completion_mode='and' and v_parts<>array['first','second'])
   then raise exception 'Delarna måste följa passets regler.' using errcode='22023'; end if;
   v_reason:=btrim(coalesce(p_payload->>'reason',''));
   if length(v_reason) not between 3 and 240 then raise exception 'Skriv en anledning på 3–240 tecken.' using errcode='22023'; end if;
   if v_profile.competition_status='eliminated' and p_date>(pg_catalog.timezone('Europe/Stockholm',v_profile.eliminated_at))::date
   then raise exception 'Rätta bara dagar före eller på utslagningsdatumet. Återställ deltagaren separat om det behövs.' using errcode='22023'; end if;
   if v_before is null or v_result.multiplier<>v_multiplier or v_result.completed_parts<>v_parts then
     v_flag:=current_setting('sober.admin_daily_correction',true);
     perform set_config('sober.admin_daily_correction','on',true);
     insert into public.daily_results(user_id,result_date,multiplier,completed_parts)
     values(p_user_id,p_date,v_multiplier,v_parts)
     on conflict(user_id,result_date) do update set multiplier=excluded.multiplier,completed_parts=excluded.completed_parts
     returning * into v_result;
     perform set_config('sober.admin_daily_correction',coalesce(v_flag,''),true);
     v_after:=jsonb_build_object('multiplier',v_result.multiplier,'completed_parts',v_result.completed_parts,'points',v_result.points,'updated_at',v_result.updated_at);
     insert into private.daily_result_corrections(actor_id,user_id,result_date,before_result,after_result,reason)
     values(v_actor,p_user_id,p_date,v_before,v_after,v_reason);
   else v_after:=v_before; end if;
 else v_after:=v_before; end if;
 select coalesce(jsonb_agg(h.item order by h.created_at desc,h.id desc),'[]'::jsonb) into v_history from (
   select c.id,c.created_at,jsonb_build_object('created_at',c.created_at,'reason',c.reason,
    'before_multiplier',c.before_result->'multiplier','after_multiplier',c.after_result->'multiplier',
    'admin_name',a.display_name) as item
   from private.daily_result_corrections c join public.profiles a on a.id=c.actor_id
   where c.user_id=p_user_id and c.result_date=p_date order by c.created_at desc,c.id desc limit 10
 )h;
 return jsonb_build_object('display_name',v_profile.display_name,'status',v_profile.competition_status,
   'elimination_reason',v_profile.elimination_reason,'result',v_after,'history',v_history,
   'bonus_points',coalesce((select points from public.daily_bonus_claims where user_id=p_user_id and challenge_date=p_date),0),
   'challenge',jsonb_build_object('title',v_challenge.title,'description',v_challenge.description,'completion_mode',v_challenge.completion_mode,'second_description',v_challenge.second_description));
end; $f$;
revoke all on function private.admin_daily_result(uuid,date,text,jsonb) from public,anon,authenticated;
grant execute on function private.admin_daily_result(uuid,date,text,jsonb) to authenticated;
create function public.admin_daily_result(p_user_id uuid,p_date date,p_action text default 'get',p_payload jsonb default '{}')
returns jsonb language sql set search_path = ''
as $f$ select private.admin_daily_result(p_user_id,p_date,p_action,p_payload); $f$;
revoke all on function public.admin_daily_result(uuid,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_daily_result(uuid,date,text,jsonb) to authenticated;
