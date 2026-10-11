-- Append-only release. All randomness, budgets and points are server owned.
create table private.roulette_catalog (
  task_id text primary key,
  category text not null check(category in ('strength','cardio','mobility')),
  level text not null check(level in ('calm','steady','spicy')),
  points integer not null check(points in (2,3,4)),
  task jsonb not null
);
alter table private.roulette_catalog enable row level security;
revoke all on private.roulette_catalog from public,anon,authenticated;

create table private.roulette_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table private.roulette_accounts enable row level security;
revoke all on private.roulette_accounts from public,anon,authenticated;

create table public.roulette_daily_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  result_date date not null check(result_date between date '2026-10-12' and date '2026-10-18'),
  points integer not null check(points between 2 and 12),
  completed_workouts integer not null check(completed_workouts between 1 and 3),
  primary key(user_id,result_date)
);
alter table public.roulette_daily_scores enable row level security;
revoke all on public.roulette_daily_scores from public,anon,authenticated;
grant select on public.roulette_daily_scores to authenticated;
create policy roulette_own_scores on public.roulette_daily_scores for select to authenticated
using ((select auth.uid())=user_id);

create function private.roulette_clock() returns timestamptz language sql stable set search_path='' as $$ select now(); $$;
create function private.roulette_ids(day jsonb) returns setof text language sql immutable set search_path='' as $$
  select day->>'taskId' where day->>'taskId' is not null
  union all select item->>'taskId' from jsonb_array_elements(coalesce(day->'extraSlots','[]')) item where item->>'taskId' is not null
  union all select jsonb_array_elements_text(coalesce(day->'extraTaskIds','[]'));
$$;
create function private.roulette_archived_ids(day jsonb) returns setof text language sql immutable set search_path='' as $$
  select id from jsonb_array_elements(coalesce(day->'completedRounds','[]')) r cross join lateral private.roulette_ids(r) id;
$$;

