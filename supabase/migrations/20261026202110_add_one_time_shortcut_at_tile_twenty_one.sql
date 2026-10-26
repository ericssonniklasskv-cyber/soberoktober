-- Permanent account-level decision at tile 21. One map credit, never a workout or point.
begin;
alter table private.adventure_games add column shortcut_choice text check(shortcut_choice in('take','keep'));
alter table private.adventure_step_credits drop constraint adventure_step_credits_steps_check;
alter table private.adventure_step_credits add constraint adventure_step_credits_steps_check check(steps in(1,6));
create unique index adventure_one_shortcut_credit_per_user on private.adventure_step_credits(user_id)where steps=1;
do $patch$
declare body text;anchor text;begin
 body:=pg_get_functiondef('private.adventure_state(uuid)'::regprocedure);
 anchor:=$a$'version',3,'stepCredits'$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected state baseline';end if;
 body:=replace(body,anchor,$a$'version',3,'shortcutChoice',(select shortcut_choice from private.adventure_games where user_id=p_actor),'stepCredits'$a$);execute body;
 body:=pg_get_functiondef('private.adventure_action(text,jsonb)'::regprocedure);
 if position($a$'seen','treat_seen','bonus','unbonus'$a$ in body)=0 or position($a$elsif p_action='mount'then$a$ in body)=0 then raise exception 'Unexpected action baseline';end if;
 body:=replace(body,$a$'seen','treat_seen','bonus','unbonus'$a$,$a$'seen','treat_seen','bonus','unbonus','shortcut'$a$);
 body:=replace(body,$a$in('exercise','boss','undo','bonus','unbonus')$a$,$a$in('exercise','boss','undo','bonus','unbonus','shortcut')$a$);
 body:=replace(body,$a$in('exercise','boss','undo','mount')$a$,$a$in('exercise','boss','undo','mount','shortcut')$a$);
 anchor:=$a$if p_action='get' then return private.adventure_state(actor);end if;$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected get baseline';end if;
 body:=replace(body,anchor,$a$if p_payload->>'shortcut_version' is distinct from '1' and(game.shortcut_choice is not null or(private.adventure_progress(actor)->>'position')::integer>=21)then raise exception 'En hemlig stig har öppnats. Ladda om sidan för att fortsätta – din resa är sparad.'using errcode='22023';end if;
 $a$||anchor);
 anchor:=$a$if p_action='exercise'then$a$;
 body:=replace(body,anchor,anchor||$a$
  if pos=21 and game.shortcut_choice is null then raise exception 'Du har hittat ett vägskäl på ruta 21. Välj din väg först.'using errcode='42501';end if;$a$);
 anchor:=$a$insert into private.adventure_events(user_id,seq,event_id,kind,exercise_id,event_date)values(actor,seq_no,req,kind,p_payload->>'exercise_id',d);$a$;
 if position(anchor in body)=0 then raise exception 'Unexpected exercise baseline';end if;
 body:=replace(body,anchor,anchor||$a$
  -- Undo may remove the arrival exercise and its credit. The decision is permanent;
  -- re-recording that exercise restores the same single credit, never a new choice.
  if pos=20 and game.shortcut_choice='take'then insert into private.adventure_step_credits(user_id,event_id,steps)values(actor,req,1);end if;$a$);
 anchor:=$a$elsif p_action='mount'then$a$;
 body:=replace(body,anchor,$a$elsif p_action='shortcut'then
  if game.shortcut_choice is not null then raise exception 'Valet på ruta 21 är redan sparat och kan inte ändras.'using errcode='42501';end if;
  if pos<>21 or pending is not null then raise exception 'Vägskälet finns på ruta 21.'using errcode='42501';end if;
  if p_payload->>'choice' is null or p_payload->>'choice'not in('take','keep')then raise exception 'Välj en av de två vägarna.'using errcode='22023';end if;
  if p_payload->>'choice'='take'then
   select * into last_event from private.adventure_events where user_id=actor and kind='exercise'order by seq desc limit 1;
   insert into private.adventure_step_credits(user_id,event_id,steps)values(actor,last_event.event_id,1);
  end if;
  update private.adventure_games set shortcut_choice=p_payload->>'choice'where user_id=actor;
 $a$||anchor);execute body;
end $patch$;
notify pgrst,'reload schema';
commit;
