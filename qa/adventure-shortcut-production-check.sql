-- Real production RPC regression, with generated test accounts, always ROLLBACK.
begin;
set local statement_timeout='25s';
create temporary table shortcut_qa(id uuid,route text)on commit drop;
insert into shortcut_qa values(gen_random_uuid(),'take'),(gen_random_uuid(),'keep');
insert into auth.users(id,email)select id,'shortcut-qa-'||id||'@example.invalid'from shortcut_qa;
insert into public.profiles(id,email,display_name)select id,'shortcut-qa-'||id||'@example.invalid','Temporary shortcut check'from shortcut_qa;
do $$declare item record;s jsonb;p jsonb;payload jsonb;rev int;event_count int;anchor uuid;i int;boss_ids text[]:=array['troll','witch','dragon','sphinx','kraken'];choice_ids text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip'];begin
 for item in select * from shortcut_qa loop
  perform set_config('request.jwt.claim.sub',item.id::text,true);
  s:=public.my_adventure('get','{"board_size":60,"shortcut_version":1}');
  for i in 1..20 loop
   if i=20 then
    begin perform public.my_adventure('shortcut',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.route));raise exception 'Shortcut accepted before tile 21';exception when insufficient_privilege then if SQLERRM not like 'Vägskälet finns%'then raise;end if;end;
   end if;
   s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
   if i in(6,12)then s:=public.my_adventure('boss',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i/6],'choice_id',choice_ids[i/6]));end if;
  end loop;
  s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','running'));
  rev:=(s->>'revision')::int;event_count:=jsonb_array_length(s->'state'->'events');
  begin perform public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',rev,'exercise_id','squats'));raise exception 'Exercise bypassed unanswered choice';exception when insufficient_privilege then if SQLERRM not like 'Du har hittat ett vägskäl%'then raise;end if;end;
  begin perform public.my_adventure('get','{"board_size":60}');raise exception 'Old client passed tile 21';exception when invalid_parameter_value then if SQLERRM not like 'En hemlig stig%'then raise;end if;end;
  begin perform public.my_adventure('shortcut',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',rev-1,'choice',item.route));raise exception 'Stale revision accepted';exception when serialization_failure then null;end;
  begin perform public.my_adventure('shortcut',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',rev,'choice','teleport'));raise exception 'Unknown route accepted';exception when invalid_parameter_value then null;end;
  payload:=jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',rev,'choice',item.route,'user_id',gen_random_uuid(),'points',999,'position',60);
  s:=public.my_adventure('shortcut',payload);s:=public.my_adventure('shortcut',payload);
  if s->'profile'->>'id'<>item.id::text or s->'state'->>'shortcutChoice'<>item.route then raise exception 'Wrong actor or lost choice';end if;
  if(s->>'revision')::int<>rev+1 or jsonb_array_length(s->'state'->'events')<>event_count then raise exception 'Choice duplicated or fabricated exercise';end if;
  p:=private.adventure_progress(item.id);
  if(p->>'points')::int<>0 or(p->>'position')::int<>(case when item.route='take'then 22 else 21 end)then raise exception 'Wrong shortcut reward: %',p;end if;
  for i in 1..2 loop
   begin perform public.my_adventure('shortcut',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',case when i=1 then item.route else case when item.route='take'then 'keep'else 'take'end end));raise exception 'Second decision accepted';exception when insufficient_privilege then if SQLERRM not like 'Valet på ruta 21 är redan sparat%'then raise;end if;end;
  end loop;
  -- Undo preserves the permanent decision. Re-recording restores the SAME bonus.
  for i in 1..3 loop
   anchor:=(s->'state'->'events'->-1->>'id')::uuid;
   s:=public.my_adventure('undo',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',anchor));
   if s->'state'->>'shortcutChoice'<>item.route or(private.adventure_progress(item.id)->>'position')::int<>20 then raise exception 'Undo lost permanent choice';end if;
   s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','pullups'));
   if(private.adventure_progress(item.id)->>'position')::int<>(case when item.route='take'then 22 else 21 end)then raise exception 'Undo stacked credits';end if;
   if(select count(*)from private.adventure_step_credits where user_id=item.id and steps=1)<>(case when item.route='take'then 1 else 0 end)then raise exception 'Wrong bonus count';end if;
  end loop;
  -- Full remainder of the route: every boss blocks, castle still opens scoring.
  while(private.adventure_progress(item.id)->>'position')::int<60 loop
   p:=private.adventure_progress(item.id);
   if p->>'pending'is not null then
    i:=(p->>'pending')::int;
    begin perform public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));raise exception 'Boss bypassed';exception when insufficient_privilege then if SQLERRM not like 'Klara bossens uppdrag%'then raise;end if;end;
    s:=public.my_adventure('boss',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
   else s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','running'));end if;
  end loop;
  if(private.adventure_progress(item.id)->>'points')::int<>0 then raise exception 'Journey awarded points';end if;
  s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'shortcut_version',1,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
  if(private.adventure_progress(item.id)->>'points')::int<>1 then raise exception 'Castle scoring broken';end if;
  s:=public.my_adventure('get','{"board_size":60,"shortcut_version":1}');
  if s->'state'->>'shortcutChoice'<>item.route then raise exception 'Choice lost on revisit';end if;
 end loop;
 if has_table_privilege('authenticated','private.adventure_step_credits','INSERT')or has_table_privilege('anon','private.adventure_games','UPDATE')then raise exception 'Direct writes exposed';end if;
end$$;
select 'PASS: both choices permanent across revisit/undo; one bonus maximum; duplicate request safe; stale revision and client blocked; no forged actor/points; every later boss blocks; castle scoring unchanged; direct writes denied' as result;
rollback;
