-- Local database only. The runner wraps fixtures and assertions in BEGIN/ROLLBACK.
create function pg_temp.assert_missed(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; raise notice 'PASS: %',label; end; $$;
insert into auth.users(id) values ('99999999-1111-4111-8111-111111111111'),('99999999-2222-4222-8222-222222222222');
insert into public.profiles(id,email,display_name,is_admin,auto_elimination_recheck_after) values
('99999999-1111-4111-8111-111111111111','missed-admin@example.invalid','Missed-day QA Admin',true,'2026-09-30'),
('99999999-2222-4222-8222-222222222222','missed-user@example.invalid','Missed-day QA User',false,'2026-09-30');
select pg_temp.assert_missed(not exists(select 1 from generate_series(date '2026-10-02',date '2026-11-01',interval '1 day') d where private.find_missed_day_elimination('99999999-2222-4222-8222-222222222222',d::date) is not null or private.evaluate_user_elimination('99999999-2222-4222-8222-222222222222',d::date) is not null),'Missing every day cannot eliminate now or later');
select pg_temp.assert_missed((select competition_status='active' from public.profiles where id='99999999-2222-4222-8222-222222222222'),'Participant remains active');
select pg_temp.assert_missed(not exists(select 1 from public.elimination_events where eliminated_user_id='99999999-2222-4222-8222-222222222222'),'No automatic elimination event');
select set_config('request.jwt.claims','{"sub":"99999999-2222-4222-8222-222222222222","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_missed((select status='active' from public.sync_competition_status()),'Login/status sync keeps the participant active');
do $$ begin
  begin perform public.admin_eliminate_participant('99999999-1111-4111-8111-111111111111'); raise exception 'Non-admin elimination accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"99999999-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
select public.admin_eliminate_participant('99999999-2222-4222-8222-222222222222');
reset role;
select pg_temp.assert_missed((select competition_status='eliminated' and elimination_reason='Alkohol' from public.profiles where id='99999999-2222-4222-8222-222222222222'),'Admin alcohol elimination still works');
select pg_temp.assert_missed(private.evaluate_user_elimination('99999999-2222-4222-8222-222222222222','2026-10-31') is null and (select competition_status='eliminated' and elimination_reason='Alkohol' from public.profiles where id='99999999-2222-4222-8222-222222222222'),'Disabled automatic checks preserve alcohol elimination');
select set_config('request.jwt.claims','{"sub":"99999999-2222-4222-8222-222222222222","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.assert_missed((select status='eliminated' and elimination_reason='Alkohol' from public.sync_competition_status()),'Participant login does not undo alcohol elimination');
reset role;
set local role anon;
do $$ begin
  begin perform public.admin_eliminate_participant('99999999-1111-4111-8111-111111111111'); raise exception 'Anonymous elimination accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
