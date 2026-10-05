-- Run with the pending migration inside BEGIN/ROLLBACK. No real data persists.
create temporary table daily_bonus_checks(label text);
create function pg_temp.check_daily_bonus(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %', label; end if;
  insert into daily_bonus_checks values(label);
end;
$$;
insert into auth.users(id) values('33333333-2222-4333-8444-555555555555'),('33333333-2222-4333-8444-555555555556');
insert into public.profiles(id,email,display_name,auto_elimination_recheck_after) values
 ('33333333-2222-4333-8444-555555555555','bonus-one@example.invalid','Bonus fixture one', (timezone('Europe/Stockholm',now()))::date-1),
 ('33333333-2222-4333-8444-555555555556','bonus-two@example.invalid','Bonus fixture two', (timezone('Europe/Stockholm',now()))::date-1);
insert into public.daily_challenges(challenge_date,title,bonus_description,bonus_points)
 values('2026-10-05','Dagens bingo','Gå en extra promenad',1)
 on conflict(challenge_date) do update set bonus_description=excluded.bonus_description,bonus_points=excluded.bonus_points;
select set_config('request.jwt.claims','{"sub":"33333333-2222-4333-8444-555555555555","role":"authenticated"}',true);
select pg_temp.check_daily_bonus((public.self_daily_result('2026-10-05')->>'bonus_points') is null,'No bonus claimed initially');
select pg_temp.check_daily_bonus((public.self_daily_result('2026-10-05','save','{"expected":null,"multiplier":null,"claim_bonus":true,"expected_bonus_points":null,"points":9999}')->>'bonus_points')::integer=1,'Bonus before bingo uses configured one point, not client value');
select pg_temp.check_daily_bonus((select count(*)=0 from public.daily_results where user_id='33333333-2222-4333-8444-555555555555'),'Bonus creates no daily workout');
select pg_temp.check_daily_bonus(not private.competition_day_complete('33333333-2222-4333-8444-555555555555','2026-10-05'),'Bonus alone does not satisfy daily attendance');
select pg_temp.check_daily_bonus((select total_points=1 and completed_days=0 from public.get_leaderboard() where display_name='Bonus fixture one'),'Leaderboard includes independent bonus, zero completed days');
select public.self_daily_result('2026-10-05','save','{"expected":null,"multiplier":null,"claim_bonus":true,"expected_bonus_points":null}');
select pg_temp.check_daily_bonus((select count(*)=1 and sum(points)=1 from public.daily_bonus_claims where user_id='33333333-2222-4333-8444-555555555555'),'Repeat claim is idempotent');
do $$ begin begin
 perform public.self_daily_result('2026-10-05','save','{"expected":null,"multiplier":null,"unclaim_bonus":true,"expected_bonus_points":2}');
 raise exception 'Stale undo accepted';
 exception when serialization_failure then null; end; end; $$;
select pg_temp.check_daily_bonus((public.self_daily_result('2026-10-05','save','{"expected":null,"multiplier":null,"unclaim_bonus":true,"expected_bonus_points":1}')->>'bonus_points') is null,'Uncheck removes only bonus');
select pg_temp.check_daily_bonus((select total_points=0 and completed_days=0 from public.get_leaderboard() where display_name='Bonus fixture one'),'Undo restores exact zero total');
select pg_temp.check_daily_bonus(public.claim_daily_bonus()=1,'Legacy bonus RPC also works during bingo');
select private.bingo_mutation('complete','2026-10-05',0,'2026-10-05T12:00:00+02');
select pg_temp.check_daily_bonus((select total_points=3 and completed_days=1 from public.get_leaderboard() where display_name='Bonus fixture one'),'Bingo first cell plus separate bonus gives three points and one completed day');
do $$ begin begin
 perform public.self_daily_result('2026-10-05','save','{"expected":null,"multiplier":3,"completed_parts":["first"]}');
 raise exception 'Hidden normal workout accepted';
 exception when insufficient_privilege then null; end; end; $$;
select pg_temp.check_daily_bonus((select count(*)=0 from public.daily_results where user_id='33333333-2222-4333-8444-555555555555'),'Normal workouts remain blocked during bingo');
select set_config('request.jwt.claims','{"sub":"33333333-2222-4333-8444-555555555556","role":"authenticated"}',true);
grant insert on daily_bonus_checks to authenticated,anon;
set local role authenticated;
select pg_temp.check_daily_bonus((select count(*)=0 from public.daily_bonus_claims),'Other participant cannot read private bonus claim');
select pg_temp.check_daily_bonus((public.self_daily_result('2026-10-05')->>'bonus_points') is null,'Own RPC never returns another participant bonus');
do $$ begin begin
 insert into public.daily_bonus_claims(user_id,challenge_date,points) values('33333333-2222-4333-8444-555555555555','2026-10-06',999);
 raise exception 'Other participant write accepted';
 exception when insufficient_privilege then null; end; end; $$;
reset role;
select private.apply_elimination('33333333-2222-4333-8444-555555555556','Alkohol');
do $$ begin begin
 perform public.self_daily_result('2026-10-05','save','{"expected":null,"multiplier":null,"claim_bonus":true}');
 raise exception 'Eliminated bonus accepted';
 exception when insufficient_privilege then null; end; end; $$;
select pg_temp.check_daily_bonus((select count(*)=0 from public.daily_bonus_claims where user_id='33333333-2222-4333-8444-555555555556'),'Eliminated participant cannot earn new bonus');
select set_config('request.jwt.claims','{"sub":"33333333-2222-4333-8444-555555555555","role":"authenticated"}',true);
select private.apply_elimination('33333333-2222-4333-8444-555555555555','Alkohol');
select pg_temp.check_daily_bonus((select total_points=3 and is_eliminated from public.get_leaderboard() where display_name='Bonus fixture one'),'Historical bonus and bingo points retained after elimination');
select public.self_daily_result('2026-10-05','save','{"expected":null,"multiplier":null,"unclaim_bonus":true,"expected_bonus_points":1}');
select pg_temp.check_daily_bonus((select total_points=2 and is_eliminated from public.get_leaderboard() where display_name='Bonus fixture one'),'Undo is allowed without restoring alcohol elimination');
select set_config('request.jwt.claims','{}',true);
set local role anon;
select pg_temp.check_daily_bonus(not has_table_privilege('anon','public.daily_bonus_claims','select'),'Anonymous raw bonus access denied');
do $$ begin begin
 perform public.self_daily_result('2026-10-05');raise exception 'Anonymous bonus RPC accepted';
 exception when insufficient_privilege then null; end; end; $$;
select pg_temp.check_daily_bonus((select bool_and(key=any(array['rank_position','display_name','total_points','completed_days','is_current_user','is_eliminated'])) from public.get_leaderboard() r cross join lateral jsonb_object_keys(to_jsonb(r)) key),'Public leaderboard exposes only intended aggregate fields');
reset role;
select jsonb_agg(label) as daily_bonus_checks_passed from daily_bonus_checks;
