-- Six additional tiles in each gap after boss 2: checkpoints 6/12/24/36/48/60.
-- Preserve every exercise, boss, score, event ID and request. Only already reached
-- old checkpoints get six non-scoring map credits, never fabricated exercises.
begin;
lock table public.profiles in exclusive mode;
lock table private.adventure_games,private.adventure_events in share row exclusive mode;
create table private.adventure_step_credits(user_id uuid not null,event_id uuid not null,steps integer not null check(steps=6),primary key(user_id,event_id),foreign key(user_id,event_id)references private.adventure_events(user_id,event_id)on delete cascade);
alter table private.adventure_step_credits enable row level security;
revoke all on private.adventure_step_credits from public,anon,authenticated;
insert into private.adventure_step_credits(user_id,event_id,steps)
 select user_id,event_id,6 from(select user_id,event_id,row_number()over(partition by user_id order by seq)n from private.adventure_events where kind='exercise')e where n in(18,24,30,36);
create or replace function private.adventure_progress(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with counts as(select (count(*)filter(where e.kind='exercise')+coalesce(sum(c.steps),0))::integer position,count(*)filter(where e.kind='boss')::integer bosses,count(*)filter(where e.kind='score')::integer points from private.adventure_events e left join private.adventure_step_credits c on c.user_id=e.user_id and c.event_id=e.event_id where e.user_id=p_user)
 select jsonb_build_object('position',position,'bosses',bosses,'points',points,'pending',(select ord::integer from unnest(array[6,12,24,36,48,60])with ordinality b(tile,ord)where tile=position and bosses<ord))from counts;
$$;
-- Keep the verified existing functions, changing only route state and command gate.
do $patch$
declare body text; anchor text := $anchor$if actor is null then raise exception 'Logga in först.' using errcode='42501'; end if;$anchor$;
begin
 body:=pg_get_functiondef('private.adventure_state(uuid)'::regprocedure);
 if position($old$'version',2,'events'$old$ in body)=0 then raise exception 'Unexpected adventure_state baseline';end if;
 body:=replace(body,$old$'version',2,'events'$old$,$new$'version',3,'stepCredits',coalesce((select jsonb_object_agg(event_id::text,steps)from private.adventure_step_credits where user_id=p_actor),'{}'::jsonb),'events'$new$);
 execute body;
 body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
 if position('pos=36' in body)=0 or position(anchor in body)=0 then raise exception 'Unexpected adventure_action baseline';end if;
 body:=replace(body,'pos=36','pos=60');
 body:=replace(body,anchor,anchor || $gate$
 if p_payload->>'board_size' is distinct from '60' then raise exception 'Banan har blivit längre. Ladda om sidan för att fortsätta – din resa är sparad.'using errcode='22023';end if;
$gate$);
 execute body;
end $patch$;
update private.adventure_games set revision=revision+1;
notify pgrst,'reload schema';
commit;
