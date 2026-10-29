-- Disposable authenticated accounts only. Every fixture and result is rolled back.
begin;
set local statement_timeout='60s';
do $$
declare actor uuid:=gen_random_uuid();other_actor uuid:=gen_random_uuid();s jsonb;p jsonb;payload jsonb;tile int;i int;rev int;n int;
 base jsonb:='{"board_size":60,"shortcut_version":1,"ride_version":1,"icecream_version":1,"return_ride_version":1}';
 boss_ids text[]:=array['troll','witch','dragon','sphinx','kraken'];choice_ids text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip'];
begin
 insert into auth.users(id,email)values(actor,'salute-qa-'||actor||'@example.invalid'),(other_actor,'salute-qa-'||other_actor||'@example.invalid');
 insert into public.profiles(id,email,display_name)values(actor,'salute-qa-'||actor||'@example.invalid','Temporary salute check'),(other_actor,'salute-qa-'||other_actor||'@example.invalid','Other temporary salute check');
 perform set_config('request.jwt.claim.sub',actor::text,true);s:=private.adventure_action('get',base);
 begin perform public.my_adventure('salute_seen',base||jsonb_build_object('tile',55,'request_id',gen_random_uuid()));raise exception 'Greeting accepted at start';exception when insufficient_privilege then null;end;
 while(private.adventure_progress(actor)->>'position')::int<55 loop
  p:=private.adventure_progress(actor);
  if p->>'pending'is not null then i:=(p->>'pending')::int;s:=private.adventure_action('boss',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
  elsif(p->>'position')::int=21 and s->'state'->>'shortcutChoice'is null then s:=private.adventure_action('shortcut',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice','keep'));
  elsif(p->>'position')::int=28 and s->'state'->>'rideChoice'is null then s:=private.adventure_action('ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice','keep'));
  elsif(p->>'position')::int=33 and s->'state'->>'icecreamChoice'is null then s:=private.adventure_action('icecream',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice','keep'));
  elsif(p->>'position')::int=44 and s->'state'->>'returnRideChoice'is null then s:=private.adventure_action('return_ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice','keep'));
  else s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));end if;
 end loop;
 begin perform public.my_adventure('salute_seen',base||jsonb_build_object('tile',56,'request_id',gen_random_uuid()));raise exception 'Future greeting accepted';exception when insufficient_privilege then null;end;
 begin perform public.my_adventure('salute_seen',base||jsonb_build_object('tile',60,'request_id',gen_random_uuid()));raise exception 'Unknown greeting accepted';exception when invalid_parameter_value then null;end;
 for tile in 55..59 loop
  rev:=(s->>'revision')::int;n:=jsonb_array_length(s->'state'->'events');
  payload:=base||jsonb_build_object('tile',tile,'request_id',gen_random_uuid(),'user_id',other_actor,'expected_revision',-1,'points',999,'position',60);
  s:=public.my_adventure('salute_seen',payload);s:=public.my_adventure('salute_seen',payload);
  if(s->>'revision')::int<>rev or jsonb_array_length(s->'state'->'events')<>n or(private.adventure_progress(actor)->>'position')::int<>tile or(private.adventure_progress(actor)->>'points')::int<>0 then raise exception 'Greeting changed progress/revision/events/points';end if;
  if not(s->'profile'->'salutes_seen'@>to_jsonb(array[tile]))then raise exception 'Greeting not saved';end if;
  s:=public.my_adventure('salute_seen',base||jsonb_build_object('tile',tile,'request_id',gen_random_uuid()));
  if jsonb_array_length(s->'profile'->'salutes_seen')<>tile-54 then raise exception 'Duplicate greeting marker';end if;
  if exists(select 1 from private.adventure_games where user_id=other_actor and cardinality(salutes_seen)>0)then raise exception 'Forged account marker';end if;
  s:=private.adventure_action('get',base);if not(s->'profile'->'salutes_seen'@>to_jsonb(array[tile]))then raise exception 'Marker lost across read';end if;
  s:=private.adventure_action('undo',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',s->'state'->'events'->-1->>'id'));
  if not(s->'profile'->'salutes_seen'@>to_jsonb(array[tile]))then raise exception 'Undo erased greeting';end if;
  s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','running'));
  if(private.adventure_progress(actor)->>'position')::int<>tile then raise exception 'Greeting revisit granted a free step';end if;
  s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','pullups'));
  if(private.adventure_progress(actor)->>'position')::int<>tile+1 then raise exception 'Next step no longer requires a workout';end if;
 end loop;
 if jsonb_array_length(s->'profile'->'salutes_seen')<>5 or(private.adventure_progress(actor)->>'points')::int<>0 then raise exception 'Castle arrival changed';end if;
 s:=public.my_adventure('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
 if(private.adventure_progress(actor)->>'points')::int<>1 then raise exception 'Castle scoring changed';end if;
 if(private.adventure_clock()at time zone 'Europe/Stockholm')::date<date '2026-10-31'then
  begin perform public.my_adventure('boss',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id','final','choice_id','victory-jump'));raise exception 'Final opened early';exception when insufficient_privilege then null;end;
 end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.my_adventure('salute_seen',payload);raise exception 'Anonymous greeting write accepted';exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','private.adventure_games','UPDATE')then raise exception 'Direct game write exposed';end if;
end$$;
select 'PASS: five per-account greeting markers; authenticated/arrival validation; no forged account, extra move, revision, events or points; duplicate requests/read/reload/undo/revisit; next workout required; castle scoring and final date gate preserved' result;
rollback;
