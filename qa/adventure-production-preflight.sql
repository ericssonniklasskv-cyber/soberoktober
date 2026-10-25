-- READ ONLY. Run on the approved target; this file never enables or changes anything.
begin read only;
select version,name from supabase_migrations.schema_migrations order by version;
select id,display_name from public.profiles where id in('56eb1611-deae-4b0a-99c1-5a73c66fcfd0','8b58969b-fc96-4934-882e-aba9d13b3d39','03c84aa4-cf6f-4ff4-a947-17773ed30abb','3762adf9-f59e-473f-bb4b-47c45a858585','25b7ec21-e28b-41aa-b33c-fba048992fe7')order by display_name;
-- Must be zero before activation; never delete existing registrations automatically.
select user_id,result_date,points from public.daily_results where result_date between date '2026-10-26'and date '2026-10-31';
select challenge_date,title,bonus_description,bonus_points from public.daily_challenges where challenge_date between date '2026-10-26'and date '2026-10-31' order by challenge_date;
select pg_get_functiondef('private.find_missed_day_elimination(uuid,date)'::regprocedure);
select pg_get_functiondef('private.evaluate_user_elimination(uuid,date)'::regprocedure);
commit;
