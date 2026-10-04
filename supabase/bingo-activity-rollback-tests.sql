-- Run inside BEGIN/ROLLBACK; fixture users and all events are rolled back.
create temporary table feed_checks(label text);
create function pg_temp.check_feed(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; insert into feed_checks values(label); end; $$;
insert into auth.users(id) values('22222222-3333-4444-8555-666666666661'),('22222222-3333-4444-8555-666666666662');
insert into public.profiles(id,email,display_name,auto_elimination_recheck_after) values
('22222222-3333-4444-8555-666666666661','feed-one@example.invalid','Feed fixture one','2026-10-04'),
('22222222-3333-4444-8555-666666666662','feed-two@example.invalid','Feed fixture two','2026-10-04');
select set_config('request.jwt.claims','{"sub":"22222222-3333-4444-8555-666666666661","role":"authenticated"}',true);
select private.bingo_mutation('complete','2026-10-05',7,'2026-10-05T12:00:00+02');
select pg_temp.check_feed((select count(*)=1 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and is_active),'First square creates one event');
select pg_temp.check_feed((select activity_type='bingo_cell' and activity_label='Cykla till jobbet' and multiplier is null from public.get_activity_feed(51,0) where display_name='Feed fixture one'),'Feed contains full task description and no multiplier for bingo');
select private.bingo_mutation('complete','2026-10-05',7,'2026-10-05T12:01:00+02');
select pg_temp.check_feed((select count(*)=1 and min(event_at)=timestamptz '2026-10-05T12:00:00+02' from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and is_active),'Repeated complete is not a new event');
select private.bingo_mutation('repeat','2026-10-06',7,'2026-10-06T12:00:00+02');
select pg_temp.check_feed((select count(*)=1 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and is_active),'Attendance repeat adds no fake achievement');
select private.bingo_mutation('uncomplete','2026-10-05',7,'2026-10-06T12:01:00+02');
select pg_temp.check_feed((select count(*)=0 from public.get_activity_feed(51,0) where display_name='Feed fixture one'),'Undo withdraws square from public feed');
select pg_temp.check_feed((select count(*)=1 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and not is_active),'Undo retains private audit row');
select private.bingo_mutation('complete','2026-10-05',7,'2026-10-06T12:02:00+02');
select pg_temp.check_feed((select count(*)=1 and min(event_at)=timestamptz '2026-10-06T12:02:00+02' from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and is_active),'Recomplete reactivates once with fresh click time');
update public.bingo_results set completed_cells=(select jsonb_object_agg(i::text,'2026-10-05') from generate_series(0,24)i),updated_at=timestamptz '2026-10-06T13:00:00+02' where user_id='22222222-3333-4444-8555-666666666661';
select pg_temp.check_feed((select count(*)=10 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and activity_type='bingo_row' and is_active),'Horizontal and vertical rows both celebrated');
select pg_temp.check_feed((select count(*)=1 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and activity_type='bingo_full' and is_active),'Full board celebrated once');
select pg_temp.check_feed((select activity_type='bingo_full' from public.get_activity_feed(1,0)),'Milestone comes first when timestamps tie');
select pg_temp.check_feed((select count(*)=4 from public.get_activity_feed(4,0)),'Main feed limit is four');
select pg_temp.check_feed((select (private.bingo_score(completed_cells)->>'total_points')::integer=76 from public.bingo_results where user_id='22222222-3333-4444-8555-666666666661'),'Activity tracking preserves the new bonus scoring');
select private.bingo_mutation('uncomplete','2026-10-05',0,'2026-10-06T13:01:00+02');
select pg_temp.check_feed((select count(*)=8 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and activity_type='bingo_row' and is_active),'Undo withdraws only invalidated row and column');
select pg_temp.check_feed((select count(*)=0 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and activity_type='bingo_full' and is_active),'Undo withdraws full board celebration');
select pg_temp.check_feed((select event_at=timestamptz '2026-10-06T12:02:00+02' from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666661' and activity_key='cell:7'),'Unrelated square keeps original event time');
select set_config('request.jwt.claims','{"sub":"22222222-3333-4444-8555-666666666662","role":"authenticated"}',true);
select private.bingo_mutation('complete','2026-10-05',7,'2026-10-06T14:00:00+02');
select pg_temp.check_feed((select display_name='Feed fixture two' from public.get_activity_feed(1,0)),'Newest participant event sorts first');
select pg_temp.check_feed((select count(*)=1 from private.bingo_activity_events where user_id='22222222-3333-4444-8555-666666666662'),'Participants have separate event keys');
select pg_temp.check_feed(not has_table_privilege('anon','private.bingo_activity_events','select') and not has_table_privilege('authenticated','private.bingo_activity_events','select') and not has_table_privilege('authenticated','private.bingo_activity_events','insert'),'No raw log access or client writes');
select pg_temp.check_feed(not has_function_privilege('authenticated','private.sync_bingo_activity(uuid,jsonb,timestamptz)','execute'),'Client cannot forge event user or clock');
select pg_temp.check_feed((select relrowsecurity from pg_class where oid='private.bingo_activity_events'::regclass),'Private event table has RLS');
grant insert on feed_checks to anon;
set local role anon;
select pg_temp.check_feed((select count(*)=4 from public.get_activity_feed(4,0)),'Anonymous feed works');
reset role;
select pg_temp.check_feed((select bool_and(key=any(array['display_name','multiplier','activity_type','event_at','result_date','activity_label'])) from public.get_activity_feed(51,0) f cross join lateral jsonb_object_keys(to_jsonb(f)) key),'Only intended fields returned publicly');
select pg_temp.check_feed((select coalesce(jsonb_agg(to_jsonb(f))::text,'') not like '%22222222-3333-4444-8555-%' from public.get_activity_feed(51,0) f),'No user UUID in public feed');
select jsonb_agg(label) checks_passed from feed_checks;
