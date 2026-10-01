-- Admin-only sandbox. This table has no links to competition scoring or elimination.
create table public.bingo_test_sessions (
  admin_user_id uuid primary key references public.profiles(id) on delete cascade,
  board jsonb not null check (jsonb_typeof(board) = 'array' and jsonb_array_length(board) = 25),
  completed_cells jsonb not null default '{}'::jsonb check (jsonb_typeof(completed_cells) = 'object'),
  activity_dates date[] not null default '{}',
  simulated_date date not null default '2026-10-05' check (simulated_date between date '2026-10-05' and date '2026-10-12'),
  elimination_date date,
  elimination_reason text,
  auto_check_after date not null default '2026-10-04',
  updated_at timestamptz not null default now()
);
alter table public.bingo_test_sessions enable row level security;
revoke all on public.bingo_test_sessions from public, anon, authenticated;
grant select on public.bingo_test_sessions to authenticated;
create policy "Admins can read their own bingo sandbox"
on public.bingo_test_sessions for select to authenticated
using (admin_user_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin is true
));

create function private.default_bingo_test_board() returns jsonb
language sql immutable set search_path = ''
as $board$ select '[{"label":"Racketsport","description":"30 minuter racketsport","base_amount":30,"unit":"min racketsport"},{"label":"Löpning","description":"30 minuter löpning","base_amount":30,"unit":"min löpning"},{"label":"Utegym","description":"Ett pass på utegym","base_amount":1,"unit":"utegymspass"},{"label":"Långpromenad","description":"Långpromenad – minst 60 minuter","base_amount":60,"unit":"min långpromenad"},{"label":"Simning","description":"Ett simpass","base_amount":1,"unit":"simpass"},{"label":"Sprint","description":"Spring allt vad du kan i 20 meter – värm upp först","base_amount":20,"unit":"m sprint"},{"label":"Hopprep","description":"Hoppa hopprep 10 minuter totalt","base_amount":10,"unit":"min hopprep"},{"label":"Cykling","description":"Cykla minst 45 minuter","base_amount":45,"unit":"min cykling"},{"label":"15 000 steg","description":"Gå minst 15 000 steg på en dag","base_amount":15000,"unit":"steg"},{"label":"5 km promenad","description":"Ta en promenad på minst 5 km","base_amount":5,"unit":"km promenad"},{"label":"100 squats","description":"Gör 100 squats under en dag","base_amount":100,"unit":"squats"},{"label":"50 armhävningar","description":"Gör 50 armhävningar under en dag","base_amount":50,"unit":"armhävningar"},{"label":"10 pull-ups","description":"Gör totalt 10 pull-ups/chins – assisterade räknas","base_amount":10,"unit":"pull-ups/chins"},{"label":"Planka","description":"10 minuter planka totalt under dagen","base_amount":10,"unit":"min planka"},{"label":"100 utfall","description":"Gör 100 utfall totalt","base_amount":100,"unit":"utfall"},{"label":"Kroppsvikt","description":"Kör ett 20-minuters kroppsviktspass","base_amount":20,"unit":"min kroppsviktsträning"},{"label":"Trappträning","description":"Gå/jogga i trappor i 15 minuter","base_amount":15,"unit":"min trappträning"},{"label":"Yoga / rörlighet","description":"Testa yoga eller rörlighet i 30 minuter","base_amount":30,"unit":"min yoga/rörlighet"},{"label":"Dans","description":"Dansa i 30 minuter","base_amount":30,"unit":"min dans"},{"label":"Mobilfri promenad","description":"Ta en promenad utan mobil/podcast/musik i 45 minuter","base_amount":45,"unit":"min mobilfri promenad"},{"label":"Trotsa vädret","description":"Träna utomhus trots dåligt väder","base_amount":1,"unit":"pass i dåligt väder"},{"label":"Något nytt","description":"Testa en träningsform du aldrig gjort tidigare","base_amount":1,"unit":"ny träningsform"},{"label":"Träna ihop","description":"Gör en aktivitet tillsammans med någon annan","base_amount":1,"unit":"aktivitet med sällskap"},{"label":"Aktiv transport","description":"Ta dig någonstans till fots/cykel där du normalt hade tagit bil/buss","base_amount":1,"unit":"aktiv transport"},{"label":"Valfri aktivitet","description":"Välj valfri fysisk aktivitet och håll på i minst 60 minuter","base_amount":60,"unit":"min valfri aktivitet"}]'::jsonb; $board$;
revoke all on function private.default_bingo_test_board() from public, anon, authenticated;

create function private.bingo_test_score(p_cells jsonb) returns jsonb
language sql immutable set search_path = ''
as $score$
with cells as (
  select k::integer as cell from pg_catalog.jsonb_object_keys(p_cells) k
  where k ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
), completed_rows as (
  select cell / 5 as line from cells group by cell / 5 having count(*) = 5
), completed_columns as (
  select cell % 5 as line from cells group by cell % 5 having count(*) = 5
), totals as (
  select (select count(*)::integer from cells) as cell_points,
    (select count(*)::integer from completed_rows) + (select count(*)::integer from completed_columns) as line_points
)
select jsonb_build_object(
  'cell_points', cell_points, 'line_points', line_points,
  'full_board_points', case when cell_points = 25 then 10 else 0 end,
  'total_points', cell_points + line_points + case when cell_points = 25 then 10 else 0 end,
  'rows', coalesce((select jsonb_agg(line order by line) from completed_rows), '[]'::jsonb),
  'columns', coalesce((select jsonb_agg(line order by line) from completed_columns), '[]'::jsonb)
) from totals;
$score$;
revoke all on function private.bingo_test_score(jsonb) from public, anon, authenticated;

create function private.bingo_test_missed_pair(p_days date[], p_closed_through date, p_check_after date)
returns date language sql immutable set search_path = ''
as $missed$
select candidate.day::date + 1
from pg_catalog.generate_series(timestamp '2026-10-06', least(p_closed_through, date '2026-10-11')::timestamp, interval '1 day') candidate(day)
where candidate.day::date > p_check_after
  and not (candidate.day::date = any(p_days))
  and not ((candidate.day::date - 1) = any(p_days))
order by candidate.day limit 1;
$missed$;
revoke all on function private.bingo_test_missed_pair(date[], date, date) from public, anon, authenticated;

create function private.admin_bingo_test(p_action text, p_payload jsonb)
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
  if p_action is null or p_action not in ('get','complete','set_date','save_board','reset','eliminate','restore') then
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
revoke all on function private.admin_bingo_test(text,jsonb) from public, anon, authenticated;
grant execute on function private.admin_bingo_test(text,jsonb) to authenticated;

create function public.admin_bingo_test(p_action text default 'get', p_payload jsonb default '{}'::jsonb)
returns jsonb language sql set search_path = ''
as $rpc$ select private.admin_bingo_test(p_action,p_payload); $rpc$;
revoke all on function public.admin_bingo_test(text,jsonb) from public, anon, authenticated;
grant execute on function public.admin_bingo_test(text,jsonb) to authenticated;
