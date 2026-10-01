create or replace function private.admin_bingo_test(p_action text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $test$
declare
  v_user uuid := (select auth.uid());
  v public.bingo_test_sessions%rowtype;
  v_date date;
  v_cell integer;
  v_task jsonb;
  v_board jsonb := '[]'::jsonb;
  v_new_completion boolean := false;
  v_new_activity boolean := false;
begin
  if v_user is null or not exists (
    select 1 from public.profiles p where p.id = v_user and p.is_admin is true
  ) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('get','complete','uncomplete','set_date','save_board','reset','eliminate','restore') then
    raise exception 'Unknown test action' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid test payload' using errcode = '22023';
  end if;

  insert into public.bingo_test_sessions(admin_user_id, board)
  values (v_user, private.default_bingo_test_board())
  on conflict (admin_user_id) do nothing;
  select * into strict v from public.bingo_test_sessions where admin_user_id = v_user for update;

  if p_action = 'reset' then
    v.completed_cells := '{}'::jsonb;
    v.activity_dates := '{}';
    v.simulated_date := date '2026-10-05';
    v.elimination_date := null;
    v.elimination_reason := null;
    v.auto_check_after := date '2026-10-04';
  elsif p_action = 'set_date' then
    if coalesce(p_payload->>'date','') !~ '^2026-10-(0[5-9]|1[0-2])$' then
      raise exception 'Testdatum måste vara 5–12 oktober 2026.' using errcode = '22023';
    end if;
    v_date := (p_payload->>'date')::date;
    if v_date < v.simulated_date then
      raise exception 'Testet kan bara gå framåt i tiden. Nollställ för att börja om.' using errcode = '22023';
    end if;
    v.simulated_date := v_date;
  elsif p_action = 'save_board' then
    if v.completed_cells <> '{}'::jsonb or cardinality(v.activity_dates) > 0 then
      raise exception 'Nollställ testet innan uppgifterna ändras.' using errcode = '22023';
    end if;
    if jsonb_typeof(p_payload->'board') <> 'array' or jsonb_array_length(p_payload->'board') <> 25 then
      raise exception 'Brickan måste ha exakt 25 uppgifter.' using errcode = '22023';
    end if;
    if p_payload->'board' is null then
      raise exception 'Brickan saknas.' using errcode = '22023';
    end if;
    for v_task in select value from pg_catalog.jsonb_array_elements(p_payload->'board') loop
      if jsonb_typeof(v_task) <> 'object'
        or length(btrim(coalesce(v_task->>'label',''))) not between 1 and 60
        or length(btrim(coalesce(v_task->>'description',''))) not between 1 and 240
        or length(btrim(coalesce(v_task->>'unit',''))) not between 1 and 64
        or coalesce(v_task->>'base_amount','') !~ '^[1-9][0-9]{0,5}$'
      then raise exception 'Kontrollera namn, uppgift, mängd och enhet för alla rutor.' using errcode = '22023'; end if;
      if (v_task->>'base_amount')::integer > 100000 then
        raise exception 'Grundmängd måste vara 1–100000.' using errcode = '22023';
      end if;
      v_board := v_board || jsonb_build_array(jsonb_build_object(
        'label',btrim(v_task->>'label'),'description',btrim(v_task->>'description'),
        'base_amount',(v_task->>'base_amount')::integer,'unit',btrim(v_task->>'unit')
      ));
    end loop;
    v.board := v_board;
  elsif p_action = 'restore' then
    v.elimination_date := null;
    v.elimination_reason := null;
    v.auto_check_after := v.simulated_date;
  end if;

  if v.elimination_date is null then
    v.elimination_date := private.bingo_test_missed_pair(v.activity_dates, v.simulated_date - 1, v.auto_check_after);
    if v.elimination_date is not null then v.elimination_reason := 'Två missade dagar i rad'; end if;
  end if;

  if p_action = 'eliminate' then
    if v.elimination_date is null then
      v.elimination_date := v.simulated_date;
      v.elimination_reason := 'Alkohol';
    end if;
  elsif p_action = 'uncomplete' then
    if coalesce(p_payload->>'cell','') !~ '^(0|[1-9]|1[0-9]|2[0-4])$' then
      raise exception 'Invalid bingo cell' using errcode = '22023';
    end if;
    v.completed_cells := v.completed_cells - (p_payload->>'cell');
    select coalesce(array_agg(distinct value::date order by value::date), '{}'::date[])
      into v.activity_dates from pg_catalog.jsonb_each_text(v.completed_cells);
  elsif p_action = 'complete' then
    if v.elimination_date is not null then
      raise exception 'Du är utslagen i testet. Återställ testdeltagaren för att fortsätta.' using errcode = '42501';
    end if;
    if v.simulated_date > date '2026-10-11' then
      raise exception 'Bingoperioden är avslutad i testet.' using errcode = '22023';
    end if;
    if coalesce(p_payload->>'cell','') !~ '^(0|[1-9]|1[0-9]|2[0-4])$' then
      raise exception 'Invalid bingo cell' using errcode = '22023';
    end if;
    v_cell := (p_payload->>'cell')::integer;
    v_new_completion := not (v.completed_cells ? v_cell::text);
    if v_new_completion then
      v.completed_cells := v.completed_cells || jsonb_build_object(v_cell::text, v.simulated_date::text);
    end if;
    v_new_activity := not (v.simulated_date = any(v.activity_dates));
    if v_new_activity then v.activity_dates := array_append(v.activity_dates, v.simulated_date); end if;
  end if;

  if p_action = 'complete' then
    select coalesce(array_agg(distinct value::date order by value::date), '{}'::date[])
      into v.activity_dates from pg_catalog.jsonb_each_text(v.completed_cells);
  end if;
  update public.bingo_test_sessions
  set board=v.board,completed_cells=v.completed_cells,activity_dates=v.activity_dates,
    simulated_date=v.simulated_date,elimination_date=v.elimination_date,
    elimination_reason=v.elimination_reason,auto_check_after=v.auto_check_after,updated_at=now()
  where admin_user_id=v_user;
  return (to_jsonb(v) - 'admin_user_id' - 'updated_at' - 'auto_check_after')
    || jsonb_build_object('score',private.bingo_test_score(v.completed_cells),
      'new_completion',v_new_completion,'new_activity',v_new_activity);
end;
$test$;
