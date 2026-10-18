-- Synthetic local development data. Run through npm run seed:local only.
-- Users are created by the local Auth Admin API, not by editing auth tables.
-- Existing challenge edits survive another seed run.
insert into public.daily_challenges(challenge_date,title,description,base_amount,unit,completion_mode,bonus_description,bonus_points)
select day::date,'Lokalt testpass ' || extract(day from day)::integer,
  'Gör 15 squats – exempelpass för lokal utveckling.',15,'squats','single',
  'Ta en kort promenad – lokal testbonus.',1
from generate_series(date '2026-10-01',date '2026-10-31',interval '1 day')day
on conflict(challenge_date) do nothing;
