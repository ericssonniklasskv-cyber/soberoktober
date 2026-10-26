-- LOCAL ONLY. Real migration against an original-route fixture, then rollback.
begin;
create temporary table route_qa_user as select gen_random_uuid()id;
insert into auth.users(id,email)select id,'route-qa-'||id||'@example.invalid'from route_qa_user;
insert into public.profiles(id,email,display_name)select id,'route-qa-'||id||'@example.invalid','Route migration QA'from route_qa_user;
insert into private.adventure_games(user_id)select id from route_qa_user;
do $$declare actor uuid:=(select id from route_qa_user);i integer;n integer:=0;b integer;ids text[]:=array['troll','witch','dragon','sphinx','kraken'];choices text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip'];begin
 for i in 1..36 loop
  n:=n+1;insert into private.adventure_events(user_id,seq,event_id,kind,exercise_id,event_date)values(actor,n,gen_random_uuid(),'exercise','squats','2026-10-26');
  if i%6=0 and i<36 then b:=i/6;n:=n+1;insert into private.adventure_events(user_id,seq,event_id,kind,boss_id,choice_id,event_date)values(actor,n,gen_random_uuid(),'boss',ids[b],choices[b],'2026-10-26');end if;
 end loop;
 insert into private.adventure_events(user_id,seq,event_id,kind,exercise_id,event_date)values(actor,n+1,gen_random_uuid(),'score','running','2026-10-26');
end$$;
create temporary table route_qa_before as select * from private.adventure_events where user_id=(select id from route_qa_user);
-- BEGIN_ACTUAL_ROUTE_MIGRATION
-- END_ACTUAL_ROUTE_MIGRATION
update private.adventure_settings set enabled=true;
create or replace function private.adventure_clock()returns timestamptz language sql volatile set search_path=''as $$select timestamptz '2026-10-26 12:00:00+01';$$;
do $$declare actor uuid:=(select id from route_qa_user);p jsonb;s jsonb;n integer;begin
 if exists(select * from route_qa_before except select * from private.adventure_events where user_id=actor)then raise exception 'An original event changed';end if;
 if(select count(*)from private.adventure_step_credits where user_id=actor)<>4 then raise exception 'Missing original checkpoint credits';end if;
 p:=private.adventure_progress(actor);
 if(p->>'position')::int<>60 or(p->>'bosses')::int<>5 or(p->>'points')::int<>1 or(p->>'pending')::int<>6 then raise exception 'Incorrect migrated progress: %',p;end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 s:=public.my_adventure('get','{"board_size":60}');
 if(s->'state'->>'version')::int<>3 or jsonb_array_length(s->'state'->'events')<>42 then raise exception 'Invalid state payload';end if;
 begin perform public.my_adventure('exercise',jsonb_build_object('board_size',36,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));raise exception 'Old client was accepted';exception when invalid_parameter_value then if SQLERRM not like 'Banan har blivit längre%'then raise;end if;end;
 s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats','stepCredits','{"fake":999}'::jsonb));
 if(private.adventure_progress(actor)->>'points')::int<>2 then raise exception 'Scoring was not preserved';end if;
 if has_table_privilege('authenticated','private.adventure_step_credits','insert')then raise exception 'Client can forge map credits';end if;
end$$;
rollback;
