-- Cosmetic greetings at 55--59. Authenticated account status only; never training or points.
begin;
alter table private.adventure_games add column salutes_seen integer[] not null default '{}';
alter table private.adventure_games add constraint adventure_salutes_seen_check check(cardinality(salutes_seen)<=5 and salutes_seen<@array[55,56,57,58,59] and array_position(salutes_seen,null)is null);
do $patch$
declare body text;anchor text;begin
 body:=pg_get_functiondef('private.adventure_state(uuid)'::regprocedure);
 anchor:=$a$'icecream_seen',g.icecream_seen)$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected greeting profile baseline';end if;
 body:=replace(body,anchor,$a$'icecream_seen',g.icecream_seen,'salutes_seen',g.salutes_seen)$a$);
 execute body;
 body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
 anchor:=$a$('get','exercise','boss','undo','mount','seen','treat_seen','bonus','unbonus','shortcut','ride','icecream','return_ride','return_escape')$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected greeting action baseline';end if;
 body:=replace(body,anchor,$a$('get','exercise','boss','undo','mount','seen','treat_seen','bonus','unbonus','shortcut','ride','icecream','return_ride','return_escape','salute_seen')$a$);
 anchor:=$a$elsif p_action='treat_seen'then$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected greeting action branch';end if;
 body:=replace(body,anchor,$a$elsif p_action='salute_seen'then
  if p_payload->>'tile' is null or p_payload->>'tile'not in('55','56','57','58','59')then raise exception 'Okänd hälsning.'using errcode='22023';end if;
  if pos<(p_payload->>'tile')::integer or exists(select 1 from unnest(array['troll','witch','dragon','sphinx','kraken'])as wanted(id)where not exists(select 1 from private.adventure_events e where e.user_id=actor and e.kind='boss'and e.boss_id=wanted.id))then raise exception 'Hälsningen väntar längre fram på vägen.'using errcode='42501';end if;
  update private.adventure_games set salutes_seen=array(select distinct n from unnest(salutes_seen||array[(p_payload->>'tile')::integer])as t(n)order by n)where user_id=actor;
  insert into private.adventure_requests(user_id,request_id,payload)values(actor,req,fingerprint);
  return private.adventure_state(actor);
 $a$||anchor);
 execute body;
end $patch$;
notify pgrst,'reload schema';
commit;
