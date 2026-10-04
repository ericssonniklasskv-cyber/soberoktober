create function private.bingo_enabled() returns boolean language sql immutable set search_path='' as $$ select false; $$;
revoke all on function private.bingo_enabled() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION private.bingo_score(p_cells jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
with cells as (
 select key::integer as cell, value as completed_date
 from pg_catalog.jsonb_each_text(p_cells)
 where key ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
), completed_rows as (
 select cell / 5 as line from cells group by cell / 5 having count(*)=5
), completed_columns as (
 select cell % 5 as line from cells group by cell % 5 having count(*)=5
), totals as (
 select (select count(*)::integer from cells) as cell_points,
 (select count(distinct completed_date)::integer from cells
  where completed_date ~ '^2026-10-(0[5-9]|1[01])$') as day_bonus_points,
 (select count(*)::integer from completed_rows)+(select count(*)::integer from completed_columns) as line_points
)
select jsonb_build_object(
 'cell_points',cell_points,'day_bonus_points',day_bonus_points,'line_points',line_points,
 'full_board_points',case when cell_points=25 then 10 else 0 end,
 'total_points',cell_points+day_bonus_points+line_points+case when cell_points=25 then 10 else 0 end,
 'rows',coalesce((select jsonb_agg(line order by line) from completed_rows),'[]'::jsonb),
 'columns',coalesce((select jsonb_agg(line order by line) from completed_columns),'[]'::jsonb)
) from totals;
$function$;
create or replace function private.bingo_test_score(p_cells jsonb) returns jsonb language sql immutable set search_path='' as $$ select private.bingo_score(p_cells); $$;
create function private.competition_bingo_board() returns jsonb language sql immutable set search_path='' as $$ select '[{"unit":"min racketsport","label":"Racketsport","base_amount":30,"description":"30 minuter racketsport"},{"unit":"min löpning","label":"Löpning","base_amount":30,"description":"30 minuter löpning"},{"unit":"utegymspass","label":"Utegym","base_amount":1,"description":"Ett pass på utegym"},{"unit":"min långpromenad","label":"Långpromenad","base_amount":60,"description":"Långpromenad – minst 60 minuter"},{"unit":"simpass","label":"Simning","base_amount":1,"description":"Ett simpass"},{"unit":"m sprint","label":"Sprint","base_amount":20,"description":"Spring allt vad du kan i 20 meter – värm upp först"},{"unit":"min hopprep","label":"Hopprep","base_amount":10,"description":"Hoppa hopprep 10 minuter totalt"},{"unit":"cykeltur till jobbet","label":"Cykla till jobbet","base_amount":1,"description":"Cykla till jobbet"},{"unit":"steg","label":"15 000 steg","base_amount":15000,"description":"Gå minst 15 000 steg på en dag"},{"unit":"km promenad","label":"5 km promenad","base_amount":5,"description":"Ta en promenad på minst 5 km"},{"unit":"squats","label":"100 squats","base_amount":100,"description":"Gör 100 squats under en dag"},{"unit":"armhävningar","label":"50 armhävningar","base_amount":50,"description":"Gör 50 armhävningar under en dag"},{"unit":"pull-ups/chins","label":"10 pull-ups","base_amount":10,"description":"Gör totalt 10 pull-ups/chins – assisterade räknas"},{"unit":"min planka","label":"Planka","base_amount":10,"description":"10 minuter planka totalt under dagen"},{"unit":"utfall","label":"100 utfall","base_amount":100,"description":"Gör 100 utfall totalt"},{"unit":"min kroppsviktsträning","label":"Kroppsvikt","base_amount":20,"description":"Kör ett 20-minuters kroppsviktspass"},{"unit":"trapp- eller backpass","label":"Trappor eller backe","base_amount":1,"description":"Gå/jogga i trappor i 15 minuter eller bestig något, t.ex. Ullnabacken."},{"unit":"min yoga/rörlighet","label":"Yoga / rörlighet","base_amount":30,"description":"Testa yoga eller rörlighet i 30 minuter"},{"unit":"låt med sällskap","label":"Dans med sällskap","base_amount":1,"description":"Dansa en hel låt tillsammans med någon annan"},{"unit":"min mobilfri promenad","label":"Mobilfri promenad","base_amount":45,"description":"Ta en promenad utan mobil/podcast/musik i 45 minuter"},{"unit":"pass i dåligt väder","label":"Trotsa vädret","base_amount":1,"description":"Träna utomhus trots dåligt väder"},{"unit":"ny träningsform","label":"Något nytt","base_amount":1,"description":"Testa en träningsform du aldrig gjort tidigare"},{"unit":"aktivitet med sällskap","label":"Träna ihop","base_amount":1,"description":"Gör en aktivitet tillsammans med någon annan"},{"unit":"aktiv transport","label":"Aktiv transport","base_amount":1,"description":"Ta dig någonstans till fots/cykel där du normalt hade tagit bil/buss"},{"unit":"min valfri aktivitet","label":"Valfri aktivitet","base_amount":45,"description":"Välj valfri fysisk aktivitet och håll på i minst 45 minuter"}]'::jsonb; $$;

create function private.bingo_cells_valid(cells jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(cells)='object' and not exists(
   select 1 from jsonb_each_text(case when jsonb_typeof(cells)='object' then cells else '{}' end)
   where key !~ '^(0|[1-9]|1[0-9]|2[0-4])$' or value !~ '^2026-10-(0[5-9]|1[01])$');
$$;
create table public.bingo_results(
 user_id uuid primary key references auth.users(id) on delete cascade,
 board_key bigint generated always as identity unique not null,
 completed_cells jsonb not null default '{}' check(private.bingo_cells_valid(completed_cells)),
 repeat_dates date[] not null default '{}' check(repeat_dates <@ array['2026-10-05'::date,'2026-10-06'::date,'2026-10-07'::date,'2026-10-08'::date,'2026-10-09'::date,'2026-10-10'::date,'2026-10-11'::date]),
 updated_at timestamptz not null default now()
);
alter table public.bingo_results enable row level security;
revoke all on public.bingo_results from public,anon,authenticated;
grant select(user_id,completed_cells,repeat_dates,updated_at) on public.bingo_results to authenticated;
create policy own_bingo_read on public.bingo_results for select to authenticated using(user_id=(select auth.uid()));
create function private.ensure_bingo_board() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if nullif(btrim(new.display_name),'') is not null then
   insert into public.bingo_results(user_id) values(new.id) on conflict(user_id) do nothing;
 end if;
 return new;
end; $$;
revoke all on function private.ensure_bingo_board() from public,anon,authenticated;
create trigger ensure_bingo_board after insert or update of display_name on public.profiles for each row execute function private.ensure_bingo_board();
insert into public.bingo_results(user_id) select id from public.profiles where nullif(btrim(display_name),'') is not null on conflict(user_id) do nothing;

create function private.bingo_daily_scores(cells jsonb) returns table(result_date date,points numeric) language sql immutable set search_path='' as $$
 with squares as(select key::integer as cell,value::date as day from jsonb_each_text(cells)),
 lines as(select max(day) as day from squares group by cell/5 having count(*)=5
   union all select max(day) from squares group by cell%5 having count(*)=5),
 awards as(select day,count(*)::numeric+1 points from squares group by day
   union all select day,1::numeric from lines
   union all select max(day),10::numeric from squares having count(*)=25)
 select day,sum(points) from awards group by day;
$$;
create function private.competition_day_complete(p_user uuid,p_date date) returns boolean language sql stable security definer set search_path='' as $$
 select case when private.bingo_enabled() and p_date between date '2026-10-05' and date '2026-10-11' then
   exists(select 1 from public.bingo_results b where b.user_id=p_user and (p_date=any(b.repeat_dates) or exists(select 1 from jsonb_each_text(b.completed_cells) c where c.value=p_date::text)))
 else exists(select 1 from public.daily_results r where r.user_id=p_user and r.result_date=p_date) end;
$$;
revoke all on function private.competition_day_complete(uuid,date) from public,anon,authenticated;
create or replace function private.find_missed_day_elimination(p_user_id uuid,p_closed_through date)
returns date language sql stable security definer set search_path='' as $$
 select candidate.day::date from generate_series(date '2026-10-02',least(p_closed_through,date '2026-10-31'),interval '1 day') candidate(day)
 where candidate.day::date>(select auto_elimination_recheck_after from public.profiles where id=p_user_id)
 and not private.competition_day_complete(p_user_id,candidate.day::date)
 and not private.competition_day_complete(p_user_id,candidate.day::date-1)
 order by candidate.day limit 1;
$$;

-- Only this private helper accepts a simulated clock, for rollback-only SQL tests.
create function private.bingo_mutation(p_action text,p_date date,p_cell integer,p_now timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=(select auth.uid()); t date:=timezone('Europe/Stockholm',p_now)::date;
 p public.profiles%rowtype; b public.bingo_results%rowtype; day date:=coalesce(p_date,t);
 cells jsonb; repeats date[]; restored boolean:=false;
begin
 if u is null then raise exception 'Logga in först.' using errcode='42501'; end if;
 if p_action is null or p_action not in ('get','complete','uncomplete','repeat') then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
 select * into p from public.profiles where id=u and nullif(btrim(display_name),'') is not null for update;
 if not found then raise exception 'Välj ditt namn först.' using errcode='42501'; end if;
 insert into public.bingo_results(user_id) values(u) on conflict(user_id) do nothing;
 select * into b from public.bingo_results where user_id=u for update;
 if p_action<>'get' then
   if not private.bingo_enabled() or p_now<timestamptz '2026-10-05 00:01:00+02' then raise exception 'Bingot öppnar 5 oktober kl. 00.01.' using errcode='42501'; end if;
   if day not between date '2026-10-05' and date '2026-10-11' or day>t then raise exception 'Välj en påbörjad bingodag 5–11 oktober.' using errcode='22023'; end if;
   if p_cell is null or p_cell not between 0 and 24 then raise exception 'Ogiltig bingoruta.' using errcode='22023'; end if;
   if day=t and p_action in ('complete','repeat') then
     perform private.evaluate_user_elimination(u,t-1);
     select * into p from public.profiles where id=u;
   end if;
   if p.competition_status='eliminated' and day=t and p_action<>'uncomplete' then raise exception 'Du är utslagen ur tävlingen. Tidigare dagar kan rättas i Min oktober.' using errcode='42501'; end if;
   if p_action='complete' then
     if not(b.completed_cells ? p_cell::text) then b.completed_cells:=b.completed_cells||jsonb_build_object(p_cell::text,day::text); end if;
   elsif p_action='uncomplete' then
     if b.completed_cells ? p_cell::text and b.completed_cells->>p_cell::text<>day::text then raise exception 'Öppna dagen då rutan registrerades för att avmarkera.' using errcode='22023'; end if;
     b.completed_cells:=b.completed_cells-p_cell::text;
   elsif p_action='repeat' then
     if not(b.completed_cells ? p_cell::text) then raise exception 'Välj en redan klar ruta att upprepa.' using errcode='22023'; end if;
     if not(day=any(b.repeat_dates)) then b.repeat_dates:=array_append(b.repeat_dates,day); end if;
   end if;
   update public.bingo_results set completed_cells=b.completed_cells,repeat_dates=b.repeat_dates,updated_at=p_now where user_id=u;
   if p.competition_status='eliminated' and p.elimination_reason='Två missade dagar i rad' and private.find_missed_day_elimination(u,t-1) is null then
     update public.elimination_events set is_active=false where event_id=p.current_elimination_event_id;
     update public.profiles set competition_status='active',elimination_reason=null,eliminated_at=null,current_elimination_event_id=null where id=u;
     restored:=true;
   elsif p.competition_status='active' then
     perform private.evaluate_user_elimination(u,t-1);
   end if;
 end if;
 return jsonb_build_object('board',private.competition_bingo_board(),'completed_cells',b.completed_cells,'repeat_dates',b.repeat_dates,
   'activity_dates',(select coalesce(jsonb_agg(d order by d),'[]') from(select distinct value d from jsonb_each_text(b.completed_cells) union select r::text from unnest(b.repeat_dates)r)a),
   'daily_scores',(select coalesce(jsonb_agg(jsonb_build_object('result_date',s.result_date,'points',s.points) order by s.result_date),'[]') from private.bingo_daily_scores(b.completed_cells)s),
   'score',private.bingo_score(b.completed_cells),'today',t,'enabled',private.bingo_enabled(),'restored',restored);
end; $$;
revoke all on function private.bingo_mutation(text,date,integer,timestamptz) from public,anon,authenticated;
create function private.my_competition_bingo(p_action text,p_date date,p_cell integer) returns jsonb language sql security definer set search_path='' as $$
 select private.bingo_mutation(p_action,p_date,p_cell,now());
$$;
revoke all on function private.my_competition_bingo(text,date,integer) from public,anon;
grant execute on function private.my_competition_bingo(text,date,integer) to authenticated;
create function public.my_competition_bingo(p_action text default 'get',p_date date default null,p_cell integer default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.my_competition_bingo(p_action,p_date,p_cell); $$;
revoke all on function public.my_competition_bingo(text,date,integer) from public,anon;
grant execute on function public.my_competition_bingo(text,date,integer) to authenticated;

create function private.bingo_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',private.bingo_enabled(),'board',private.competition_bingo_board(),
 'participants',coalesce((select jsonb_agg(jsonb_build_object('board_key',b.board_key,'display_name',p.display_name,
   'completed_cells',(select coalesce(jsonb_agg(key::integer order by key::integer),'[]') from jsonb_each(b.completed_cells)),
   'score',private.bingo_score(b.completed_cells),'is_current_user',p.id=(select auth.uid()),'is_eliminated',p.competition_status='eliminated')
   order by lower(p.display_name),b.board_key) from public.bingo_results b join public.profiles p on p.id=b.user_id where nullif(btrim(p.display_name),'') is not null),'[]'));
$$;
revoke all on function private.bingo_directory() from public;
grant execute on function private.bingo_directory() to anon,authenticated;
create function public.get_bingo_directory() returns jsonb language sql stable security invoker set search_path='' as $$ select private.bingo_directory(); $$;
revoke all on function public.get_bingo_directory() from public;
grant execute on function public.get_bingo_directory() to anon,authenticated;

create or replace function public.get_leaderboard()
returns table(rank_position bigint,display_name text,total_points numeric,completed_days bigint,is_current_user boolean,is_eliminated boolean)
language sql stable security definer set search_path='' as $$
 with scores as(
 select r.user_id,sum(r.points)::numeric points from public.daily_results r where not(private.bingo_enabled() and r.result_date between date '2026-10-05' and date '2026-10-11') group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from public.daily_bonus_claims c where not(private.bingo_enabled() and c.challenge_date between date '2026-10-05' and date '2026-10-11') group by c.user_id
 union all select b.user_id,(private.bingo_score(b.completed_cells)->>'total_points')::numeric from public.bingo_results b where private.bingo_enabled()
 ), participants as(
 select p.id,p.display_name,coalesce((select sum(s.points) from scores s where s.user_id=p.id),0)::numeric total_points,
 (select count(*) from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day') d where private.competition_day_complete(p.id,d::date))::bigint completed_days,
 p.competition_status='eliminated' is_eliminated from public.profiles p where p.display_name is not null
 ), ranked as(select *,rank() over(order by total_points desc,completed_days desc)::bigint rank_position from participants)
 select rank_position,display_name,total_points,completed_days,id=(select auth.uid()),is_eliminated from ranked
 order by rank_position,total_points desc,completed_days desc,lower(display_name),id;
$$;

CREATE OR REPLACE FUNCTION public.reject_eliminated_competition_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_status text; v_actor uuid := (select auth.uid());
begin
  if tg_table_name='daily_results' then
    if private.bingo_enabled() and new.result_date between date '2026-10-05' and date '2026-10-11' then raise exception 'Den dagen gäller bingo. Registrera på bingobrickan.' using errcode='42501'; end if;
  end if;
  if private.is_daily_result_correction() then return new; end if;
  if tg_table_name='daily_results' then
    if exists(select 1 from private.self_result_write_context c
    where c.transaction_id=pg_catalog.txid_current() and c.user_id=v_actor
      and c.user_id=new.user_id and c.result_date=new.result_date) then return new; end if;
  end if;
  if v_actor is not null and v_actor<>new.user_id then
    raise exception 'Users may only submit their own competition results.' using errcode='42501';
  end if;
  perform private.evaluate_user_elimination(new.user_id,(pg_catalog.timezone('Europe/Stockholm',now()))::date-1);
  select competition_status into v_status from public.profiles where id=new.user_id for share;
  if v_status='eliminated' then raise exception 'Du är utslagen ur tävlingen.' using errcode='42501'; end if;
  return new;
end; $function$;
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
 if p_action='save' and private.bingo_enabled() and p_date between date '2026-10-05' and date '2026-10-11' then raise exception 'Den dagen gäller bingo. Registrera på bingobrickan.' using errcode='42501'; end if;
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
end; $function$;
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
  if private.bingo_enabled() and v_today between date '2026-10-05' and date '2026-10-11' then raise exception 'Under bingoveckan gäller bingobrickan, inga vanliga bonusuppgifter.' using errcode='42501'; end if;
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
$function$;

revoke all on function private.bingo_score(jsonb), private.bingo_daily_scores(jsonb), private.competition_bingo_board(), private.bingo_cells_valid(jsonb) from public,anon,authenticated;

