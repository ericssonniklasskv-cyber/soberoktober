-- TEST ONLY, after BEGIN + production migration; roll back after this file.
create or replace function private.workout_vote_clock()returns timestamptz language sql stable set search_path=''as $$select coalesce(nullif(current_setting('test.vote_clock',true),'')::timestamptz,statement_timestamp());$$;
do $$begin execute replace(pg_get_functiondef('private.workout_vote_action(text,date,integer)'::regprocedure),'clock_timestamp()','private.workout_vote_clock()');end;$$;
do $$begin execute replace(pg_get_functiondef('private.workout_vote_tick()'::regprocedure),'clock_timestamp()','private.workout_vote_clock()');end;$$;
create function private.fixture_vote_admin(p_action text,p_now timestamptz default null)returns jsonb language plpgsql set search_path=''as $$begin
 if p_action='reset'then
  delete from private.workout_vote_completions where workout_date between date '2026-10-19'and date '2026-10-25';
  delete from private.workout_vote_votes where workout_date between date '2026-10-19'and date '2026-10-25';
  delete from private.workout_vote_results where workout_date between date '2026-10-19'and date '2026-10-25';
  delete from private.workout_vote_options where workout_date between date '2026-10-19'and date '2026-10-25';
  delete from private.workout_vote_draws where workout_date between date '2026-10-19'and date '2026-10-25';
  perform set_config('test.vote_clock','2026-10-18 20:59+02',true);perform private.workout_vote_prepare();
 else perform set_config('test.vote_clock',p_now::text,true);end if;
 perform private.workout_vote_tick();return private.workout_vote_state(auth.uid(),private.workout_vote_clock());
end;$$;
do $$declare actor uuid:=gen_random_uuid();s jsonb;begin
 insert into auth.users(id,email)values(actor,actor::text||'@example.invalid');
 insert into public.profiles(id,email,display_name)values(actor,actor::text||'@example.invalid','Production vote fixture');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform private.fixture_vote_admin('reset');
 begin perform public.my_workout_vote('vote','2026-10-19',0);raise exception 'Early Sunday vote accepted';exception when insufficient_privilege then null;end;
 perform private.fixture_vote_admin('clock','2026-10-18 21:00+02');
 perform public.my_workout_vote('vote','2026-10-19',0);
 begin perform public.my_workout_vote('vote','2026-10-19',1);raise exception 'Duplicate vote accepted';exception when unique_violation then null;end;
 perform private.fixture_vote_admin('clock','2026-10-19 00:00+02');
 begin perform public.my_workout_vote('vote','2026-10-19',1);raise exception 'Late vote accepted';exception when insufficient_privilege then null;end;
 perform public.my_workout_vote('complete','2026-10-19');perform public.my_workout_vote('complete','2026-10-19');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=3 and completed_days=1)then raise exception 'Wrong workout points';end if;
 begin perform public.my_workout_vote('steps','2026-10-19');raise exception 'Both alternatives accepted';exception when insufficient_privilege then null;end;
 perform public.my_workout_vote('uncomplete','2026-10-19');perform public.my_workout_vote('steps','2026-10-19');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=1 and completed_days=1)then raise exception 'Wrong step points';end if;
 perform public.my_workout_vote('uncomplete','2026-10-19');
 if not exists(select 1 from private.workout_vote_completions where user_id=actor and kind='steps')then raise exception 'Stale undo removed steps';end if;
 begin perform public.my_workout_vote('vote','2026-10-20',0);raise exception 'Early weekday vote accepted';exception when insufficient_privilege then null;end;
 perform private.fixture_vote_admin('clock','2026-10-19 15:00+02');perform public.my_workout_vote('vote','2026-10-20',0);
 perform private.fixture_vote_admin('clock','2026-10-25 00:00+02');
 if (select count(*)from private.workout_vote_results)<>7 then raise exception 'Cron did not settle all polls';end if;
 s:=public.my_workout_vote();if(s->>'simulated')::boolean then raise exception 'Production reports a test clock';end if;
 if has_function_privilege('anon','public.my_workout_vote(text,date,integer)','execute')or has_table_privilege('authenticated','private.workout_vote_completions','insert')then raise exception 'Unauthorized write access';end if;
 perform private.fixture_vote_admin('reset');
