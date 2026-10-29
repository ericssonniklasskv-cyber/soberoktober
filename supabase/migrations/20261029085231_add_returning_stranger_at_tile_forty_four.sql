-- Tile 44: permanent answer, persisted escape mission, then exactly one -1 adjustment.
begin;
alter table private.adventure_games add column return_ride_choice text check(return_ride_choice in('take','keep'));
alter table private.adventure_games add column return_ride_escaped boolean not null default false;
alter table private.adventure_games add constraint adventure_return_escape_check check(not return_ride_escaped or return_ride_choice is not distinct from 'take');
alter table private.adventure_step_credits drop constraint adventure_bonus_source_check;
alter table private.adventure_step_credits add constraint adventure_bonus_source_check check((steps=6 and bonus_source='legacy')or(steps=1 and bonus_source in('shortcut','ride'))or(steps=-1 and bonus_source in('icecream','return_ride')));
drop index private.adventure_one_icecream_setback_per_user;
create unique index adventure_one_setback_per_kind on private.adventure_step_credits(user_id,bonus_source)where steps=-1;
do $patch$
declare body text;anchor text;begin
 body:=pg_get_functiondef('private.adventure_state(uuid)'::regprocedure);
 anchor:=$a$'version',3,'icecreamChoice'$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return state baseline';end if;
 body:=replace(body,anchor,$a$'version',3,'returnRideChoice',(select return_ride_choice from private.adventure_games where user_id=p_actor),'returnRideEscaped',(select return_ride_escaped from private.adventure_games where user_id=p_actor),'icecreamChoice'$a$);
 anchor:=$a$'step_adjustment',coalesce((select c.steps$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return activity baseline';end if;
 body:=replace(body,anchor,$a$'adjustment_source',(select c.bonus_source from private.adventure_step_credits c where c.user_id=e.user_id and c.event_id=e.event_id),'step_adjustment',coalesce((select c.steps$a$);
 execute body;
 body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
 anchor:=$a$('get','exercise','boss','undo','mount','seen','treat_seen','bonus','unbonus','shortcut','ride','icecream')$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return whitelist';end if;
 body:=replace(body,anchor,$a$('get','exercise','boss','undo','mount','seen','treat_seen','bonus','unbonus','shortcut','ride','icecream','return_ride','return_escape')$a$);
 anchor:=$a$in('exercise','boss','undo','bonus','unbonus','shortcut','ride','icecream')$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return active date guard';end if;
 body:=replace(body,anchor,$a$in('exercise','boss','undo','bonus','unbonus','shortcut','ride','icecream','return_ride','return_escape')$a$);
 anchor:=$a$in('exercise','boss','undo','mount','shortcut','ride','icecream')$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return revision guard';end if;
 body:=replace(body,anchor,$a$in('exercise','boss','undo','mount','shortcut','ride','icecream','return_ride','return_escape')$a$);
 anchor:=$a$if p_action='get' then return private.adventure_state(actor);end if;$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return client guard';end if;
 body:=replace(body,anchor,$a$if p_payload->>'return_ride_version' is distinct from '1'and(game.return_ride_choice is not null or(private.adventure_progress(actor)->>'position')::integer>=44)then raise exception 'Ett nytt återseende väntar. Ladda om sidan för att fortsätta – din resa är sparad.'using errcode='22023';end if;
 $a$||anchor);
 anchor:=$a$if p_action='exercise'then$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return exercise gate';end if;
 body:=replace(body,anchor,anchor||$a$
  if game.return_ride_choice='take'and not game.return_ride_escaped then raise exception 'Klara flyktuppdraget med 15 extra squats först.'using errcode='42501';end if;
  if pos=44 and game.return_ride_choice is null then raise exception 'Gubben väntar på ditt svar på ruta 44.'using errcode='42501';end if;$a$);
 anchor:=$a$elsif p_action='undo'then$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return undo gate';end if;
 body:=replace(body,anchor,anchor||$a$
  if game.return_ride_choice='take'and not game.return_ride_escaped then raise exception 'Klara flyktuppdraget med 15 extra squats först.'using errcode='42501';end if;$a$);
 anchor:=$a$insert into private.adventure_events(user_id,seq,event_id,kind,exercise_id,event_date)values(actor,seq_no,req,kind,p_payload->>'exercise_id',d);$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return arrival baseline';end if;
 body:=replace(body,anchor,anchor||$a$
  if pos=43 and game.return_ride_choice='take'and game.return_ride_escaped and not exists(select 1 from private.adventure_step_credits c where c.user_id=actor and c.bonus_source='return_ride')then
   insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,req,-1,'return_ride');
  end if;$a$);
 anchor:=$a$elsif p_action='mount'then$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected return action branch';end if;
 body:=replace(body,anchor,$a$elsif p_action='return_ride'then
  if game.return_ride_choice is not null then raise exception 'Valet på ruta 44 är redan sparat och kan inte ändras.'using errcode='42501';end if;
  if pos<>44 or pending is not null then raise exception 'Återseendet finns på ruta 44.'using errcode='42501';end if;
  if p_payload->>'choice' is null or p_payload->>'choice'not in('take','keep')then raise exception 'Ta skjuts eller fortsätt utan skjuts.'using errcode='22023';end if;
  update private.adventure_games set return_ride_choice=p_payload->>'choice'where user_id=actor;
 elsif p_action='return_escape'then
  if game.return_ride_choice is distinct from 'take'or game.return_ride_escaped or pos<>44 or pending is not null then raise exception 'Det finns inget pågående flyktuppdrag.'using errcode='42501';end if;
  select e.* into last_event from private.adventure_events e where e.user_id=actor and e.kind='exercise'order by e.seq desc limit 1;
  if last_event.event_id is null then raise exception 'Ankomstövningen saknas.'using errcode='42501';end if;
  insert into private.adventure_step_credits(user_id,event_id,steps,bonus_source)values(actor,last_event.event_id,-1,'return_ride');
  update private.adventure_games set return_ride_escaped=true where user_id=actor;
 $a$||anchor);
 execute body;
end $patch$;
notify pgrst,'reload schema';
commit;
