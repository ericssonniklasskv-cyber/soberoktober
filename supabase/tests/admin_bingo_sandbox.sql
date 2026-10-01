begin;
create temporary table bingo_live_snapshot on commit drop as select jsonb_build_object(
 'profiles',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.profiles t),
 'results',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_results t),
 'bonus',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_bonus_claims t),
 'steps',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.step_period_results t),
 'activities',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_result_activity_events t),
 'challenges',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_challenges t)) as fingerprint;

do $setup$ begin
  perform set_config('bingo.qa.admin',(select id::text from public.profiles where is_admin is true limit 1),true);
  perform set_config('bingo.qa.regular',(select id::text from public.profiles where is_admin is false and display_name is not null limit 1),true);
end $setup$;
set local role authenticated;
do $tests$
declare v jsonb; i integer; before_real jsonb; after_real jsonb;
begin
  perform set_config('request.jwt.claim.sub',current_setting('bingo.qa.admin'),true);
  v := public.admin_bingo_test('reset');
  if v->'score'->>'total_points' <> '0' then raise exception 'Reset failed'; end if;
  v := public.admin_bingo_test('complete',jsonb_build_object('cell',0));
  if v->'score'->>'total_points' <> '1' or v->>'new_completion' <> 'true' then raise exception 'First square failed'; end if;
  v := public.admin_bingo_test('complete',jsonb_build_object('cell',0));
  if v->'score'->>'total_points' <> '1' or v->>'new_completion' <> 'false' or v->>'new_activity' <> 'false' then raise exception 'Duplicate click scored twice'; end if;
  for i in 1..4 loop v:=public.admin_bingo_test('complete',jsonb_build_object('cell',i)); end loop;
  if v->'score'->>'total_points' <> '6' then raise exception 'Row bonus incorrect'; end if;
  for i in 1..4 loop v:=public.admin_bingo_test('complete',jsonb_build_object('cell',i*5)); end loop;
  if v->'score'->>'total_points' <> '11' then raise exception 'Column bonus incorrect'; end if;
  for i in 0..24 loop v:=public.admin_bingo_test('complete',jsonb_build_object('cell',i)); end loop;
  if v->'score'->>'total_points' <> '45' or v->'score'->>'line_points' <> '10' or v->'score'->>'full_board_points' <> '10' then raise exception 'Full board not 45'; end if;
  v:=public.admin_bingo_test('set_date','{"date":"2026-10-06"}');
  v:=public.admin_bingo_test('complete','{"cell":0}');
  if v->'score'->>'total_points' <> '45' or v->>'new_activity' <> 'true' or jsonb_array_length(v->'activity_dates')<>1 then raise exception 'Repeated cell added an activity day'; end if;
  v:=public.admin_bingo_test('uncomplete','{"cell":0}');
  v:=public.admin_bingo_test('complete','{"cell":0}');
  v:=public.admin_bingo_test('set_date','{"date":"2026-10-08"}');
  if v->>'elimination_date' is not null then raise exception 'One missed day eliminated participant'; end if;
  v:=public.admin_bingo_test('set_date','{"date":"2026-10-09"}');
  if v->>'elimination_date' <> '2026-10-09' or v->>'elimination_reason'<>'Två missade dagar i rad' then raise exception 'Two closed missed days not eliminated'; end if;
  begin
    perform public.admin_bingo_test('complete','{"cell":1}');
    raise exception 'Eliminated sandbox participant could score';
  exception when insufficient_privilege then null; end;
  v:=public.admin_bingo_test('restore');
  if v->>'elimination_date' is not null then raise exception 'Restore failed'; end if;
  v:=public.admin_bingo_test('complete','{"cell":1}');
  v:=public.admin_bingo_test('eliminate');
  if v->>'elimination_reason'<>'Alkohol' then raise exception 'Alcohol elimination failed'; end if;
  v:=public.admin_bingo_test('reset');
  v:=public.admin_bingo_test('set_date','{"date":"2026-10-06"}');
  if v->>'elimination_date' is not null then raise exception 'Today or future day counted missed'; end if;
  v:=public.admin_bingo_test('set_date','{"date":"2026-10-07"}');
  if v->>'elimination_date'<>'2026-10-07' then raise exception '5 and 6 October miss not detected'; end if;
  v:=public.admin_bingo_test('reset');
  begin
    perform public.admin_bingo_test('complete','{"cell":25}');
    raise exception 'Invalid cell accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_bingo_test('save_board','{"board":[]}');
    raise exception 'Invalid board accepted';
  exception when invalid_parameter_value then null; end;
  v:=public.admin_bingo_test('save_board',jsonb_build_object('board',v->'board'));
  if v->'board'->0->>'description' <> '30 minuter racketsport' then raise exception 'Board save failed'; end if;
  begin
    update public.bingo_test_sessions set elimination_date=null;
    raise exception 'Direct sandbox write allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('bingo.qa.regular'),true);
  if exists(select 1 from public.bingo_test_sessions) then raise exception 'Regular user read sandbox'; end if;
  begin
    perform public.admin_bingo_test('get');
    raise exception 'Regular user RPC allowed';
  exception when insufficient_privilege then null; end;
end $tests$;
set local role anon;
do $tests$ begin
  begin perform public.admin_bingo_test('get'); raise exception 'Anon RPC allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.bingo_test_sessions; raise exception 'Anon read allowed';
  exception when insufficient_privilege then null; end;
end $tests$;
reset role;

do $assert$ begin if (select jsonb_build_object(
 'profiles',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.profiles t),
 'results',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_results t),
 'bonus',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_bonus_claims t),
 'steps',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.step_period_results t),
 'activities',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_result_activity_events t),
 'challenges',(select md5(coalesce(string_agg(t::text,',' order by t::text),'')) from public.daily_challenges t))) is distinct from (select fingerprint from bingo_live_snapshot) then raise exception 'Live competition data changed during sandbox test'; end if; end $assert$;
rollback;
select 'PASS: bingo sandbox tests and live-data fingerprint unchanged; all test data rolled back' as result;
