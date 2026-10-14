-- Disable automatic missed-day elimination for the rest of the competition.
-- Keep function signatures for existing RPCs, triggers and scheduled callers.
-- Alcohol elimination, stored statuses, scoring and website rule text stay intact.
create or replace function private.find_missed_day_elimination(
  p_user_id uuid, p_closed_through date
)
returns date
language sql stable security invoker set search_path = ''
as $$ select null::date; $$;

create or replace function private.evaluate_user_elimination(
  p_user_id uuid, p_closed_through date
)
returns uuid
language sql stable security invoker set search_path = ''
as $$ select null::uuid; $$;
