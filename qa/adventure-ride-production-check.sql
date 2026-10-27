-- Real production command flow, temporary generated accounts only. ALWAYS ROLLBACK.
begin;
set local statement_timeout='40s';
create temporary table ride_qa(id uuid,shortcut text,ride text)on commit drop;
insert into ride_qa select gen_random_uuid(),a,b from unnest(array['take','keep'])a cross join unnest(array['take','keep'])b;
insert into auth.users(id,email)select id,'ride-qa-'||id||'@example.invalid'from ride_qa;
insert into public.profiles(id,email,display_name)select id,'ride-qa-'||id||'@example.invalid','Temporary ride check'from ride_qa;
do $$declare item record;s jsonb;p jsonb;payload jsonb;rev int;event_count int;anchor uuid;i int;expected_credits int;boss_ids text[]:=array['troll','witch','dragon','sphinx','kraken'];choice_ids text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip'];begin
 for item in select * from ride_qa loop
  perform set_config('request.jwt.claim.sub',item.id::text,true);
  s:=public.my_adventure('get','{"board_size":60,"shortcut_version":1,"ride_version":1}');
  while(private.adventure_progress(item.id)->>'position')::int<28 loop
   p:=private.adventure_progress(item.id);
   if p->>'pending'is not null then
    i:=(p->>'pending')::int;
    s:=public.my_adventure('boss',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
   elsif(p->>'position')::int=21 and s->'state'->>'shortcutChoice'is null then
    s:=public.my_adventure('shortcut',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.shortcut));
   else
    if(p->>'position')::int=27 then
     begin perform public.my_adventure('ride',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.ride));raise exception 'Ride accepted before tile 28';exception when insufficient_privilege then if SQLERRM not like 'Skjutsen finns%'then raise;end if;end;
    end if;
    s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
   end if;
  end loop;
  rev:=(s->>'revision')::int;event_count:=jsonb_array_length(s->'state'->'events');
  begin perform public.my_adventure('get','{"board_size":60,"shortcut_version":1}');raise exception 'Old client passed tile 28';exception when invalid_parameter_value then if SQLERRM not like 'Ett nytt möte%'then raise;end if;end;
  begin perform public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',rev,'exercise_id','squats'));raise exception 'Exercise bypassed ride decision';exception when insufficient_privilege then if SQLERRM not like 'Skjutsen väntar%'then raise;end if;end;
  begin perform public.my_adventure('ride',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',rev-1,'choice',item.ride));raise exception 'Stale decision accepted';exception when serialization_failure then null;end;
  begin perform public.my_adventure('ride',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',rev,'choice','teleport'));raise exception 'Unknown choice accepted';exception when invalid_parameter_value then null;end;
  payload:=jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',rev,'choice',item.ride,'user_id',gen_random_uuid(),'points',999,'position',60);
  s:=public.my_adventure('ride',payload);s:=public.my_adventure('ride',payload);
  if s->'profile'->>'id'<>item.id::text or s->'state'->>'rideChoice'<>item.ride or s->'state'->>'shortcutChoice'<>item.shortcut then raise exception 'Actor or decisions changed';end if;
  if(s->>'revision')::int<>rev+1 or jsonb_array_length(s->'state'->'events')<>event_count then raise exception 'Duplicate write or fabricated exercise';end if;
  p:=private.adventure_progress(item.id);expected_credits:=(item.shortcut='take')::int+(item.ride='take')::int;
  if(p->>'points')::int<>0 or(p->>'position')::int<>(case when item.ride='take'then 29 else 28 end)then raise exception 'Wrong ride result: %',p;end if;
  if(select count(*)from private.adventure_step_credits where user_id=item.id and steps=1)<>expected_credits then raise exception 'Wrong independent bonus count';end if;
  for i in 1..2 loop
   begin perform public.my_adventure('ride',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',case when i=1 then item.ride else case when item.ride='take'then 'keep'else 'take'end end));raise exception 'Second ride decision accepted';exception when insufficient_privilege then if SQLERRM not like 'Valet på ruta 28 är redan sparat%'then raise;end if;end;
  end loop;
  for i in 1..3 loop
   anchor:=(s->'state'->'events'->-1->>'id')::uuid;
   s:=public.my_adventure('undo',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',anchor));
   if s->'state'->>'rideChoice'<>item.ride or s->'state'->>'shortcutChoice'<>item.shortcut or(private.adventure_progress(item.id)->>'position')::int<>27 then raise exception 'Undo reset an encounter';end if;
   s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','running'));
   if(private.adventure_progress(item.id)->>'position')::int<>(case when item.ride='take'then 29 else 28 end)then raise exception 'Undo stacked tiles';end if;
   if(select count(*)from private.adventure_step_credits where user_id=item.id and steps=1)<>expected_credits then raise exception 'Undo stacked bonus rows';end if;
  end loop;
  while(private.adventure_progress(item.id)->>'position')::int<60 loop
   p:=private.adventure_progress(item.id);
   if p->>'pending'is not null then
    i:=(p->>'pending')::int;
    begin perform public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));raise exception 'Boss bypassed';exception when insufficient_privilege then if SQLERRM not like 'Klara bossens uppdrag%'then raise;end if;end;
    s:=public.my_adventure('boss',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
   else s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','pullups'));end if;
  end loop;
  if(private.adventure_progress(item.id)->>'points')::int<>0 then raise exception 'Journey awarded points';end if;
  s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'ride_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
  if(private.adventure_progress(item.id)->>'points')::int<>1 then raise exception 'Castle scoring broken';end if;
  if(select count(*)from private.adventure_events where user_id=item.id and kind='exercise')<>60-expected_credits then raise exception 'Bonus counted as exercise';end if;
  s:=public.my_adventure('get','{"board_size":60,"shortcut_version":1,"ride_version":1}');if s->'state'->>'rideChoice'<>item.ride then raise exception 'Decision lost on revisit';end if;
 end loop;
 if has_table_privilege('authenticated','private.adventure_step_credits','INSERT')or has_table_privilege('anon','private.adventure_games','UPDATE')then raise exception 'Direct writes exposed';end if;
end$$;
select 'PASS: all four shortcut/ride combinations; permanent decisions; duplicate requests/stale clients/invalid payloads blocked; independent credit caps; undo/revisit safe; every boss blocks; castle scoring unchanged; no fabricated exercises; direct writes denied' result;
rollback;
