-- Actual public RPC for the new choice and inner authenticated action for route setup.
-- Route setup omits only expensive unrelated leaderboard aggregation. Always rolled back.
begin;
set local statement_timeout='60s';
create temporary table trap_qa(id uuid,shortcut text,ride text,icecream text)on commit drop;
insert into trap_qa select gen_random_uuid(),a,b,c from unnest(array['take','keep'])a cross join unnest(array['take','keep'])b cross join unnest(array['take','keep'])c;
insert into auth.users(id,email)select id,'trap-qa-'||id||'@example.invalid'from trap_qa;
insert into public.profiles(id,email,display_name)select id,'trap-qa-'||id||'@example.invalid','Temporary icecream check'from trap_qa;
do $$declare item record;s jsonb;p jsonb;payload jsonb;base jsonb:='{"board_size":60,"shortcut_version":1,"ride_version":1,"icecream_version":1}';rev int;event_count int;anchor uuid;i int;credits int;loss int;boss_ids text[]:=array['troll','witch','dragon','sphinx','kraken'];choice_ids text[]:=array['somersault','handstand','morning-walk','ball-juggling','bottle-flip'];begin
 for item in select * from trap_qa loop
  perform set_config('request.jwt.claim.sub',item.id::text,true);
  s:=private.adventure_action('get',base);
  while(private.adventure_progress(item.id)->>'position')::int<33 loop
   p:=private.adventure_progress(item.id);
   if p->>'pending'is not null then
    i:=(p->>'pending')::int;
    s:=private.adventure_action('boss',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
   elsif(p->>'position')::int=21 and s->'state'->>'shortcutChoice'is null then
    s:=private.adventure_action('shortcut',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.shortcut));
   elsif(p->>'position')::int=28 and s->'state'->>'rideChoice'is null then
    s:=private.adventure_action('ride',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.ride));
   else
    if(p->>'position')::int=32 then
     begin perform public.my_adventure('icecream',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',item.icecream));raise exception 'Trap accepted before 33';exception when insufficient_privilege then if SQLERRM not like 'Glassfyndet finns%'then raise;end if;end;
    end if;
    s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
   end if;
  end loop;
  rev:=(s->>'revision')::int;event_count:=jsonb_array_length(s->'state'->'events');
  begin perform public.my_adventure('get',base-'icecream_version');raise exception 'Old client passed 33';exception when invalid_parameter_value then if SQLERRM not like 'Ett nytt fynd%'then raise;end if;end;
  begin perform public.my_adventure('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev,'exercise_id','squats'));raise exception 'Exercise bypassed unresolved trap';exception when insufficient_privilege then if SQLERRM not like 'Ett glassfynd%'then raise;end if;end;
  begin perform public.my_adventure('icecream',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev-1,'choice',item.icecream));raise exception 'Stale choice accepted';exception when serialization_failure then null;end;
  begin perform public.my_adventure('icecream',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev,'choice','other'));raise exception 'Invalid choice accepted';exception when invalid_parameter_value then null;end;
  payload:=base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',rev,'choice',item.icecream,'user_id',gen_random_uuid(),'points',999,'position',60,'date','2026-11-01');
  s:=public.my_adventure('icecream',payload);s:=public.my_adventure('icecream',payload);
  if s->'profile'->>'id'<>item.id::text or s->'state'->>'icecreamChoice'<>item.icecream or s->'state'->>'shortcutChoice'<>item.shortcut or s->'state'->>'rideChoice'<>item.ride then raise exception 'Actor/decision not preserved';end if;
  if(s->>'revision')::int<>rev+1 or jsonb_array_length(s->'state'->'events')<>event_count then raise exception 'Duplicate choice fabricated event/revision';end if;
  credits:=(item.shortcut='take')::int+(item.ride='take')::int;loss:=(item.icecream='take')::int;p:=private.adventure_progress(item.id);
  if(p->>'position')::int<>33-loss or(p->>'points')::int<>0 then raise exception 'Wrong setback or points: %',p;end if;
  if(select count(*)from private.adventure_step_credits where user_id=item.id and steps=1)<>credits or(select count(*)from private.adventure_step_credits where user_id=item.id and steps=-1)<>loss then raise exception 'Wrong adjustment counts';end if;
  for i in 1..2 loop
   begin perform public.my_adventure('icecream',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','choice',case when i=1 then item.icecream else case when item.icecream='take'then 'keep'else 'take'end end));raise exception 'Second choice accepted';exception when insufficient_privilege then if SQLERRM not like 'Valet på ruta 33 är redan sparat%'then raise;end if;end;
  end loop;
  -- Undoing the arrival preserves the decision, redoing restores just one setback.
  for i in 1..3 loop
   anchor:=(s->'state'->'events'->-1->>'id')::uuid;
   s:=private.adventure_action('undo',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','event_id',anchor));
   if s->'state'->>'icecreamChoice'<>item.icecream or(private.adventure_progress(item.id)->>'position')::int<>32 then raise exception 'Undo reset choice/wrong position';end if;
   if exists(select 1 from private.adventure_step_credits where user_id=item.id and steps=-1)then raise exception 'Undo retained orphan adjustment';end if;
   s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','running'));
   if(private.adventure_progress(item.id)->>'position')::int<>33-loss then raise exception 'Setback stacked on redo';end if;
   if(select count(*)from private.adventure_step_credits where user_id=item.id and steps=-1)<>loss then raise exception 'Setback count stacked';end if;
  end loop;
  if loss=1 then
   s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','pullups'));
   if(private.adventure_progress(item.id)->>'position')::int<>33 then raise exception 'Revisit cannot reach 33';end if;
   s:=private.adventure_action('get',base);
   if s->'state'->>'icecreamChoice'<>'take' then raise exception 'Revisit lost decision';end if;
  end if;
  while(private.adventure_progress(item.id)->>'position')::int<60 loop
   p:=private.adventure_progress(item.id);
   if p->>'pending'is not null then
    i:=(p->>'pending')::int;
    begin perform public.my_adventure('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));raise exception 'Boss bypassed';exception when insufficient_privilege then if SQLERRM not like 'Klara bossens uppdrag%'then raise;end if;end;
    s:=private.adventure_action('boss',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',boss_ids[i],'choice_id',choice_ids[i]));
   else s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));end if;
  end loop;
  if(private.adventure_progress(item.id)->>'points')::int<>0 then raise exception 'Journey awarded points';end if;
  if(select count(*)from private.adventure_events where user_id=item.id and kind='exercise')<>60-credits+loss then raise exception 'Workout count changed by trap';end if;
  s:=private.adventure_action('exercise',base||jsonb_build_object('request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
  if(private.adventure_progress(item.id)->>'points')::int<>1 then raise exception 'Castle scoring broken';end if;
 end loop;
 if has_table_privilege('authenticated','private.adventure_step_credits','INSERT')or has_table_privilege('anon','private.adventure_games','UPDATE')then raise exception 'Direct writes exposed';end if;
end$$;
select 'PASS: eight shortcut/ride/icecream combinations; no lost workouts/points; one permanent choice; duplicate/stale/forged calls rejected; old client blocked; undo/redo/revisit safe; existing boss gates and castle points preserved; direct writes denied' result;
rollback;
