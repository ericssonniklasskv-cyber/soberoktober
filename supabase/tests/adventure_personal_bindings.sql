-- LOCAL ONLY. Entire test rolls back. Production account IDs use fake local records.
begin;
delete from private.adventure_personal_pawns;
insert into auth.users(id,email)values('56eb1611-deae-4b0a-99c1-5a73c66fcfd0','binding-56eb1611-deae-4b0a-99c1-5a73c66fcfd0@example.invalid')on conflict(id)do nothing;
insert into public.profiles(id,email,display_name)values('56eb1611-deae-4b0a-99c1-5a73c66fcfd0','binding-56eb1611-deae-4b0a-99c1-5a73c66fcfd0@example.invalid','Renamed binding fixture 0')on conflict(id)do nothing;
insert into auth.users(id,email)values('8b58969b-fc96-4934-882e-aba9d13b3d39','binding-8b58969b-fc96-4934-882e-aba9d13b3d39@example.invalid')on conflict(id)do nothing;
insert into public.profiles(id,email,display_name)values('8b58969b-fc96-4934-882e-aba9d13b3d39','binding-8b58969b-fc96-4934-882e-aba9d13b3d39@example.invalid','Renamed binding fixture 1')on conflict(id)do nothing;
insert into auth.users(id,email)values('03c84aa4-cf6f-4ff4-a947-17773ed30abb','binding-03c84aa4-cf6f-4ff4-a947-17773ed30abb@example.invalid')on conflict(id)do nothing;
insert into public.profiles(id,email,display_name)values('03c84aa4-cf6f-4ff4-a947-17773ed30abb','binding-03c84aa4-cf6f-4ff4-a947-17773ed30abb@example.invalid','Renamed binding fixture 2')on conflict(id)do nothing;
insert into auth.users(id,email)values('3762adf9-f59e-473f-bb4b-47c45a858585','binding-3762adf9-f59e-473f-bb4b-47c45a858585@example.invalid')on conflict(id)do nothing;
insert into public.profiles(id,email,display_name)values('3762adf9-f59e-473f-bb4b-47c45a858585','binding-3762adf9-f59e-473f-bb4b-47c45a858585@example.invalid','Renamed binding fixture 3')on conflict(id)do nothing;
insert into auth.users(id,email)values('25b7ec21-e28b-41aa-b33c-fba048992fe7','binding-25b7ec21-e28b-41aa-b33c-fba048992fe7@example.invalid')on conflict(id)do nothing;
insert into public.profiles(id,email,display_name)values('25b7ec21-e28b-41aa-b33c-fba048992fe7','binding-25b7ec21-e28b-41aa-b33c-fba048992fe7@example.invalid','Renamed binding fixture 4')on conflict(id)do nothing;
create temporary table binding_name_decoy on commit drop as select gen_random_uuid()id;
insert into auth.users(id,email)select id,'name-decoy-'||id||'@example.invalid'from binding_name_decoy;
insert into public.profiles(id,email,display_name)select id,'name-decoy-'||id||'@example.invalid','Elliott da bomb 💣'from binding_name_decoy;
-- BEGIN_ACTUAL_BINDING
-- Verified production account IDs, read with permission on 25 October 2026.
-- Bind once to identity, including Elliott's emoji-bearing display name.
-- Fresh local databases without these accounts remain unbound; never fall back to names.
do $$ declare item record; begin
 for item in select * from (values ('56eb1611-deae-4b0a-99c1-5a73c66fcfd0'::uuid,'elliott-da-bomb'),('8b58969b-fc96-4934-882e-aba9d13b3d39'::uuid,'jerka'),('03c84aa4-cf6f-4ff4-a947-17773ed30abb'::uuid,'mikeb'),('3762adf9-f59e-473f-bb4b-47c45a858585'::uuid,'nillebae'),('25b7ec21-e28b-41aa-b33c-fba048992fe7'::uuid,'zellmani')) v(user_id,pawn_id) loop
  if exists(select 1 from public.profiles where id=item.user_id)then
   insert into private.adventure_personal_pawns(user_id,pawn_id)values(item.user_id,item.pawn_id);
  end if;
 end loop;
end $$;

-- END_ACTUAL_BINDING
do $$begin if exists(select * from(values ('56eb1611-deae-4b0a-99c1-5a73c66fcfd0'::uuid,'elliott-da-bomb'),('8b58969b-fc96-4934-882e-aba9d13b3d39'::uuid,'jerka'),('03c84aa4-cf6f-4ff4-a947-17773ed30abb'::uuid,'mikeb'),('3762adf9-f59e-473f-bb4b-47c45a858585'::uuid,'nillebae'),('25b7ec21-e28b-41aa-b33c-fba048992fe7'::uuid,'zellmani'))v(user_id,pawn_id)except select user_id,pawn_id from private.adventure_personal_pawns)then raise exception 'Wrong ID/pawn bindings';end if;if(select count(*)from private.adventure_personal_pawns)<>5 then raise exception 'Wrong binding count';end if;end $$;
do $$begin if exists(select 1 from private.adventure_personal_pawns p join binding_name_decoy d on d.id=p.user_id)then raise exception 'Name decoy acquired a personal pawn';end if;end $$;
rollback;
