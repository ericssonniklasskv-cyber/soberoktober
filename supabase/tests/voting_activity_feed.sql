-- Run after the production voting migration + feed migration, inside BEGIN/ROLLBACK.
-- Never run fixtures against production.
create or replace function private.workout_vote_clock() returns timestamptz
language sql stable set search_path='' as $$select timestamptz '2026-10-19 12:00+02';$$;
do $$begin
  execute replace(pg_get_functiondef('private.workout_vote_action(text,date,integer)'::regprocedure),
    'clock_timestamp()','private.workout_vote_clock()');
end;$$;

do $$
declare
  actor uuid:=gen_random_uuid(); viewer uuid:=gen_random_uuid();
  key text; old_key text; payload jsonb; score_before jsonb; previous_events bigint;
begin
  insert into auth.users(id,email) values(actor,'vote-feed-actor@example.invalid'),(viewer,'vote-feed-viewer@example.invalid');
  insert into public.profiles(id,email,display_name) values
    (actor,'vote-feed-actor@example.invalid','Vote feed actor'),
    (viewer,'vote-feed-viewer@example.invalid','Vote feed viewer');
  select count(*) into previous_events from private.kudos_feed_events();
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.my_workout_vote('get');
  perform public.my_workout_vote('complete','2026-10-19');
  select activity_key into key from private.kudos_feed_events() where user_id=actor and activity_type='vote_pass';
  if key is null or key not like 'vote:%' or position(actor::text in key)>0 then raise exception 'Missing or unsafe vote activity key';end if;
  if not exists(select 1 from private.kudos_feed_events() e join private.workout_vote_completions c on c.user_id=e.user_id and c.workout_date=e.result_date
    where e.user_id=actor and e.event_at=c.completed_at and nullif(e.activity_label,'') is not null) then raise exception 'Wrong workout label or timestamp';end if;
  select to_jsonb(l) into score_before from public.get_leaderboard() l where is_current_user;
  if (score_before->>'total_points')::numeric<>3 or (score_before->>'completed_days')::bigint<>1 then raise exception 'Workout scoring changed';end if;
  perform public.my_workout_vote('complete','2026-10-19');
  if (select count(*)from private.kudos_feed_events()where user_id=actor)<>1
    or key<>(select activity_key from private.kudos_feed_events()where user_id=actor) then raise exception 'Retry duplicated activity';end if;

  select to_jsonb(f) into payload from public.get_activity_feed(51,0) f where display_name='Vote feed actor';
  if payload is null or payload ?| array['user_id','email','activity_key','is_admin'] or payload::text like '%'||actor::text||'%'
    or (select count(*)from jsonb_object_keys(payload))<>6 then raise exception 'Anonymous payload leaked data or missed the activity';end if;
  perform set_config('request.jwt.claim.sub',viewer::text,true);
  select to_jsonb(f) into payload from public.get_kudos_activity_feed(51,0)f where activity_key=key;
  if payload is null or payload->>'is_own'<>'false' or payload ?| array['user_id','email','is_admin'] then raise exception 'Authenticated feed wrong';end if;
  perform public.send_activity_kudos(key,'Snyggt!');
  perform public.send_activity_kudos(key,'Retry');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if public.get_my_kudos_unread_count()<>1 then raise exception 'Kudos not delivered exactly once';end if;
  if not exists(select 1 from public.get_kudos_activity_feed(51,0)where activity_key=key and is_own) then raise exception 'Owner marker missing';end if;

  old_key:=key;
  perform public.my_workout_vote('uncomplete','2026-10-19');
  if exists(select 1 from private.kudos_feed_events()where activity_key=old_key) then raise exception 'Undone workout still visible';end if;
  perform set_config('request.jwt.claim.sub',viewer::text,true);
  begin perform public.send_activity_kudos(old_key,null);raise exception 'Kudos accepted for undone activity';exception when invalid_parameter_value then null;end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.my_workout_vote('steps','2026-10-19');
  select activity_key into key from private.kudos_feed_events()where user_id=actor and activity_type='vote_steps';
  if key is null or key=old_key or not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=1 and completed_days=1) then raise exception 'Step replacement incorrect';end if;
  perform public.my_workout_vote('steps','2026-10-19');
  perform public.my_workout_vote('uncomplete','2026-10-19');
  if (select count(*)from private.kudos_feed_events()where user_id=actor)<>1 then raise exception 'Duplicate or stale undo changed steps';end if;
  perform public.my_workout_vote('unsteps','2026-10-19');
  if exists(select 1 from private.kudos_feed_events()where user_id=actor) then raise exception 'Undone steps still visible';end if;
  perform public.my_workout_vote('complete','2026-10-19');
  if old_key=(select activity_key from private.kudos_feed_events()where user_id=actor) then raise exception 'Re-completion reused an old kudos key';end if;
  perform public.my_workout_vote('uncomplete','2026-10-19');
  if (select count(*)from private.kudos_feed_events())<>previous_events then raise exception 'Earlier activities changed';end if;

  if has_table_privilege('anon','private.workout_vote_completions','select')
    or has_table_privilege('authenticated','private.workout_vote_completions','select')
    or has_sequence_privilege('authenticated','private.workout_vote_completions_activity_id_seq','usage')
    or has_function_privilege('authenticated','private.kudos_feed_events()','execute') then raise exception 'Private source exposed';end if;
  raise notice 'PASS: vote completion/steps, stable retry, undo/re-complete, existing feed, public privacy, private source, own marker and kudos delivery.';
end;$$;
