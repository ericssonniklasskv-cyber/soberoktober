-- Alternative daily score: either 10,000 steps (1 point) or roulette workouts.
-- Keeps saved draws, checklists, free spins, privileges and existing score rows.
alter table public.roulette_daily_scores drop constraint roulette_daily_scores_points_check;
alter table public.roulette_daily_scores drop constraint roulette_daily_scores_completed_workouts_check;
alter table public.roulette_daily_scores add constraint roulette_daily_score_kind_check check (
  (completed_workouts=0 and points=1) or (completed_workouts between 1 and 3 and points between 2 and 12)
);

create or replace function private.roulette_action(p_action text,p_date date,p_payload jsonb)
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
  if p_action is null or p_action not in ('get','draw','remove','start','check','complete','undo','steps')
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
    (profile.elimination_reason is distinct from 'Två missade dagar i rad' or p_action not in ('complete','steps') or (p_action='steps' and p_payload->>'checked' is distinct from 'true') or chosen<>today-1) then
    raise exception 'Du är utslagen ur tävlingen.' using errcode='42501'; end if;
  if p_action='steps' then
    if jsonb_typeof(p_payload->'checked') is distinct from 'boolean' then raise exception 'Ogiltig stegmarkering.' using errcode='22023'; end if;
    if (p_payload->>'checked')::boolean and exists(select 1 from public.roulette_daily_scores where user_id=actor and result_date=chosen and completed_workouts>0) then
      raise exception 'Du har redan klarat roulettepass idag. Välj antingen steg eller roulette.' using errcode='42501'; end if;
    select coalesce(jsonb_agg(d),'[]'::jsonb) into keys from jsonb_array_elements_text(coalesce(data->'steps','[]')) d where d<>chosen::text;
    if (p_payload->>'checked')::boolean then keys:=keys||to_jsonb(chosen::text); end if;
    data:=jsonb_set(data,'{steps}',keys);
    insert into private.roulette_accounts(user_id,state,revision) values(actor,data,1)
    on conflict(user_id) do update set state=excluded.state,revision=private.roulette_accounts.revision+1,updated_at=instant returning * into account;
    if (p_payload->>'checked')::boolean then
      insert into public.roulette_daily_scores values(actor,chosen,1,0)
      on conflict(user_id,result_date) do update set points=1,completed_workouts=0;
      insert into private.roulette_activity_events(user_id,result_date,round_index,activity_label,event_at)
      values(actor,chosen,-1,'10 000 steg · 1 poäng',instant)
      on conflict(user_id,result_date,round_index) do update set is_active=true,event_at=excluded.event_at;
    else
      delete from public.roulette_daily_scores where user_id=actor and result_date=chosen and completed_workouts=0;
      update private.roulette_activity_events set is_active=false where user_id=actor and result_date=chosen and round_index=-1;
    end if;
    if profile.competition_status='eliminated' and profile.elimination_reason='Två missade dagar i rad' and private.find_missed_day_elimination(actor,today-1) is null then
      update public.elimination_events set is_active=false where event_id=profile.current_elimination_event_id;
      update public.profiles set competition_status='active',eliminated_at=null,elimination_reason=null,current_elimination_event_id=null where id=actor;
    end if;
    return jsonb_build_object('state',data,'revision',account.revision,'active',active,'today',today,'server_now',instant);
  end if;
  if coalesce(data->'steps','[]'::jsonb) ? chosen::text then
    raise exception 'Klicka ur dina 10 000 steg först för att köra roulette.' using errcode='42501'; end if;
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
  select e.user_id,null::smallint,case when e.round_index=-1 then 'roulette_steps' else 'roulette_pass' end,e.event_at,e.result_date,e.activity_label,e.event_id,2,'roulette:'||e.event_id,e.activity_label
  from private.roulette_activity_events e where e.is_active;
$$;

notify pgrst, 'reload schema';
