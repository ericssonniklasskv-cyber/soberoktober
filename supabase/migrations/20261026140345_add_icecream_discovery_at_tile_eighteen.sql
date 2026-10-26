-- Cosmetic discovery only. No points, events or progress are changed.
begin;
alter table private.adventure_games add column icecream_seen boolean not null default false;
do $patch$
declare body text;anchor text:=$anchor$elsif p_action='seen'then$anchor$;
begin
 body:=pg_get_functiondef('private.adventure_state(uuid)'::regprocedure);
 if position($old$'welcome_seen',g.welcome_seen$old$in body)=0 then raise exception 'Unexpected state definition';end if;
 execute replace(body,$old$'welcome_seen',g.welcome_seen$old$,$new$'welcome_seen',g.welcome_seen,'icecream_seen',g.icecream_seen$new$);
 body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
 if position($old$'mount','seen','bonus','unbonus'$old$in body)=0 or position(anchor in body)=0 then raise exception 'Unexpected command definition';end if;
 body:=replace(body,$old$'mount','seen','bonus','unbonus'$old$,$new$'mount','seen','treat_seen','bonus','unbonus'$new$);
 body:=replace(body,anchor,$branch$elsif p_action='treat_seen'then
  if (private.adventure_progress(actor)->>'position')::integer<18 then raise exception 'Glassfyndet väntar på ruta 18.'using errcode='42501';end if;
  update private.adventure_games set icecream_seen=true where user_id=actor;
  insert into private.adventure_requests(user_id,request_id,payload)values(actor,req,fingerprint);
  return private.adventure_state(actor);
 $branch$||anchor);
 execute body;
end $patch$;
notify pgrst,'reload schema';
commit;
