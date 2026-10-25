-- PRODUCTION MUTATION: only after explicit human approval, migration review and target verification.
-- A deploy alone does not enable database writes. This activation is a separate transaction.
begin;
do $$begin
 if exists(select 1 from public.daily_results where result_date between date '2026-10-26'and date '2026-10-31')then raise exception 'Existing final-week normal workout scores require manual review.';end if;
 if exists(select * from (values ('56eb1611-deae-4b0a-99c1-5a73c66fcfd0'::uuid,'elliott-da-bomb'),('8b58969b-fc96-4934-882e-aba9d13b3d39'::uuid,'jerka'),('03c84aa4-cf6f-4ff4-a947-17773ed30abb'::uuid,'mikeb'),('3762adf9-f59e-473f-bb4b-47c45a858585'::uuid,'nillebae'),('25b7ec21-e28b-41aa-b33c-fba048992fe7'::uuid,'zellmani'))expected(user_id,pawn_id)except select user_id,pawn_id from private.adventure_personal_pawns)or(select count(*)from private.adventure_personal_pawns)<>5 then raise exception 'All five verified account-ID/pawn bindings must match before activation.';end if;
end $$;
update private.adventure_settings set enabled=true where singleton;
commit;
