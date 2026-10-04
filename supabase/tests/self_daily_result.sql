begin;
-- Run with the migration inside BEGIN ... ROLLBACK. Only synthetic users survive within this transaction.
do $$
declare
 u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid();
 d jsonb; saved jsonb; old_event uuid; before_count integer; seed_date date;
begin
 insert into auth.users(id) values(u),(other_user);
 insert into public.profiles(id,email,display_name) values(u,'self-test@example.invalid','Self QA'),(other_user,'other-test@example.invalid','Other QA');
 insert into public.daily_challenges(challenge_date,title,description,base_amount,unit,completion_mode,bonus_description,bonus_points)
 select date '2026-10-01'+i,'QA pass','15 squats',15,'squats','single','QA bonus',2 from generate_series(0,2)i
 on conflict(challenge_date) do update set completion_mode='single',second_description=null,second_base_amount=null,second_unit=null,bonus_description='QA bonus',bonus_points=2;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 -- Fill later closed days so the same assertions remain valid after October 4.
 for seed_date in select day::date from generate_series(date '2026-10-04',least((timezone('Europe/Stockholm',now()))::date-1,date '2026-10-31'),interval '1 day') day loop
   insert into private.self_result_write_context values(txid_current(),u,seed_date);
   insert into public.daily_results(user_id,result_date,multiplier,completed_parts) values(u,seed_date,1,array['first']);
   delete from private.self_result_write_context where transaction_id=txid_current();
 end loop;
 perform private.evaluate_user_elimination(u,(timezone('Europe/Stockholm',now()))::date-1);
 select current_elimination_event_id into old_event from public.profiles where id=u;
 if old_event is null then raise exception 'Expected initial elimination'; end if;
 -- Bonus before a workout must not create a daily result or a false restoration.
 d:=public.self_daily_result('2026-10-01');
 saved:=public.self_daily_result('2026-10-01','save',jsonb_build_object('expected',d->'result','multiplier',null,'claim_bonus',true));
 if saved->>'bonus_points'<>'2' or saved->'result'<>'null'::jsonb or saved->>'restored'<>'false' then raise exception 'Bonus-only mismatch'; end if;
 saved:=public.self_daily_result('2026-10-01','save',jsonb_build_object('expected',null,'multiplier',1,'completed_parts',jsonb_build_array('first'),'claim_bonus',true));
 if saved->'result'->>'points'<>'1.0' or saved->>'restored'<>'false' then raise exception 'First result mismatch'; end if;
 -- A stale form cannot overwrite a newer result.
 begin
   perform public.self_daily_result('2026-10-01','save',jsonb_build_object('expected',null,'multiplier',3,'completed_parts',jsonb_build_array('first')));
   raise exception 'Stale request accepted';
 exception when serialization_failure then null; end;
 d:=saved;
 saved:=public.self_daily_result('2026-10-01','save',jsonb_build_object('expected',d->'result','multiplier',2,'completed_parts',jsonb_build_array('first')));
 if saved->'result'->>'points'<>'1.5' then raise exception 'Upgrade mismatch'; end if;
 if (select count(*) from public.daily_results where user_id=u and result_date='2026-10-01')<>1 then raise exception 'Duplicate result'; end if;
 if (select count(*) from public.daily_bonus_claims where user_id=u and challenge_date='2026-10-01')<>1 then raise exception 'Duplicate bonus'; end if;
 saved:=public.self_daily_result('2026-10-02','save',jsonb_build_object('expected',null,'multiplier',3,'completed_parts',jsonb_build_array('first')));
 if saved->>'restored'<>'true' or saved->'result'->>'points'<>'2.0' then raise exception 'Restore mismatch'; end if;
 if (select competition_status from public.profiles where id=u)<>'active' then raise exception 'Not active'; end if;
 if (select is_active from public.elimination_events where event_id=old_event) then raise exception 'Old notice still active'; end if;
 -- Ordinary role can invoke the endpoint, but cannot access the context table or another user.
 perform set_config('role','authenticated',true);
 d:=public.self_daily_result('2026-10-01');
 if d->'result'->>'multiplier'<>'2' then raise exception 'Authenticated read mismatch'; end if;
 begin
   perform public.self_daily_result((timezone('Europe/Stockholm',now()))::date+1,'save','{}');
   raise exception 'Future accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.self_daily_result('2026-10-03','save',jsonb_build_object('expected',null,'multiplier',9,'completed_parts',jsonb_build_array('first'),'user_id',other_user,'points',99));
   raise exception 'Invalid multiplier accepted';
 exception when invalid_parameter_value then null; end;
 begin
   insert into private.self_result_write_context values(txid_current(),u,'2026-10-01');
   raise exception 'Context writable';
 exception when insufficient_privilege then null; end;
 begin
   update public.profiles set is_admin=true where id=u;
   raise exception 'Admin privilege writable';
 exception when insufficient_privilege then null; end;
 -- Valid authenticated writes ignore arbitrary client points and user IDs.
 d:=public.self_daily_result('2026-10-01');
 saved:=public.self_daily_result('2026-10-01','save',jsonb_build_object('expected',d->'result','multiplier',1,'completed_parts',jsonb_build_array('first'),'user_id',other_user,'points',99));
 if saved->'result'->>'points'<>'1.0' then raise exception 'Client points were trusted'; end if;
 perform set_config('role','postgres',true);
 update public.daily_challenges set completion_mode='and',second_description='10 steps',second_base_amount=10,second_unit='steps' where challenge_date='2026-10-03';
 begin
   perform public.self_daily_result('2026-10-03','save',jsonb_build_object('expected',null,'multiplier',1,'completed_parts',jsonb_build_array('first')));
   raise exception 'Incomplete and accepted';
 exception when invalid_parameter_value then null; end;
 saved:=public.self_daily_result('2026-10-03','save',jsonb_build_object('expected',null,'multiplier',1,'completed_parts',jsonb_build_array('first','second')));
 update public.daily_challenges set completion_mode='or' where challenge_date='2026-10-03';
 d:=saved;
 saved:=public.self_daily_result('2026-10-03','save',jsonb_build_object('expected',d->'result','multiplier',2,'completed_parts',jsonb_build_array('second')));
 if saved->'result'->'completed_parts'<>jsonb_build_array('second') then raise exception 'Or part mismatch'; end if;

 perform private.apply_elimination(u,'Alkohol');
 d:=public.self_daily_result('2026-10-01');
 saved:=public.self_daily_result('2026-10-01','save',jsonb_build_object('expected',d->'result','multiplier',1,'completed_parts',jsonb_build_array('first')));
 if saved->>'restored'<>'false' or (select competition_status from public.profiles where id=u)<>'eliminated' then raise exception 'Alcohol incorrectly restored'; end if;
 if exists(select 1 from public.daily_results where user_id=other_user) then raise exception 'Other user altered'; end if;
 if exists(select 1 from private.self_result_write_context) then raise exception 'Context leaked'; end if;
 if exists(select 1 from public.daily_result_activity_events where user_id=u) then raise exception 'Correction polluted live activity'; end if;
end; $$;
select 'self-result assertions passed' as result;

rollback;
