-- Pause automatic missed-day elimination for October 5–11, 2026.
-- Alcohol elimination, existing statuses, scoring and permissions are unchanged.

create or replace function private.find_missed_day_elimination(p_user_id uuid,p_closed_through date)
returns date language sql stable security definer set search_path='' as $$
 select candidate.day::date from generate_series(date '2026-10-02',least(p_closed_through,date '2026-10-31'),interval '1 day') candidate(day)
 where candidate.day::date>(select auto_elimination_recheck_after from public.profiles where id=p_user_id)
 -- Both days of a missed pair must be outside the paused week.
 -- Keep this exclusion after October 11 so paused days cannot eliminate later.
 and candidate.day::date not between date '2026-10-05' and date '2026-10-12'
 and not private.competition_day_complete(p_user_id,candidate.day::date)
 and not private.competition_day_complete(p_user_id,candidate.day::date-1)
 order by candidate.day limit 1;
$$;

create or replace function private.evaluate_user_elimination(p_user_id uuid, p_closed_through date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason_date date;
  v_status text;
begin
  -- Callers pass yesterday, in Stockholm time. Pause all automatic checks
  -- on October 5–11, including any previously missed days.
  if p_closed_through + 1 between date '2026-10-05' and date '2026-10-11' then
    return null;
  end if;

  select profiles.competition_status into v_status
  from public.profiles
  where profiles.id = p_user_id
    and profiles.display_name is not null
    and btrim(profiles.display_name) <> ''
  for update;

  if not found or v_status <> 'active' or p_closed_through < date '2026-10-02' then
    return null;
  end if;

  v_reason_date := private.find_missed_day_elimination(p_user_id, p_closed_through);
  if v_reason_date is null then
    return null;
  end if;

  return private.apply_elimination(p_user_id, 'Två missade dagar i rad');
end;
$$;
