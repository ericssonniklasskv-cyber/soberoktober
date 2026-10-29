-- Generated accounts, authenticated command setup and real public RPC for tile 44.
-- Every row and result is rolled back. Existing accounts are never written.
begin;
set local statement_timeout='60s';
create temporary table return_qa(id uuid,sc text,ride text,ice text,ret text)on commit drop;
insert into return_qa select gen_random_uuid(),a,b,c,d from(values('take','take','take','take'),('keep','keep','keep','take'),('take','keep','take','keep'),('keep','take','keep','keep'))v(a,b,c,d);
insert into auth.users(id,email)select id,'return-qa-'||id||'@example.invalid'from return_qa;
insert into public.profiles(id,email,display_name)select id,'return-qa-'||id||'@example.invalid','Temporary return check'from return_qa;
do $$declare item record;s jsonb;p jsonb;payload jsonb;escape_payload jsonb;base jsonb:='{"board_size":60,"shortcut_version":1,"ride_version":1,"icecream_version":1,"return_ride_version":1}';rev int;event_count int;i int;anchor uuid;loss int;positive int;boss_ids text[]:=array['troll','witch','dragon','sphinx','kraken'];choice_ids text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip'];begin
 for item in select * from return_qa loop
  perform set_config('request.jwt.claim.sub',item.id::text,true);
  s:=private.adventure_action('get',base);
  while(private.adventure_progress(item.id)->>'position')::int<44 loop
   p:=private.adventure_progress(item.id);
   if p->>'pending'is not null then
    i:=(p->>'pending')::int;s:=private.adventure_action('boss',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
   elsif(p->>'position')::int=21 and s->'state'->>'shortcutChoice'is null then
    s:=private.adventure_action('shortcut',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.sc));
   elsif(p->>'position')::int=28 and s->'state'->>'rideChoice'is null then
    s:=private.adventure_action('ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.ride));
   elsif(p->>'position')::int=33 and s->'state'->>'icecreamChoice'is null then
    s:=private.adventure_action('icecream',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.ice));
   else
    if(p->>'position')::int=43 then
     begin perform public.my_adventure('return_ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.ret));raise exception 'Ride accepted before 44';exception when insufficient_privilege then if SQLERRM not like 'Återseendet finns%'then raise;end if;end;
    end if;
    s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
   end if;
  end loop;
  rev:=(s->>'revision')::int;event_count:=jsonb_array_length(s->'state'->'events');
  begin perform public.my_adventure('get',base-'return_ride_version');raise exception 'Old client passed 44';exception when invalid_parameter_value then if SQLERRM not like 'Ett nytt återseende%'then raise;end if;end;
  begin perform public.my_adventure('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev,'exercise_id','squats'));raise exception 'Exercise bypassed undecided encounter';exception when insufficient_privilege then if SQLERRM not like 'Gubben väntar%'then raise;end if;end;
  begin perform public.my_adventure('return_escape',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev));raise exception 'Escape accepted before taking ride';exception when insufficient_privilege then if SQLERRM not like 'Det finns inget%'then raise;end if;end;
  begin perform public.my_adventure('return_ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev-1,'choice',item.ret));raise exception 'Stale choice accepted';exception when serialization_failure then null;end;
  begin perform public.my_adventure('return_ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev,'choice','other'));raise exception 'Invalid choice accepted';exception when invalid_parameter_value then null;end;
  payload:=base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev,'choice',item.ret,'return_ride_escaped',true,'user_id',gen_random_uuid(),'points',999,'position',60,'date','2026-11-01');
  s:=public.my_adventure('return_ride',payload);s:=public.my_adventure('return_ride',payload);
  if s->'profile'->>'id'<>item.id::text or s->'state'->>'returnRideChoice'<>item.ret or(s->'state'->>'returnRideEscaped')::bool or(s->>'revision')::int<>rev+1 then raise exception 'Choice forged actor/completion/revision';end if;
  if(private.adventure_progress(item.id)->>'position')::int<>44 or jsonb_array_length(s->'state'->'events')<>event_count then raise exception 'Choice moved before mission or fabricated training';end if;
  begin perform public.my_adventure('return_ride',payload||jsonb_build_object('choice',case when item.ret='take'then 'keep'else 'take'end));raise exception 'Same request ID changed choice';exception when invalid_parameter_value then null;end;
  for i in 1..2 loop
   begin perform public.my_adventure('return_ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',case when i=1 then item.ret else case when item.ret='take'then 'keep'else 'take'end end));raise exception 'Second choice accepted';exception when insufficient_privilege then if SQLERRM not like 'Valet på ruta 44 är redan sparat%'then raise;end if;end;
  end loop;
  if item.ret='take' then
   s:=private.adventure_action('get',base);
   if(s->'state'->>'returnRideEscaped')::bool then raise exception 'Pending mission lost on revisit';end if;
   begin perform public.my_adventure('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','running'));raise exception 'Pending mission bypassed';exception when insufficient_privilege then if SQLERRM not like 'Klara flyktuppdraget%'then raise;end if;end;
   begin perform public.my_adventure('undo',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',s->'state'->'events'->-1->>'id'));raise exception 'Pending mission bypassed via undo';exception when insufficient_privilege then if SQLERRM not like 'Klara flyktuppdraget%'then raise;end if;end;
   rev:=(s->>'revision')::int;
   escape_payload:=base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev,'points',100,'user_id',gen_random_uuid());
   s:=public.my_adventure('return_escape',escape_payload);s:=public.my_adventure('return_escape',escape_payload);
   if not(s->'state'->>'returnRideEscaped')::bool or(private.adventure_progress(item.id)->>'position')::int<>43 or(s->>'revision')::int<>rev+1 then raise exception 'Escape not applied exactly once';end if;
   if jsonb_array_length(s->'state'->'events')<>event_count or(private.adventure_progress(item.id)->>'points')::int<>0 then raise exception 'Escape fabricated exercise/points';end if;
   begin perform public.my_adventure('return_escape',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision'));raise exception 'Second completion accepted';exception when insufficient_privilege then if SQLERRM not like 'Det finns inget%'then raise;end if;end;
   for i in 1..3 loop
    anchor:=(s->'state'->'events'->-1->>'id')::uuid;s:=private.adventure_action('undo',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',anchor));
    if s->'state'->>'returnRideChoice'<>'take'or not(s->'state'->>'returnRideEscaped')::bool or exists(select 1 from private.adventure_step_credits where user_id=item.id and bonus_source='return_ride')then raise exception 'Undo reset completion or retained orphan loss';end if;
    s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','pullups'));
    if(private.adventure_progress(item.id)->>'position')::int<>43 or(select count(*)from private.adventure_step_credits where user_id=item.id and bonus_source='return_ride')<>1 then raise exception 'Redo stacked loss';end if;
   end loop;
   s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
   if(private.adventure_progress(item.id)->>'position')::int<>44 or not(s->'state'->>'returnRideEscaped')::bool then raise exception 'Revisit reopened mission';end if;
  else
   begin perform public.my_adventure('return_escape',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision'));raise exception 'Declined mission accepted completion';exception when insufficient_privilege then null;end;
  end if;
  loss:=(item.ice='take')::int+(item.ret='take')::int;positive:=(item.sc='take')::int+(item.ride='take')::int;
  if(select count(*)from private.adventure_step_credits where user_id=item.id and steps=-1)<>loss or(select count(*)from private.adventure_step_credits where user_id=item.id and steps=1)<>positive then raise exception 'Independent adjustments changed';end if;
  while(private.adventure_progress(item.id)->>'position')::int<60 loop
   p:=private.adventure_progress(item.id);
   if p->>'pending'is not null then i:=(p->>'pending')::int;
    begin perform public.my_adventure('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));raise exception 'Boss bypassed';exception when insufficient_privilege then null;end;
    s:=private.adventure_action('boss',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
   else s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','running'));end if;
  end loop;
  if(private.adventure_progress(item.id)->>'points')::int<>0 or(select count(*)from private.adventure_events where user_id=item.id and kind='exercise')<>60-positive+loss then raise exception 'Journey scoring/training count changed';end if;
  s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
  if(private.adventure_progress(item.id)->>'points')::int<>1 then raise exception 'Castle scoring broken';end if;
 end loop;
 if has_table_privilege('authenticated','private.adventure_step_credits','INSERT')or has_table_privilege('anon','private.adventure_games','UPDATE')then raise exception 'Direct writes exposed';end if;
end$$;
select 'PASS: permanent tile-44 choice, saved mission, one completion/setback, no added exercise/points, duplicate/stale/forged requests denied, pending mission blocks training/undo, old client blocked, independent old choices and both negative sources, undo/redo/revisit, later bosses and castle scoring preserved' result;
rollback;
