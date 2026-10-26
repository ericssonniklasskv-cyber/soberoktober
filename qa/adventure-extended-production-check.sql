-- Explicitly approved production release check. No test data is committed.
begin;
set local statement_timeout='20s';
create temporary table route_live_qa on commit drop as select gen_random_uuid()id;
insert into auth.users(id,email)select id,'route-live-qa-'||id||'@example.invalid'from route_live_qa;
insert into public.profiles(id,email,display_name)select id,'route-live-qa-'||id||'@example.invalid','Temporary route check'from route_live_qa;
do $$declare actor uuid:=(select id from route_live_qa);s jsonb;p jsonb;i int;b int:=0;blocked boolean;request jsonb;ids text[]:=array['troll','witch','dragon','sphinx','kraken'];choices text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip'];begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 s:=public.my_adventure('get','{"board_size":60}');
 if(s->'state'->>'version')::int<>3 then raise exception 'Incorrect state version';end if;
 for i in 1..60 loop
  s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'exercise_id','squats','request_id',gen_random_uuid(),'expected_revision',s->>'revision'));
  p:=private.adventure_progress(actor);
  if(p->>'position')::int<>i or(p->>'points')::int<>0 then raise exception 'Incorrect step or premature points at %: %',i,p;end if;
  if i in(6,12,24,36,48)then
   b:=b+1;blocked:=false;
   begin perform public.my_adventure('exercise',jsonb_build_object('board_size',60,'exercise_id','running','request_id',gen_random_uuid(),'expected_revision',s->>'revision'));exception when insufficient_privilege then blocked:=true;end;
   if not blocked then raise exception 'Boss gate bypassed at %',i;end if;
   s:=public.my_adventure('boss',jsonb_build_object('board_size',60,'boss_id',ids[b],'choice_id',choices[b],'request_id',gen_random_uuid(),'expected_revision',s->>'revision'));
  elsif i<60 and(p->>'pending')is not null then raise exception 'Unexpected boss between checkpoints at %',i;
  end if;
 end loop;
 request:=jsonb_build_object('board_size',60,'exercise_id','running','request_id',gen_random_uuid(),'expected_revision',s->>'revision','points',999,'stepCredits','{"fake":999}'::jsonb);
 s:=public.my_adventure('exercise',request);s:=public.my_adventure('exercise',request);
 if(private.adventure_progress(actor)->>'points')::int<>1 then raise exception 'Duplicate or forged scoring accepted';end if;
 begin perform public.my_adventure('get','{"board_size":36}');raise exception 'Old client accepted';exception when invalid_parameter_value then if SQLERRM not like 'Banan har blivit längre%'then raise;end if;end;
 s:=public.my_adventure('undo',jsonb_build_object('board_size',60,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',s->'state'->'events'->-1->>'id'));
 s:=public.my_adventure('undo',jsonb_build_object('board_size',60,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',s->'state'->'events'->-1->>'id'));
 if(private.adventure_progress(actor)->>'position')::int<>59 or(private.adventure_progress(actor)->>'points')::int<>0 then raise exception 'Undo was not preserved';end if;
 if has_table_privilege('authenticated','private.adventure_step_credits','insert')then raise exception 'Map credits are client writable';end if;
end$$;
select 'PASS: 60 steps, gates 6/12/24/36/48, no early points, castle scoring, idempotency, forged credits ignored, old-client guard and undo' as result;
rollback;