end;$$;
create temporary table catalog_fixture on commit drop as select * from private.workout_vote_catalog;
do $$
declare actor uuid:=gen_random_uuid(); baseline jsonb; frozen jsonb; signatures text[]:='{}'; signature text; i integer; denied boolean:=false;
begin
 insert into auth.users(id,email)values(actor,actor::text||'@example.invalid');
 insert into public.profiles(id,email,display_name,is_admin)values(actor,actor::text||'@example.invalid','Random draw SQL fixture',true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if (select count(*)from private.workout_vote_catalog)<>20 then raise exception 'Expected 20 activities';end if;
 if exists(select 1 from private.workout_vote_catalog where task_id in('bingo-0','bingo-21','bingo-22'))then raise exception 'Removed activities still eligible';end if;
 if (select count(*)from private.workout_vote_catalog where task_id in('strength-squats-3x15','strength-pushups-3x10','strength-pullups-3x5'))<>3 then raise exception 'Missing new strength activities';end if;

 for i in 1..50 loop
  perform private.fixture_vote_admin('reset');
  if (select count(*)from private.workout_vote_options)<>28 or (select count(*)from private.workout_vote_draws where source='random')<>7 then raise exception 'Expected seven complete random polls';end if;
  if exists(select workout_date from private.workout_vote_options group by workout_date having count(*)<>4 or count(distinct task->>'vote_id')<>4)then raise exception 'Duplicate or missing daily activity';end if;
  if exists(select 1 from private.workout_vote_options o where not exists(select 1 from private.workout_vote_catalog c where c.task_id=o.task->>'vote_id'and c.task=o.task))then raise exception 'Draw outside current catalogue';end if;
  if exists(select 1 from private.workout_vote_options a join private.workout_vote_options b on b.workout_date between a.workout_date+1 and a.workout_date+2 and b.task->>'vote_id'=a.task->>'vote_id')then raise exception 'Activity returns within two-day cooldown';end if;
  select md5(string_agg(task::text,'|'order by workout_date,option_id))into signature from private.workout_vote_options;
  signatures:=array_append(signatures,signature);
 end loop;
 if (select count(distinct s)from unnest(signatures)s)<2 then raise exception 'Reset never changes the random draw';end if;
 select jsonb_agg(to_jsonb(o)order by workout_date,option_id)into baseline from private.workout_vote_options o;
 perform private.workout_vote_prepare();
 if baseline is distinct from(select jsonb_agg(to_jsonb(o)order by workout_date,option_id)from private.workout_vote_options o)then raise exception 'Repeated seed reshuffles stable options';end if;

 -- Even catalogue changes cannot change an opened poll or its saved vote/winner.
 perform private.fixture_vote_admin('clock','2026-10-18 21:00+02');
 perform public.my_workout_vote('vote','2026-10-19',0);
 select jsonb_agg(to_jsonb(o)order by option_id)into frozen from private.workout_vote_options o where workout_date='2026-10-19';
 update private.workout_vote_catalog set task=task||jsonb_build_object('fixture_revision',1)where task_id='bingo-1';
 perform private.workout_vote_prepare();
 if frozen is distinct from(select jsonb_agg(to_jsonb(o)order by option_id)from private.workout_vote_options o where workout_date='2026-10-19')then raise exception 'Opened poll changed';end if;
 perform private.fixture_vote_admin('clock','2026-10-19 00:00+02');
 perform public.my_workout_vote('complete','2026-10-19');
 update private.workout_vote_catalog set task=task||jsonb_build_object('fixture_revision',2)where task_id='bingo-1';
 perform private.workout_vote_prepare();
 if frozen is distinct from(select jsonb_agg(to_jsonb(o)order by option_id)from private.workout_vote_options o where workout_date='2026-10-19')
 or not exists(select 1 from private.workout_vote_votes where workout_date='2026-10-19'and user_id=actor and option_id=0)
 or not exists(select 1 from private.workout_vote_results where workout_date='2026-10-19'and option_id=0 and total_votes=1)
 or not exists(select 1 from private.workout_vote_completions where workout_date='2026-10-19'and user_id=actor and points=3)then raise exception 'Existing vote, winner or completion changed';end if;

 -- Too small a pool must fail atomically, leaving previous draws/results intact.
 select jsonb_agg(to_jsonb(o)order by workout_date,option_id)into baseline from private.workout_vote_options o;
 begin
  delete from private.workout_vote_catalog where task_id<>'bingo-1';
  perform private.fixture_vote_admin('reset');
 exception when raise_exception then
  if sqlerrm not like 'Not enough distinct activities%'then raise;end if;
  denied:=true;
 end;
 if not denied or baseline is distinct from(select jsonb_agg(to_jsonb(o)order by workout_date,option_id)from private.workout_vote_options o)
 or not exists(select 1 from private.workout_vote_completions where user_id=actor)then raise exception 'Failed draw partially destroyed saved data';end if;

 -- Twelve activities force three disjoint groups of four. The Monday group must
 -- return Thursday: proves the third day is eligible, and variants are distinct.
 update private.workout_vote_catalog c set task=f.task from pg_temp.catalog_fixture f where c.task_id=f.task_id;
 perform private.fixture_vote_admin('reset');
 delete from private.workout_vote_options where workout_date between date '2026-10-19'and date '2026-10-25';
 delete from private.workout_vote_draws where workout_date between date '2026-10-19'and date '2026-10-25';
 delete from private.workout_vote_catalog where task_id not in(
 'bingo-10','strength-squats-3x15','strength-pushups-3x10','strength-pullups-3x5',
 'bingo-1','bingo-2','bingo-3','bingo-4','bingo-6','bingo-7','bingo-8','bingo-9');
 insert into private.workout_vote_options(workout_date,option_id,task)
 select date '2026-10-19',(row_number()over(order by task_id)-1)::integer,task from private.workout_vote_catalog where task_id in('bingo-10','strength-squats-3x15','strength-pushups-3x10','strength-pullups-3x5');
 perform set_config('test.vote_clock','2026-10-18 21:00+02',true);
 perform private.workout_vote_prepare();
 if (select count(*)from private.workout_vote_options where workout_date='2026-10-19'and task->>'vote_id'in('bingo-10','strength-squats-3x15'))<>2 then raise exception 'Different squat workouts cannot coexist';end if;
 if exists(select 1 from private.workout_vote_options a join private.workout_vote_options b on b.workout_date between a.workout_date+1 and a.workout_date+2 and b.task->>'vote_id'=a.task->>'vote_id')then raise exception 'Forced fixture violates cooldown';end if;
 if (select count(*)from private.workout_vote_options a join private.workout_vote_options b on b.workout_date=a.workout_date+3 and b.task->>'vote_id'=a.task->>'vote_id'where a.workout_date='2026-10-19')<>4 then raise exception 'Activities not eligible again on third day';end if;
 begin
  update private.workout_vote_options set task=(select task from private.workout_vote_options where workout_date='2026-10-19'and option_id=0)where workout_date='2026-10-19'and option_id=1;
  raise exception 'Duplicate activity accepted';
 exception when unique_violation then null;
 end;
 if has_table_privilege('authenticated','private.workout_vote_catalog','SELECT')or has_table_privilege('authenticated','private.workout_vote_draws','INSERT')
 or has_function_privilege('authenticated','private.workout_vote_prepare()','EXECUTE')or has_function_privilege('anon','private.workout_vote_prepare()','EXECUTE')then raise exception 'Draw internals exposed';end if;
 raise notice 'PASS: 50 random weeks, 4 unique choices, exact two-day cooldown, third-day return, separate variants, stable draws, immutable open polls/votes/winners/points, atomic failure and private permissions.';
end $$;
