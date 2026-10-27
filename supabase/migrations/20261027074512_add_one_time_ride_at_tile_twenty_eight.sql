-- One permanent account decision at tile 28, separate from the tile-21 shortcut.
begin;
alter table private.adventure_games add column ride_choice text check(ride_choice in('take','keep'));
alter table private.adventure_step_credits add column bonus_source text not null default 'legacy';
update private.adventure_step_credits set bonus_source='shortcut'where steps=1;
alter table private.adventure_step_credits add constraint adventure_bonus_source_check check((steps=6 and bonus_source='legacy')or(steps=1 and bonus_source in('shortcut','ride')));
drop index private.adventure_one_shortcut_credit_per_user;
create unique index adventure_one_bonus_credit_per_kind on private.adventure_step_credits(user_id,bonus_source)where steps=1;
do $patch$
declare body text;anchor text;begin
 body:=pg_get_functiondef('private.adventure_state(uuid)'::regprocedure);
 anchor:=$a$'version',3,'shortcutChoice'$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected ride state baseline';end if;
 execute replace(body,anchor,$a$'version',3,'rideChoice',(select ride_choice from private.adventure_games where user_id=p_actor),'shortcutChoice'$a$);
 body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
 if position($a$'unbonus','shortcut')$a$ in body)=0 or position($a$if pos=21 and game.shortcut_choice is null$a$ in body)=0 then raise exception 'Unexpected ride action baseline';end if;
 body:=replace(body,$a$'unbonus','shortcut')$a$,$a$'unbonus','shortcut','ride')$a$);
 body:=replace(body,$a$in('exercise','boss','undo','mount','shortcut')$a$,$a$in('exercise','boss','undo','mount','shortcut','ride')$a$);
 anchor:=$a$if p_action='get' then return private.adventure_state(actor);end if;$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected ride get baseline';end if;
 body:=replace(body,anchor,$a$if p_payload->>'ride_version' is distinct from '1'and(game.ride_choice is not null or(private.adventure_progress(actor)->>'position')::integer>=28)then raise exception 'Ett nytt möte väntar. Ladda om sidan för att fortsätta – din resa är sparad.'using errcode='22023';end if;
 $a$||anchor);
 anchor:=$a$insert into private.adventure_step_credits(user_id,event_id,steps)values(actor,req,1);$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected shortcut undo baseline';end if;
 body:=replace(body,anchor,$a$insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,req,1,'shortcut');$a$);
 anchor:=$a$insert into private.adventure_step_credits(user_id,event_id,steps)values(actor,last_event.event_id,1);$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected shortcut award baseline';end if;
 body:=replace(body,anchor,$a$insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,last_event.event_id,1,'shortcut');$a$);
 anchor:=$a$if p_action='exercise'then$a$;
 body:=replace(body,anchor,anchor||$a$
  if pos=28 and game.ride_choice is null then raise exception 'Skjutsen väntar på ruta 28. Välj ditt svar först.'using errcode='42501';end if;$a$);
 anchor:=$a$insert into private.adventure_events(user_id,seq,event_id,kind,exercise_id,event_date)values(actor,seq_no,req,kind,p_payload->>'exercise_id',d);$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected ride exercise baseline';end if;
 body:=replace(body,anchor,anchor||$a$
  if pos=27 and game.ride_choice='take'then insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,req,1,'ride');end if;$a$);
 anchor:=$a$elsif p_action='mount'then$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected ride branch baseline';end if;
 body:=replace(body,anchor,$a$elsif p_action='ride'then
  if game.ride_choice is not null then raise exception 'Valet på ruta 28 är redan sparat och kan inte ändras.'using errcode='42501';end if;
  if pos<>28 or pending is not null then raise exception 'Skjutsen finns på ruta 28.'using errcode='42501';end if;
  if p_payload->>'choice' is null or p_payload->>'choice'not in('take','keep')then raise exception 'Tacka ja eller nej till skjutsen.'using errcode='22023';end if;
  if p_payload->>'choice'='take'then
   select e.* into last_event from private.adventure_events e where e.user_id=actor and e.kind='exercise'order by e.seq desc limit 1;
   insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,last_event.event_id,1,'ride');
  end if;
  update private.adventure_games set ride_choice=p_payload->>'choice'where user_id=actor;
 $a$||anchor);execute body;
end $patch$;
notify pgrst,'reload schema';
commit;
