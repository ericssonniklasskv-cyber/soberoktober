-- Local-only. Requires production_vote_release.sql fixtures in the same rollback transaction.
-- Override only the local transaction's existing clock-dependent bonus function.
do $$begin execute replace(pg_get_functiondef('private.self_daily_result(date,text,jsonb)'::regprocedure),'now()','private.workout_vote_clock()');end;$$;
do $$
declare admin_id uuid:=gen_random_uuid();actor uuid:=gen_random_uuid();s jsonb;affected integer;winner jsonb;
begin
 insert into auth.users(id,email)values(admin_id,admin_id::text||'@example.invalid'),(actor,actor::text||'@example.invalid');
 insert into public.profiles(id,email,display_name,is_admin)values(admin_id,admin_id::text||'@example.invalid','Voting bonus admin',true),(actor,actor::text||'@example.invalid','Voting bonus participant',false);
 perform private.fixture_vote_admin('reset');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 -- Real admin RLS path: no normal workout content is required.
 insert into public.daily_challenges(challenge_date,title,description,base_amount,unit,completion_mode,bonus_description,bonus_points)
 values('2026-10-19','Dagens val',null,null,null,'single','Bonus för röstveckan',2)
 on conflict(challenge_date)do update set title=excluded.title,description=null,base_amount=null,unit=null,completion_mode='single',second_description=null,second_base_amount=null,second_unit=null,bonus_description=excluded.bonus_description,bonus_points=excluded.bonus_points;
 execute 'reset role';
 perform private.fixture_vote_admin('clock','2026-10-19 00:00+02');
 select to_jsonb(r)into winner from private.workout_vote_results r where workout_date='2026-10-19';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 update public.daily_challenges set bonus_points=99 where challenge_date='2026-10-19';get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Participant changed admin bonus';end if;
 s:=public.self_daily_result('2026-10-19','save','{"expected":null,"multiplier":null,"claim_bonus":true,"expected_bonus_points":null,"points":999}');
 if(s->>'bonus_points')::integer<>2 then raise exception 'Bonus did not use configured points';end if;
 perform public.self_daily_result('2026-10-19','save','{"expected":null,"multiplier":null,"claim_bonus":true,"expected_bonus_points":2}');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=2 and completed_days=0)then raise exception 'Bonus alone counted training or duplicated points';end if;
 if not exists(select 1 from public.sync_competition_status()where status='active')then raise exception 'Missed days eliminated bonus participant';end if;
 perform public.my_workout_vote('complete','2026-10-19');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=5 and completed_days=1)then raise exception 'Workout plus bonus total wrong';end if;
 perform public.my_workout_vote('uncomplete','2026-10-19');perform public.my_workout_vote('steps','2026-10-19');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=3 and completed_days=1)then raise exception 'Steps plus bonus total wrong';end if;
 begin perform public.self_daily_result('2026-10-19','save','{"expected":null,"multiplier":null,"unclaim_bonus":true,"expected_bonus_points":1}');raise exception 'Stale bonus undo accepted';exception when serialization_failure then null;end;
 perform public.self_daily_result('2026-10-19','save','{"expected":null,"multiplier":null,"unclaim_bonus":true,"expected_bonus_points":2}');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=1 and completed_days=1)then raise exception 'Undo bonus also removed training';end if;
 begin perform public.self_daily_result('2026-10-19','save','{"expected":null,"multiplier":1,"completed_parts":["first"]}');raise exception 'Old workout registration accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if winner is distinct from(select to_jsonb(r)from private.workout_vote_results r where workout_date='2026-10-19')then raise exception 'Bonus editing changed the poll winner';end if;
 if exists(select 1 from public.elimination_events where eliminated_user_id=actor)then raise exception 'Bonus participant acquired an elimination event';end if;
 if exists(select 1 from public.daily_results where user_id=actor)then raise exception 'Bonus created a hidden normal workout';end if;
 if not exists(select 1 from private.workout_vote_completions where user_id=actor and kind='steps'and points=1)then raise exception 'Bonus undo changed step choice';end if;
 -- A two-way tie excludes the losing options and remains fixed on every read.
 perform private.fixture_vote_admin('reset');perform private.fixture_vote_admin('clock','2026-10-18 21:00+02');
 perform public.my_workout_vote('vote','2026-10-19',0);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 perform public.my_workout_vote('vote','2026-10-19',1);perform private.fixture_vote_admin('clock','2026-10-19 00:00+02');
 if not exists(select 1 from private.workout_vote_results where workout_date='2026-10-19'and total_votes=2 and tied_options=2 and option_id in(0,1))then raise exception 'Tie winner is not one of the tied leaders';end if;
 select to_jsonb(r)into winner from private.workout_vote_results r where workout_date='2026-10-19';perform public.my_workout_vote();perform public.my_workout_vote();
 if winner is distinct from(select to_jsonb(r)from private.workout_vote_results r where workout_date='2026-10-19')then raise exception 'Tie rerolled on refresh';end if;
 perform private.fixture_vote_admin('clock','2026-10-20 00:00+02');
 if not exists(select 1 from private.workout_vote_results where workout_date='2026-10-20'and total_votes=0 and tied_options=4 and option_id between 0 and 3)then raise exception 'Empty poll did not choose one fixed winner';end if;
 raise notice 'PASS bonus admin RLS, no workout required, configured points, idempotence, 2 bonus/5 pass+bonus/3 steps+bonus, independent undo, immutable winner, no missed-day elimination.';
end;$$;