create function private.roulette_action(p_action text,p_date date,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  actor uuid := auth.uid(); instant timestamptz := private.roulette_clock();
  today date := timezone('Europe/Stockholm',instant)::date;
  chosen date := coalesce(p_date,greatest(date '2026-10-12',least(today,date '2026-10-18')));
  active boolean := instant >= timestamptz '2026-10-12 00:01:00+02' and instant < timestamptz '2026-10-20 00:00:00+02';
  profile public.profiles%rowtype; account private.roulette_accounts%rowtype;
  data jsonb; day jsonb; slots jsonb; history jsonb; saved_round jsonb; item jsonb;
  category text := p_payload->>'category'; slot text := coalesce(p_payload->>'slot','primary');
  slot_index integer; old_id text; picked text; selected_level text; excluded text[];
  archived integer; selected integer; used integer; cost integer; count_done integer; total_points integer;
  keys jsonb; checked jsonb; completed boolean; step_key text := p_payload->>'key';
begin
  if actor is null then raise exception 'Logga in först.' using errcode='42501'; end if;
  if p_action is null or p_action not in ('get','draw','remove','start','check','complete','undo')
    or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Ogiltig åtgärd.' using errcode='22023'; end if;
  if chosen not between date '2026-10-12' and date '2026-10-18' or chosen>greatest(today,date '2026-10-12') then raise exception 'Välj en påbörjad roulettedag.' using errcode='22023'; end if;
  -- Profile lock serializes mutations across all devices and existing scoring RPCs.
  select * into profile from public.profiles where id=actor and nullif(btrim(display_name),'') is not null for update;
  if not found then raise exception 'Välj ditt namn först.' using errcode='42501'; end if;
  select * into account from private.roulette_accounts where user_id=actor for update;
  data := coalesce(account.state,jsonb_build_object('version',4,'date',chosen,'category','strength','days','{}'::jsonb));
  data := jsonb_set(data,'{date}',to_jsonb(chosen::text));
  day := data->'days'->chosen::text;
  if p_action='get' then return jsonb_build_object('state',data,'revision',coalesce(account.revision,0),'active',active,'today',today,'server_now',instant); end if;
  if not active then raise exception 'Rouletten öppnar 12 oktober kl. 00.01.' using errcode='42501'; end if;
  if chosen<today-1 then raise exception 'Du kan bara ändra dagens eller gårdagens sparade pass.' using errcode='42501'; end if;
  if (p_payload->>'revision')::bigint is distinct from coalesce(account.revision,0) then
    raise exception 'Passet har ändrats i en annan vy. Öppna rouletten igen.' using errcode='40001'; end if;
  if profile.competition_status='eliminated' and
    (profile.elimination_reason is distinct from 'Två missade dagar i rad' or p_action<>'complete' or chosen<>today-1) then
    raise exception 'Du är utslagen ur tävlingen.' using errcode='42501'; end if;
  select count(*) into archived from private.roulette_archived_ids(day);
  select count(*) into selected from private.roulette_ids(day);
  completed := coalesce((day->>'completed')::boolean,false);
  if p_action='draw' then
    if chosen<>today or today>date '2026-10-18' then raise exception 'Nya pass kan bara snurras för idag.' using errcode='42501'; end if;
    if category is null or category not in ('strength','cardio','mobility') or slot not in ('primary','extra:0','extra:1') then raise exception 'Välj en giltig kategori och passdel.' using errcode='22023'; end if;
    if archived>=3 or (completed and archived+selected>=3) then raise exception 'Du har klarat dagens tre pass.' using errcode='42501'; end if;
    if slot<>'primary' and (day is null or completed) then raise exception 'Välj ett första pass och kombinera innan det är klart.' using errcode='22023'; end if;
    slots := coalesce(day->'extraSlots','[]');
    if slot='primary' then history:=coalesce(day->'primaryDraws','{}'); old_id:=day->>'taskId';
    else
      slot_index:=right(slot,1)::integer;
      history:=coalesce(slots->slot_index->'draws','{}'); old_id:=slots->slot_index->>'taskId';
      if old_id is null and archived+selected>=3 then raise exception 'Högst tre pass per dag.' using errcode='42501'; end if;
    end if;
    if old_id is not null then history:=history||jsonb_build_object((select c.category from private.roulette_catalog c where task_id=old_id),old_id); end if;
    cost:=case when history ? category then 1 else 0 end;
    select coalesce(sum((value->>'rerolls')::integer),0) into used from jsonb_each(data->'days');
    if cost>0 and used>=5 then raise exception 'Veckans fem frispinn är slut.' using errcode='42501'; end if;
    if completed and slot='primary' then excluded:=array[]::text[];
    else select coalesce(array_agg(id),array[]::text[]) into excluded from private.roulette_ids(day) id where id is distinct from old_id; end if;
    excluded:=array_append(excluded,history->>category);
    -- Equal odds per eligible level, followed by equal odds within that level.
    select level into selected_level from (select distinct c.level from private.roulette_catalog c where c.category=category and not(c.task_id=any(array_remove(excluded,null)))) levels order by random() limit 1;
    if selected_level is null then raise exception 'Alla pass i kategorin är redan valda.' using errcode='22023'; end if;
    select task_id into picked from private.roulette_catalog c where c.category=category and c.level=selected_level and not(c.task_id=any(array_remove(excluded,null))) order by random() limit 1;
    day:=coalesce(day,jsonb_build_object('rerolls',0,'completed',false,'checkedSteps','[]'::jsonb));
    if completed then
      saved_round:=jsonb_build_object('taskId',day->>'taskId','extraTaskIds',(select coalesce(jsonb_agg(id),'[]') from private.roulette_ids(day) id where id<>day->>'taskId'));
      day:=day||jsonb_build_object('completedRounds',coalesce(day->'completedRounds','[]')||jsonb_build_array(saved_round),'checkedSteps','[]'::jsonb,'trainingStarted',false);
      select coalesce(jsonb_agg(jsonb_build_object('draws',coalesce(s->'draws','{}')||case when s->>'taskId' is null then '{}'::jsonb else jsonb_build_object((select c.category from private.roulette_catalog c where task_id=s->>'taskId'),s->>'taskId') end)),'[]') into slots from jsonb_array_elements(slots) s;
    end if;
    if slot='primary' then
      day:=day||jsonb_build_object('taskId',picked,'primaryDraws',history||jsonb_build_object(category,picked),'extraSlots',slots);
      data:=jsonb_set(data,'{category}',to_jsonb(category));
    else
      while jsonb_array_length(slots)<=slot_index loop slots:=slots||jsonb_build_array(jsonb_build_object('draws','{}'::jsonb)); end loop;
      slots:=jsonb_set(slots,array[slot_index::text],jsonb_build_object('taskId',picked,'draws',history||jsonb_build_object(category,picked)));
      day:=jsonb_set(day,'{extraSlots}',slots);
    end if;
    day:=day||jsonb_build_object('rerolls',coalesce((day->>'rerolls')::integer,0)+cost,'completed',false);
  elsif day is null then raise exception 'Snurra fram ett pass först.' using errcode='22023';
  elsif p_action='remove' then
    if completed or chosen<>today or slot not in ('extra:0','extra:1') then raise exception 'Det passet kan inte tas bort.' using errcode='22023'; end if;
    slot_index:=right(slot,1)::integer; item:=day->'extraSlots'->slot_index;
    if item->>'taskId' is null then raise exception 'Passet finns inte.' using errcode='22023'; end if;
    day:=jsonb_set(day,array['extraSlots',slot_index::text],item-'taskId');
  elsif p_action='start' then day:=jsonb_set(day,'{trainingStarted}','true');
  elsif p_action='check' then
    if completed or jsonb_typeof(p_payload->'checked') is distinct from 'boolean' then raise exception 'Ogiltig markering.' using errcode='22023'; end if;
    if not exists(select 1 from private.roulette_ids(day) id join private.roulette_catalog c on task_id=id cross join lateral jsonb_array_elements_text(c.task->'checkKeys') k where k=step_key) then raise exception 'Välj ett giltigt moment.' using errcode='22023'; end if;
    select coalesce(jsonb_agg(k),'[]') into checked from jsonb_array_elements_text(coalesce(day->'checkedSteps','[]')) k where k<>step_key;
    if (p_payload->>'checked')::boolean then checked:=checked||jsonb_build_array(step_key); end if;
    day:=day||jsonb_build_object('checkedSteps',checked,'trainingStarted',true);
  elsif p_action in ('complete','undo') then
    if p_action='complete' and not completed then
      if archived+selected>3 then raise exception 'Högst tre pass per dag.' using errcode='42501'; end if;
      day:=jsonb_set(day,'{completed}','true');
    elsif p_action='undo' and completed then day:=jsonb_set(day,'{completed}','false');
    end if;
  end if;
  -- Drop only checks belonging to a replaced/removed task.
  select coalesce(jsonb_agg(k),'[]') into keys from private.roulette_ids(day) id join private.roulette_catalog c on task_id=id cross join lateral jsonb_array_elements_text(c.task->'checkKeys') k;
  select coalesce(jsonb_agg(k),'[]') into checked from jsonb_array_elements_text(coalesce(day->'checkedSteps','[]')) k where keys ? k;
  day:=jsonb_set(day,'{checkedSteps}',checked);
  data:=jsonb_set(data,array['days',chosen::text],day);
  insert into private.roulette_accounts(user_id,state,revision) values(actor,data,1)
  on conflict(user_id) do update set state=excluded.state,revision=private.roulette_accounts.revision+1,updated_at=instant returning * into account;
  if p_action in ('complete','undo') then
    select count(*),coalesce(sum(c.points),0) into count_done,total_points from (
      select id from private.roulette_archived_ids(day) id
      union all select id from private.roulette_ids(day) id where (day->>'completed')::boolean
    ) ids join private.roulette_catalog c on task_id=ids.id;
    if count_done=0 then delete from public.roulette_daily_scores where user_id=actor and result_date=chosen;
    else insert into public.roulette_daily_scores values(actor,chosen,total_points,count_done)
      on conflict(user_id,result_date) do update set points=excluded.points,completed_workouts=excluded.completed_workouts; end if;
    if profile.competition_status='eliminated' and profile.elimination_reason='Två missade dagar i rad' and private.find_missed_day_elimination(actor,today-1) is null then
      update public.elimination_events set is_active=false where event_id=profile.current_elimination_event_id;
      update public.profiles set competition_status='active',eliminated_at=null,elimination_reason=null,current_elimination_event_id=null where id=actor;
    end if;
  end if;
  return jsonb_build_object('state',data,'revision',account.revision,'active',active,'today',today,'server_now',instant);
end;
$$;
revoke all on function private.roulette_action(text,date,jsonb) from public,anon,authenticated;
grant execute on function private.roulette_action(text,date,jsonb) to authenticated;
create function public.my_training_roulette(p_action text default 'get',p_date date default null,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select private.roulette_action(p_action,p_date,p_payload); $$;
revoke all on function public.my_training_roulette(text,date,jsonb) from public,anon;
grant execute on function public.my_training_roulette(text,date,jsonb) to authenticated;
revoke all on function private.roulette_clock(),private.roulette_ids(jsonb),private.roulette_archived_ids(jsonb) from public,anon,authenticated;

insert into private.roulette_catalog(task_id,category,level,points,task) values
('s1b','strength','calm',2,'{"id": "s1b", "level": "calm", "title": "Basen, tack", "duration": "10 min", "instructions": ["2 set: 15 squats.", "2 set: 10 armhävningar.", "Vila 30–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "sets": 2, "exercises": ["15 squats.", "10 armhävningar."], "notes": ["Vila 30–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 2, "checkKeys": ["s1b:exercise:0:set:0", "s1b:exercise:0:set:1", "s1b:exercise:1:set:0", "s1b:exercise:1:set:1"]}'::jsonb),
('s2b','strength','steady',3,'{"id": "s2b", "level": "steady", "title": "Armhävningsklubben", "duration": "15 min", "instructions": ["3 set: 10 armhävningar.", "3 set: 15 squats.", "3 set: 30 sekunder planka.", "Vila 45–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "sets": 3, "exercises": ["10 armhävningar.", "15 squats.", "30 sekunder planka."], "notes": ["Vila 45–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 3, "checkKeys": ["s2b:exercise:0:set:0", "s2b:exercise:0:set:1", "s2b:exercise:0:set:2", "s2b:exercise:1:set:0", "s2b:exercise:1:set:1", "s2b:exercise:1:set:2", "s2b:exercise:2:set:0", "s2b:exercise:2:set:1", "s2b:exercise:2:set:2"]}'::jsonb),
('s3b','strength','calm',2,'{"id": "s3b", "level": "calm", "title": "Ben och rumpa, tack", "duration": "10 min", "instructions": ["2 set: 15 squats.", "2 set: 15 höftlyft.", "Vila 30–60 sekunder mellan seten.", "Eller motsvarande övningar på gym."], "sets": 2, "exercises": ["15 squats.", "15 höftlyft."], "notes": ["Vila 30–60 sekunder mellan seten.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 2, "checkKeys": ["s3b:exercise:0:set:0", "s3b:exercise:0:set:1", "s3b:exercise:1:set:0", "s3b:exercise:1:set:1"]}'::jsonb),
('s4b','strength','spicy',4,'{"id": "s4b", "level": "spicy", "title": "Hela kroppen tack", "duration": "25 min", "instructions": ["3 set: 15 squats.", "3 set: 10 armhävningar.", "3 set: 10 bakåtutfall per sida.", "3 set: 15 höftlyft.", "3 set: 45 sekunder planka.", "Vila 60–90 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "sets": 3, "exercises": ["15 squats.", "10 armhävningar.", "10 bakåtutfall per sida.", "15 höftlyft.", "45 sekunder planka."], "notes": ["Vila 60–90 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 4, "checkKeys": ["s4b:exercise:0:set:0", "s4b:exercise:0:set:1", "s4b:exercise:0:set:2", "s4b:exercise:1:set:0", "s4b:exercise:1:set:1", "s4b:exercise:1:set:2", "s4b:exercise:2:set:0", "s4b:exercise:2:set:1", "s4b:exercise:2:set:2", "s4b:exercise:3:set:0", "s4b:exercise:3:set:1", "s4b:exercise:3:set:2", "s4b:exercise:4:set:0", "s4b:exercise:4:set:1", "s4b:exercise:4:set:2"]}'::jsonb),
('s5c','strength','steady',3,'{"id": "s5c", "level": "steady", "title": "Bål utan bortförklaringar", "duration": "15 min", "instructions": ["3 set: 30 sekunder planka.", "3 set: 10 omvända crunches.", "3 set: 15 höftlyft.", "Vila 45–60 sekunder mellan seten.", "Eller motsvarande övningar på gym."], "sets": 3, "exercises": ["30 sekunder planka.", "10 omvända crunches.", "15 höftlyft."], "notes": ["Vila 45–60 sekunder mellan seten.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 3, "checkKeys": ["s5c:exercise:0:set:0", "s5c:exercise:0:set:1", "s5c:exercise:0:set:2", "s5c:exercise:1:set:0", "s5c:exercise:1:set:1", "s5c:exercise:1:set:2", "s5c:exercise:2:set:0", "s5c:exercise:2:set:1", "s5c:exercise:2:set:2"]}'::jsonb),
('s6c','strength','calm',2,'{"id": "s6c", "level": "calm", "title": "Bänkpress utan bänkpress", "duration": "10 min", "instructions": ["2 set: 10 armhävningar.", "2 set: 10 omvända crunches.", "Vila 30–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "sets": 2, "exercises": ["10 armhävningar.", "10 omvända crunches."], "notes": ["Vila 30–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 2, "checkKeys": ["s6c:exercise:0:set:0", "s6c:exercise:0:set:1", "s6c:exercise:1:set:0", "s6c:exercise:1:set:1"]}'::jsonb),
('s7c','strength','spicy',4,'{"id": "s7c", "level": "spicy", "title": "Leg day, tydligen", "duration": "25 min", "instructions": ["3 set: 30 squats.", "3 set: 20 utfall per sida.", "3 set: 20 höftlyft.", "Vila 60–90 sekunder mellan seten.", "Eller motsvarande övningar på gym."], "sets": 3, "exercises": ["30 squats.", "20 utfall per sida.", "20 höftlyft."], "notes": ["Vila 60–90 sekunder mellan seten.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 4, "checkKeys": ["s7c:exercise:0:set:0", "s7c:exercise:0:set:1", "s7c:exercise:0:set:2", "s7c:exercise:1:set:0", "s7c:exercise:1:set:1", "s7c:exercise:1:set:2", "s7c:exercise:2:set:0", "s7c:exercise:2:set:1", "s7c:exercise:2:set:2"]}'::jsonb),
('s8c','strength','steady',3,'{"id": "s8c", "level": "steady", "title": "Pannben i tre delar", "duration": "20 min", "instructions": ["3 set: 15 squats.", "3 set: 10 utfall per sida.", "3 set: 10 armhävningar.", "Vila 45–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "sets": 3, "exercises": ["15 squats.", "10 utfall per sida.", "10 armhävningar."], "notes": ["Vila 45–60 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 3, "checkKeys": ["s8c:exercise:0:set:0", "s8c:exercise:0:set:1", "s8c:exercise:0:set:2", "s8c:exercise:1:set:0", "s8c:exercise:1:set:1", "s8c:exercise:1:set:2", "s8c:exercise:2:set:0", "s8c:exercise:2:set:1", "s8c:exercise:2:set:2"]}'::jsonb),
('s9','strength','spicy',4,'{"id": "s9", "level": "spicy", "title": "Svett utan hantlar", "duration": "25 min", "instructions": ["3 set: 15 squats.", "3 set: 10 armhävningar.", "3 set: 10 bakåtutfall per sida.", "3 set: 15 höftlyft.", "3 set: 30 sekunder mountain climbers.", "Vila 60–90 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "sets": 3, "exercises": ["15 squats.", "10 armhävningar.", "10 bakåtutfall per sida.", "15 höftlyft.", "30 sekunder mountain climbers."], "notes": ["Vila 60–90 sekunder mellan seten.", "Armhävningar på knä går också bra.", "Eller motsvarande övningar på gym."], "category": "strength", "points": 4, "checkKeys": ["s9:exercise:0:set:0", "s9:exercise:0:set:1", "s9:exercise:0:set:2", "s9:exercise:1:set:0", "s9:exercise:1:set:1", "s9:exercise:1:set:2", "s9:exercise:2:set:0", "s9:exercise:2:set:1", "s9:exercise:2:set:2", "s9:exercise:3:set:0", "s9:exercise:3:set:1", "s9:exercise:3:set:2", "s9:exercise:4:set:0", "s9:exercise:4:set:1", "s9:exercise:4:set:2"]}'::jsonb),
('c1c','cardio','calm',2,'{"id": "c1c", "level": "calm", "title": "Promenad med attityd", "duration": "30 min", "instructions": ["Gå en lugn promenad i 30 minuter.", "Gå i lugnt och bekvämt tempo."], "steps": [{"text": "Gå en lugn promenad i 30 minuter."}], "notes": ["Gå i lugnt och bekvämt tempo."], "category": "cardio", "points": 2, "checkKeys": ["c1c:step:0"]}'::jsonb),
('c2d','cardio','steady',3,'{"id": "c2d", "level": "steady", "title": "Lugn jogg, tack", "duration": "30 min", "instructions": ["Jogga lugnt i 30 minuter.", "Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "steps": [{"text": "Jogga lugnt i 30 minuter."}], "notes": ["Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "category": "cardio", "points": 3, "checkKeys": ["c2d:step:0"]}'::jsonb),
('c3c','cardio','calm',2,'{"id": "c3c", "level": "calm", "title": "En sväng räcker", "duration": "25 min", "instructions": ["Gå en lugn promenad i 25 minuter.", "Gå i lugnt och bekvämt tempo."], "steps": [{"text": "Gå en lugn promenad i 25 minuter."}], "notes": ["Gå i lugnt och bekvämt tempo."], "category": "cardio", "points": 2, "checkKeys": ["c3c:step:0"]}'::jsonb),
('c4c','cardio','spicy',4,'{"id": "c4c", "level": "spicy", "title": "Intervaller, såklart", "duration": "30 min", "instructions": ["Värm upp med 8 minuter lätt jogg eller rask gång.", "1 minut hård jogg + 2 minuter lugn jogg.", "1 minut hård jogg + 2 minuter lugn jogg.", "1 minut hård jogg + 2 minuter lugn jogg.", "1 minut hård jogg + 2 minuter lugn jogg.", "1 minut hård jogg + 2 minuter lugn jogg.", "1 minut hård jogg + 2 minuter lugn jogg.", "Varva ner i 4 minuter.", "Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "steps": [{"lead": "Uppvärmning", "text": "Värm upp med 8 minuter lätt jogg eller rask gång."}, {"lead": "Intervall 1 av 6", "text": "1 minut hård jogg + 2 minuter lugn jogg."}, {"lead": "Intervall 2 av 6", "text": "1 minut hård jogg + 2 minuter lugn jogg."}, {"lead": "Intervall 3 av 6", "text": "1 minut hård jogg + 2 minuter lugn jogg."}, {"lead": "Intervall 4 av 6", "text": "1 minut hård jogg + 2 minuter lugn jogg."}, {"lead": "Intervall 5 av 6", "text": "1 minut hård jogg + 2 minuter lugn jogg."}, {"lead": "Intervall 6 av 6", "text": "1 minut hård jogg + 2 minuter lugn jogg."}, {"lead": "Nedvarvning", "text": "Varva ner i 4 minuter."}], "notes": ["Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "category": "cardio", "points": 4, "checkKeys": ["c4c:step:0", "c4c:step:1", "c4c:step:2", "c4c:step:3", "c4c:step:4", "c4c:step:5", "c4c:step:6", "c4c:step:7"]}'::jsonb),
('c5d','cardio','steady',3,'{"id": "c5d", "level": "steady", "title": "Hitta joggen", "duration": "35 min", "instructions": ["Jogga i bra tempo i 35 minuter.", "Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "steps": [{"text": "Jogga i bra tempo i 35 minuter."}], "notes": ["Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "category": "cardio", "points": 3, "checkKeys": ["c5d:step:0"]}'::jsonb),
('c6c','cardio','calm',2,'{"id": "c6c", "level": "calm", "title": "Lufta herrn", "duration": "20 min", "instructions": ["Gå en lugn promenad i 20 minuter.", "Gå i lugnt och bekvämt tempo."], "steps": [{"text": "Gå en lugn promenad i 20 minuter."}], "notes": ["Gå i lugnt och bekvämt tempo."], "category": "cardio", "points": 2, "checkKeys": ["c6c:step:0"]}'::jsonb),
('c7b','cardio','spicy',4,'{"id": "c7b", "level": "spicy", "title": "Långa vägen hem", "duration": "45 min", "instructions": ["Jogga lugnt i 10 minuter.", "5 minuter jogg i ett ansträngande tempo + 5 minuter lugn jogg.", "5 minuter jogg i ett ansträngande tempo + 5 minuter lugn jogg.", "5 minuter jogg i ett ansträngande tempo + 5 minuter lugn jogg.", "Varva ner i 5 minuter.", "Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "steps": [{"lead": "Uppvärmning", "text": "Jogga lugnt i 10 minuter."}, {"lead": "Intervall 1 av 3", "text": "5 minuter jogg i ett ansträngande tempo + 5 minuter lugn jogg."}, {"lead": "Intervall 2 av 3", "text": "5 minuter jogg i ett ansträngande tempo + 5 minuter lugn jogg."}, {"lead": "Intervall 3 av 3", "text": "5 minuter jogg i ett ansträngande tempo + 5 minuter lugn jogg."}, {"lead": "Nedvarvning", "text": "Varva ner i 5 minuter."}], "notes": ["Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "category": "cardio", "points": 4, "checkKeys": ["c7b:step:0", "c7b:step:1", "c7b:step:2", "c7b:step:3", "c7b:step:4"]}'::jsonb),
('c8c','cardio','steady',3,'{"id": "c8c", "level": "steady", "title": "Lugna vägen hem", "duration": "30 min", "instructions": ["Jogga lugnt i 30 minuter.", "Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "steps": [{"text": "Jogga lugnt i 30 minuter."}], "notes": ["Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "category": "cardio", "points": 3, "checkKeys": ["c8c:step:0"]}'::jsonb),
('c9','cardio','spicy',4,'{"id": "c9", "level": "spicy", "title": "Flåset får jobba", "duration": "30 min", "instructions": ["Jogga lugnt i 5 minuter.", "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg.", "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg.", "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg.", "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg.", "Varva ner med 5 minuter lugn jogg eller gång.", "Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "steps": [{"lead": "Uppvärmning", "text": "Jogga lugnt i 5 minuter."}, {"lead": "Intervall 1 av 4", "text": "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg."}, {"lead": "Intervall 2 av 4", "text": "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg."}, {"lead": "Intervall 3 av 4", "text": "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg."}, {"lead": "Intervall 4 av 4", "text": "3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg."}, {"lead": "Nedvarvning", "text": "Varva ner med 5 minuter lugn jogg eller gång."}], "notes": ["Eller motsvarande i annan konditionsform, till exempel simning eller cykling."], "category": "cardio", "points": 4, "checkKeys": ["c9:step:0", "c9:step:1", "c9:step:2", "c9:step:3", "c9:step:4", "c9:step:5"]}'::jsonb),
('m1b','mobility','calm',2,'{"id": "m1b", "level": "calm", "title": "10 minuter rörlighet", "duration": "10 min", "instructions": ["Följ en valfri Youtubevideo med yoga eller rörlighet i 10 minuter.", "Välj själv en video du gillar. Anpassa rörelserna efter kroppen."], "steps": [{"text": "Följ en valfri Youtubevideo med yoga eller rörlighet i 10 minuter."}], "notes": ["Välj själv en video du gillar. Anpassa rörelserna efter kroppen."], "category": "mobility", "points": 2, "checkKeys": ["m1b:step:0"]}'::jsonb),
('m2b','mobility','steady',3,'{"id": "m2b", "level": "steady", "title": "20 minuter rörlighet", "duration": "20 min", "instructions": ["Följ en valfri Youtubevideo med yoga eller rörlighet i 20 minuter.", "Välj själv en video du gillar. Anpassa rörelserna efter kroppen."], "steps": [{"text": "Följ en valfri Youtubevideo med yoga eller rörlighet i 20 minuter."}], "notes": ["Välj själv en video du gillar. Anpassa rörelserna efter kroppen."], "category": "mobility", "points": 3, "checkKeys": ["m2b:step:0"]}'::jsonb),
('m4b','mobility','spicy',4,'{"id": "m4b", "level": "spicy", "title": "30 minuter rörlighet", "duration": "30 min", "instructions": ["Följ en valfri Youtubevideo med yoga eller rörlighet i 30 minuter.", "Välj själv en video du gillar. Anpassa rörelserna efter kroppen."], "steps": [{"text": "Följ en valfri Youtubevideo med yoga eller rörlighet i 30 minuter."}], "notes": ["Välj själv en video du gillar. Anpassa rörelserna efter kroppen."], "category": "mobility", "points": 4, "checkKeys": ["m4b:step:0"]}'::jsonb);
-- Preserve the deployed bingo/bonus scoring; replace only the roulette week.
CREATE OR REPLACE FUNCTION private.competition_day_complete(p_user uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when p_date between date '2026-10-12' and date '2026-10-18' then exists(select 1 from public.roulette_daily_scores r where r.user_id=p_user and r.result_date=p_date) when private.bingo_enabled() and p_date between date '2026-10-05' and date '2026-10-11' then
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
 select r.user_id,sum(r.points)::numeric points from public.daily_results r where not(private.bingo_enabled() and r.result_date between date '2026-10-05' and date '2026-10-11') and r.result_date not between date '2026-10-12' and date '2026-10-18' group by r.user_id
 union all select c.user_id,sum(c.points)::numeric from public.daily_bonus_claims c group by c.user_id
 union all select b.user_id,(private.bingo_score(b.completed_cells)->>'total_points')::numeric from public.bingo_results b where private.bingo_enabled()
 union all select r.user_id,sum(r.points)::numeric from public.roulette_daily_scores r group by r.user_id
 ), participants as(
 select p.id,p.display_name,coalesce((select sum(s.points) from scores s where s.user_id=p.id),0)::numeric total_points,
 (select count(*) from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day') d where private.competition_day_complete(p.id,d::date))::bigint completed_days,
 p.competition_status='eliminated' is_eliminated from public.profiles p where p.display_name is not null
 ), ranked as(select *,rank() over(order by total_points desc,completed_days desc)::bigint rank_position from participants)
 select rank_position,display_name,total_points,completed_days,id=(select auth.uid()),is_eliminated from ranked
 order by rank_position,total_points desc,completed_days desc,lower(display_name),id;
$function$
;
create function private.guard_roulette_daily_result() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Den dagen gäller Dagens Spinn The Wheel. Registrera dina sparade pass i rouletten.' using errcode='42501'; end; $$;
revoke all on function private.guard_roulette_daily_result() from public,anon,authenticated;
create trigger guard_roulette_daily_result before insert or update on public.daily_results
for each row when (new.result_date between date '2026-10-12' and date '2026-10-18')
execute function private.guard_roulette_daily_result();


create table private.roulette_activity_events (
  event_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  result_date date not null,
  round_index integer not null,
  activity_label text not null,
  event_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique(user_id,result_date,round_index)
);
alter table private.roulette_activity_events enable row level security;
revoke all on private.roulette_activity_events from public,anon,authenticated;
revoke all on sequence private.roulette_activity_events_event_id_seq from public,anon,authenticated;
create function private.record_roulette_activity() returns trigger language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare day jsonb:=new.state->'days'->(new.state->>'date'); previous jsonb; v_round_index integer; label text;
begin
  if tg_op='UPDATE' then previous:=old.state->'days'->(new.state->>'date'); end if;
  v_round_index:=jsonb_array_length(coalesce(day->'completedRounds','[]'));
  if (day->>'completed')::boolean and not coalesce((previous->>'completed')::boolean,false) then
    select string_agg(c.task->>'title',' + ')||' · '||sum(c.points)||' poäng' into label from private.roulette_ids(day) id join private.roulette_catalog c on task_id=id;
    insert into private.roulette_activity_events(user_id,result_date,round_index,activity_label,event_at)
    values(new.user_id,(new.state->>'date')::date,v_round_index,label,private.roulette_clock())
    on conflict(user_id,result_date,round_index) do update set is_active=true,activity_label=excluded.activity_label,event_at=excluded.event_at;
  elsif not (day->>'completed')::boolean and coalesce((previous->>'completed')::boolean,false)
    and v_round_index=jsonb_array_length(coalesce(previous->'completedRounds','[]')) then
    update private.roulette_activity_events e set is_active=false where e.user_id=new.user_id and e.result_date=(new.state->>'date')::date and e.round_index=v_round_index;
  end if;
  return new;
end; $$;
revoke all on function private.record_roulette_activity() from public,anon,authenticated;
create trigger record_roulette_activity after insert or update on private.roulette_accounts for each row execute function private.record_roulette_activity();

create or replace function private.kudos_feed_events()
returns table(user_id uuid, multiplier smallint, activity_type text,
  event_at timestamptz, result_date date, activity_label text,
  event_id bigint, source_order integer, activity_key text, kudos_label text)
language sql stable security invoker set search_path='' as $$
  select e.user_id,e.multiplier,e.activity_type,e.event_at,e.result_date,
    null::text,e.event_id,0,'daily:'||e.event_id,
    'dagens pass ×'||e.multiplier
  from public.daily_result_activity_events e
  where e.result_date between date '2026-10-01' and date '2026-10-31'
  union all
  select e.user_id,null::smallint,e.activity_type,e.event_at,e.result_date,
    case when e.activity_type='bingo_cell' then private.competition_bingo_board()->e.cell_index->>'description' else null end,
    e.event_id,1,'bingo:'||e.event_id,
    case e.activity_type
      when 'bingo_cell' then private.competition_bingo_board()->e.cell_index->>'description'
      when 'bingo_row' then 'en hel bingorad'
      else 'hela bingobrickan' end
  from private.bingo_activity_events e where e.is_active and private.bingo_enabled()
  union all
  select e.user_id,null::smallint,'roulette_pass'::text,e.event_at,e.result_date,e.activity_label,e.event_id,2,'roulette:'||e.event_id,e.activity_label
  from private.roulette_activity_events e where e.is_active;
$$;

notify pgrst, 'reload schema';
