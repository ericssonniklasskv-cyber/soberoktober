-- Live release verification; every temporary record is rolled back.
begin;
set local statement_timeout='20s';
create temporary table icecream_qa on commit drop as select gen_random_uuid()id;
insert into auth.users(id,email)select id,'icecream-qa-'||id||'@example.invalid'from icecream_qa;
insert into public.profiles(id,email,display_name)select id,'icecream-qa-'||id||'@example.invalid','Temporary discovery check'from icecream_qa;
do $$declare actor uuid:=(select id from icecream_qa);s jsonb;p jsonb;payload jsonb;i int;revision_before int;events_before int;begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 s:=public.my_adventure('get','{"board_size":60}');
 if(s->'profile'->>'icecream_seen')::boolean is distinct from false then raise exception 'Discovery starts incorrectly';end if;
 for i in 1..18 loop
  if i=18 then
   begin perform public.my_adventure('treat_seen',jsonb_build_object('board_size',60,'request_id',gen_random_uuid()));raise exception 'Discovery acknowledged before tile 18';exception when insufficient_privilege then if SQLERRM not like 'Glassfyndet väntar%'then raise;end if;end;
  end if;
  s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','exercise_id','squats'));
  if i in(6,12)then s:=public.my_adventure('boss',jsonb_build_object('board_size',60,'request_id',gen_random_uuid(),'expected_revision',s->>'revision','boss_id',case when i=6 then 'troll'else 'witch'end,'choice_id',case when i=6 then 'somersault'else 'handstand'end));end if;
 end loop;
 revision_before:=(s->>'revision')::int;events_before:=jsonb_array_length(s->'state'->'events');
 payload:=jsonb_build_object('board_size',60,'request_id',gen_random_uuid());
 s:=public.my_adventure('treat_seen',payload);s:=public.my_adventure('treat_seen',payload);
 if(s->'profile'->>'icecream_seen')::boolean is distinct from true then raise exception 'Discovery acknowledgement not saved';end if;
 if(s->>'revision')::int<>revision_before or jsonb_array_length(s->'state'->'events')<>events_before then raise exception 'Cosmetic discovery changed gameplay';end if;
 s:=public.my_adventure('exercise',jsonb_build_object('board_size',60,'request_id',gen_random_uuid(),'expected_revision',revision_before,'exercise_id','running'));
 p:=private.adventure_progress(actor);if(p->>'position')::int<>19 or(p->>'points')::int<>0 then raise exception 'Next step failed after discovery: %',p;end if;
 s:=public.my_adventure('get','{"board_size":60}');if(s->'profile'->>'icecream_seen')::boolean is distinct from true then raise exception 'Discovery flag lost on revisit';end if;
end$$;
select 'PASS: no acknowledgement before 18; persisted once; idempotent; no point/event/revision change; next exercise and revisit work' as result;
rollback;
