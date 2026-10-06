-- Invoke inside BEGIN/ROLLBACK against the local test database only.
create temporary table kudos_checks(label text);
create function pg_temp.check_kudos(ok boolean,label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %',label; end if;
  insert into kudos_checks values(label);
end; $$;
grant insert,select on kudos_checks to authenticated,anon;
insert into auth.users(id) values
('66666666-1111-4111-8111-111111111111'),
('66666666-2222-4222-8222-222222222222'),
('66666666-3333-4333-8333-333333333333');
insert into public.profiles(id,email,display_name,auto_elimination_recheck_after) values
('66666666-1111-4111-8111-111111111111','kudos-anna@example.invalid','Kudos fixture Anna','2026-10-06'),
('66666666-2222-4222-8222-222222222222','kudos-erik@example.invalid','Kudos fixture Erik','2026-10-06'),
('66666666-3333-4333-8333-333333333333','kudos-sara@example.invalid','Kudos fixture Sara','2026-10-06');
insert into public.daily_results(user_id,result_date,multiplier)
values('66666666-2222-4222-8222-222222222222','2026-10-01',1);
update public.daily_results set multiplier=2 where user_id='66666666-2222-4222-8222-222222222222';
insert into private.bingo_activity_events(user_id,activity_key,activity_type,cell_index,result_date,event_at)
values('66666666-2222-4222-8222-222222222222','cell:1','bingo_cell',1,'2026-10-06',now());
create temporary table kudos_targets as
select 'bingo:'||event_id as key from private.bingo_activity_events where user_id='66666666-2222-4222-8222-222222222222'
union all select 'daily:'||event_id from public.daily_result_activity_events where user_id='66666666-2222-4222-8222-222222222222';
grant select on kudos_targets to authenticated;

select set_config('request.jwt.claims','{"sub":"66666666-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.check_kudos((select count(*)=3 from public.get_kudos_activity_feed(51,0) where display_name='Kudos fixture Erik'),'Daily completions, upgrades and bingo share the kudos feed');
select pg_temp.check_kudos((select bool_and(not is_own and not kudos_sent) from public.get_kudos_activity_feed(51,0) where display_name='Kudos fixture Erik'),'Other participants initially accept kudos');
select public.send_activity_kudos(key,'   Snyggt jobbat!   ') from kudos_targets;
select public.send_activity_kudos(key,'Do not replace the original') from kudos_targets;
select pg_temp.check_kudos((select bool_and(kudos_sent) from public.get_kudos_activity_feed(51,0) where display_name='Kudos fixture Erik'),'Feed marks previously sent kudos');
select pg_temp.check_kudos((select count(*)=0 from public.get_my_activity_kudos(51,0)),'Sender cannot read recipient private messages');
do $$ begin
  begin perform public.send_activity_kudos('bingo:0',null); raise exception 'Unknown activity accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.send_activity_kudos((select key from kudos_targets limit 1),repeat('x',301)); raise exception 'Long message accepted'; exception when invalid_parameter_value then null; end;
  begin perform * from private.activity_kudos; raise exception 'Raw table accessible'; exception when insufficient_privilege then null; end;
  begin perform * from private.kudos_feed_events(); raise exception 'Raw feed helper accessible'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
select pg_temp.check_kudos((select count(*)=3 and bool_and(message='Snyggt jobbat!') from private.activity_kudos where sender_id='66666666-1111-4111-8111-111111111111'),'Duplicate sends are idempotent and text is trimmed');

select set_config('request.jwt.claims','{"sub":"66666666-3333-4333-8333-333333333333","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.check_kudos(public.get_my_kudos_unread_count()=0,'Third participant sees no private kudos');
select pg_temp.check_kudos(public.mark_activity_kudos_read(array['1'])=0,'Third participant cannot mark another participant notification');
reset role;

select set_config('request.jwt.claims','{"sub":"66666666-2222-4222-8222-222222222222","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.check_kudos(public.get_my_kudos_unread_count()=3,'Recipient gets one notification per event');
select pg_temp.check_kudos((select count(*)=3 and bool_and(message='Snyggt jobbat!' and sender_name='Kudos fixture Anna') from public.get_my_activity_kudos(51,0)),'Recipient sees sender and original private message');
select pg_temp.check_kudos((select bool_and(is_own) from public.get_kudos_activity_feed(51,0) where display_name='Kudos fixture Erik'),'Own activities are identified without user IDs');
do $$ begin
  begin perform public.send_activity_kudos((select key from kudos_targets limit 1),null); raise exception 'Self kudos accepted'; exception when invalid_parameter_value then null; end;
end; $$;
select pg_temp.check_kudos(public.mark_activity_kudos_read(array(select kudos_key from public.get_my_activity_kudos(51,0)))=3,'Recipient marks notifications read');
select pg_temp.check_kudos(public.get_my_kudos_unread_count()=0,'Read status persists in database');
select pg_temp.check_kudos(public.mark_activity_kudos_read(array(select kudos_key from public.get_my_activity_kudos(51,0)))=0,'Marking read twice is idempotent');
reset role;

-- Withdrawing a bingo square prevents fresh kudos; previous private messages stay.
update private.bingo_activity_events set is_active=false where user_id='66666666-2222-4222-8222-222222222222';
select set_config('request.jwt.claims','{"sub":"66666666-3333-4333-8333-333333333333","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.send_activity_kudos((select key from kudos_targets where key like 'bingo:%'),null); raise exception 'Withdrawn activity accepted'; exception when invalid_parameter_value then null; end;
end; $$;
reset role;
select pg_temp.check_kudos((select count(*)=3 from private.activity_kudos where recipient_id='66666666-2222-4222-8222-222222222222'),'Undo preserves existing private kudos');
select pg_temp.check_kudos((select relrowsecurity from pg_class where oid='private.activity_kudos'::regclass),'Raw kudos table has RLS');
select pg_temp.check_kudos(not has_table_privilege('authenticated','private.activity_kudos','select') and not has_table_privilege('anon','private.activity_kudos','select'),'No direct raw table privileges');

select set_config('request.jwt.claims','{}',true);
set local role anon;
select pg_temp.check_kudos((select count(*)>=2 from public.get_activity_feed(51,0)),'Anonymous feed still works');
do $$ begin
  begin perform * from public.get_my_activity_kudos(20,0); raise exception 'Anonymous inbox accepted'; exception when insufficient_privilege then null; end;
  begin perform public.send_activity_kudos('daily:1',null); raise exception 'Anonymous send accepted'; exception when insufficient_privilege then null; end;
  begin perform * from public.get_kudos_activity_feed(4,0); raise exception 'Anonymous personalized feed accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
select pg_temp.check_kudos((select bool_and(key=any(array['display_name','multiplier','activity_type','event_at','result_date','activity_label'])) from public.get_activity_feed(51,0) f cross join lateral jsonb_object_keys(to_jsonb(f)) key),'Public payload unchanged');
select pg_temp.check_kudos((select coalesce(jsonb_agg(to_jsonb(f))::text,'') not like '%66666666-%' from public.get_activity_feed(51,0) f),'Public feed exposes no participant IDs');
select count(*) checks_passed from kudos_checks;
