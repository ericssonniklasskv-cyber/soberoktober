begin;
do $patch$declare body text;anchor text:=$a$select * into last_event from private.adventure_events where user_id=actor and kind='exercise'order by seq desc limit 1;$a$;begin
body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
if position(anchor in body)=0 then raise exception 'Unexpected shortcut baseline';end if;
execute replace(body,anchor,$a$select e.* into last_event from private.adventure_events e where e.user_id=actor and e.kind='exercise'order by e.seq desc limit 1;$a$);
end $patch$;
notify pgrst,'reload schema';
commit;
