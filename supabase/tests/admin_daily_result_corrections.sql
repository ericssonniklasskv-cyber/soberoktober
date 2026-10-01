begin;
do $setup$ begin
 perform set_config('correction.qa.admin',(select id::text from public.profiles where is_admin is true limit 1),true);
 perform set_config('correction.qa.user',(select id::text from public.profiles where is_admin is false and nullif(btrim(display_name),'') is not null order by (select count(*) from public.daily_results where user_id=profiles.id) limit 1),true);
end $setup$;
set local role authenticated;
do $test$ declare v jsonb; old jsonb; level integer; u uuid:=current_setting('correction.qa.user')::uuid; begin
 perform set_config('request.jwt.claim.sub',current_setting('correction.qa.admin'),true);
 v:=public.admin_daily_result(u,date '2026-10-01');
 old:=v->'result';
 v:=public.admin_daily_result(u,date '2026-10-01','save',jsonb_build_object('multiplier',1,'completed_parts',jsonb_build_array('first'),'reason','QA rättning','expected',old));
 if v->'result'->>'points'<>'1.0' then raise exception '1x points'; end if;
 old:=v->'result';
 v:=public.admin_daily_result(u,date '2026-10-01','save',jsonb_build_object('multiplier',2,'completed_parts',jsonb_build_array('first'),'reason','QA uppdatering','expected',old));
 if (v->'result'->>'points')::numeric<>1.5 then raise exception '2x points'; end if;
 begin
  perform public.admin_daily_result(u,date '2026-10-01','save',jsonb_build_object('multiplier',3,'completed_parts',jsonb_build_array('first'),'reason','QA gammalt resultat','expected',old));
  raise exception 'Stale write accepted';
 exception when serialization_failure then null; end;
 v:=public.admin_daily_result(u,date '2026-10-01','save',jsonb_build_object('multiplier',3,'completed_parts',jsonb_build_array('first'),'reason','QA tredje nivå','expected',v->'result'));
 if (v->'result'->>'points')::numeric<>2 or jsonb_array_length(v->'history')<2 then raise exception '3x/audit'; end if;
 begin perform public.admin_daily_result(u,date '2026-11-01'); raise exception 'November accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.admin_daily_result(u,date '2026-10-31'); raise exception 'Future accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.admin_daily_result(u,date '2026-10-01','save',jsonb_build_object('multiplier',4,'completed_parts',jsonb_build_array('first'),'reason','QA','expected',v->'result'));raise exception 'Invalid level';exception when invalid_parameter_value then null;end;
 begin perform public.admin_daily_result(u,date '2026-10-01','save',jsonb_build_object('multiplier',1,'completed_parts',jsonb_build_array(),'reason','QA fel del','expected',v->'result'));raise exception 'Empty parts';exception when invalid_parameter_value then null;end;
 begin perform public.admin_daily_result(u,date '2026-10-01','save',jsonb_build_object('multiplier',1,'completed_parts',jsonb_build_array('first'),'reason','x','expected',v->'result'));raise exception 'Missing reason';exception when invalid_parameter_value then null;end;
end $test$;
reset role;
do $test$ begin
 if (select count(*) from public.daily_results where user_id=current_setting('correction.qa.user')::uuid and result_date='2026-10-01')<>1 then raise exception 'Duplicate row';end if;
end $test$;
-- Simulate elimination inside this rolled-back transaction: correction must never restore status.

set local role authenticated;
do $test$ declare v jsonb;u uuid:=current_setting('correction.qa.user')::uuid;begin
 perform set_config('request.jwt.claim.sub',current_setting('correction.qa.admin'),true);
 perform public.admin_eliminate_participant(u);
 v:=public.admin_daily_result(u,'2026-10-01');
 v:=public.admin_daily_result(u,'2026-10-01','save',jsonb_build_object('multiplier',1,'completed_parts',jsonb_build_array('first'),'reason','QA rättning utslagen','expected',v->'result'));
 if v->>'status'<>'eliminated' then raise exception 'Status changed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('correction.qa.user'),true);
 perform set_config('sober.admin_daily_correction','on',true);
 begin perform public.admin_daily_result(u,'2026-10-01');raise exception 'Regular access';exception when insufficient_privilege then null;end;
 begin
  insert into public.daily_results(user_id,result_date,multiplier,completed_parts) values(current_setting('correction.qa.admin')::uuid,'2026-10-01',1,array['first'])
  on conflict(user_id,result_date) do update set multiplier=excluded.multiplier;
  raise exception 'Cross user spoof';
 exception when insufficient_privilege then null;end;
 begin perform 1 from private.daily_result_corrections;raise exception 'Audit exposed';exception when insufficient_privilege then null;end;
end $test$;
set local role anon;
do $test$ begin begin perform public.admin_daily_result(current_setting('correction.qa.user')::uuid,'2026-10-01');raise exception 'Anon access';exception when insufficient_privilege then null;end;end $test$;
rollback;
select 'PASS: levels, audit, concurrency, dates, parts, reasons, eliminated status and access; all writes rolled back' as result;