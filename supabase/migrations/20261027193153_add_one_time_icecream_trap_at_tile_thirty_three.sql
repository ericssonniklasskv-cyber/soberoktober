-- One permanent tile-33 choice; an anchored -1 map adjustment, never lost training/points.
begin;
alter table private.adventure_games add column icecream_choice text check(icecream_choice in('take','keep'));
alter table private.adventure_step_credits drop constraint adventure_step_credits_steps_check;
alter table private.adventure_step_credits add constraint adventure_step_credits_steps_check check(steps in(-1,1,6));
alter table private.adventure_step_credits drop constraint adventure_bonus_source_check;
alter table private.adventure_step_credits add constraint adventure_bonus_source_check check((steps=6 and bonus_source='legacy')or(steps=1 and bonus_source in('shortcut','ride'))or(steps=-1 and bonus_source='icecream'));
create unique index adventure_one_icecream_setback_per_user on private.adventure_step_credits(user_id)where steps=-1;
do $patch$
declare body text;anchor text;begin
 body:=pg_get_functiondef('private.adventure_state(uuid)'::regprocedure);
 anchor:=$a$'version',3,'rideChoice'$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream state baseline';end if;
 body:=replace(body,anchor,$a$'version',3,'icecreamChoice',(select icecream_choice from private.adventure_games where user_id=p_actor),'rideChoice'$a$);
 anchor:=$a$'at',e.created_at) data$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream activity baseline';end if;
 body:=replace(body,anchor,$a$'at',e.created_at,'step_adjustment',coalesce((select c.steps from private.adventure_step_credits c where c.user_id=e.user_id and c.event_id=e.event_id),0)) data$a$);
 execute body;
 body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
 anchor:=$a$('get','exercise','boss','undo','mount','seen','treat_seen','bonus','unbonus','shortcut','ride')$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream action whitelist';end if;
 body:=replace(body,anchor,$a$('get','exercise','boss','undo','mount','seen','treat_seen','bonus','unbonus','shortcut','ride','icecream')$a$);
 anchor:=$a$in('exercise','boss','undo','bonus','unbonus','shortcut','ride')$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream active-date guard';end if;
 body:=replace(body,anchor,$a$in('exercise','boss','undo','bonus','unbonus','shortcut','ride','icecream')$a$);
 anchor:=$a$in('exercise','boss','undo','mount','shortcut','ride')$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream revision guard';end if;
 body:=replace(body,anchor,$a$in('exercise','boss','undo','mount','shortcut','ride','icecream')$a$);
 anchor:=$a$if p_action='get' then return private.adventure_state(actor);end if;$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream get baseline';end if;
 body:=replace(body,anchor,$a$if p_payload->>'icecream_version' is distinct from '1'and(game.icecream_choice is not null or(private.adventure_progress(actor)->>'position')::integer>=33)then raise exception 'Ett nytt fynd väntar. Ladda om sidan för att fortsätta – din resa är sparad.'using errcode='22023';end if;
 $a$||anchor);
 anchor:=$a$if p_action='exercise'then$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream exercise gate';end if;
 body:=replace(body,anchor,anchor||$a$
  if pos=33 and game.icecream_choice is null then raise exception 'Ett glassfynd väntar på ruta 33. Välj ditt svar först.'using errcode='42501';end if;$a$);
 anchor:=$a$insert into private.adventure_events(user_id,seq,event_id,kind,exercise_id,event_date)values(actor,seq_no,req,kind,p_payload->>'exercise_id',d);$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream arrival baseline';end if;
 body:=replace(body,anchor,anchor||$a$
  -- Restore the same single setback only if its original arrival was undone.
  if pos=32 and game.icecream_choice='take'and not exists(select 1 from private.adventure_step_credits c where c.user_id=actor and c.bonus_source='icecream')then
   insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,req,-1,'icecream');
  end if;$a$);
 anchor:=$a$elsif p_action='mount'then$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected icecream branch baseline';end if;
 body:=replace(body,anchor,$a$elsif p_action='icecream'then
  if game.icecream_choice is not null then raise exception 'Valet på ruta 33 är redan sparat och kan inte ändras.'using errcode='42501';end if;
  if pos<>33 or pending is not null then raise exception 'Glassfyndet finns på ruta 33.'using errcode='42501';end if;
  if p_payload->>'choice' is null or p_payload->>'choice'not in('take','keep')then raise exception 'Ta glassen eller låt den ligga.'using errcode='22023';end if;
  if p_payload->>'choice'='take'then
   select e.* into last_event from private.adventure_events e where e.user_id=actor and e.kind='exercise'order by e.seq desc limit 1;
   if last_event.event_id is null then raise exception 'Ankomstövningen saknas.'using errcode='42501';end if;
   insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,last_event.event_id,-1,'icecream');
  end if;
  update private.adventure_games set icecream_choice=p_payload->>'choice'where user_id=actor;
 $a$||anchor);
 execute body;
end $patch$;
notify pgrst,'reload schema';
commit;
