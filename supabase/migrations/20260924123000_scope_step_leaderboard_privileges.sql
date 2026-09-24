create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.get_step_leaderboard_data()
returns table (
  rank_position bigint,
  display_name text,
  average_steps numeric,
  reported_periods integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with weighted_periods as (
    select
      step_period_results.user_id,
      step_period_results.avg_steps,
      case step_period_results.period_key
        when 'oct_01_07' then 7
        when 'oct_08_14' then 7
        when 'oct_15_21' then 7
        when 'oct_22_31' then 10
      end as period_days
    from public.step_period_results
  ), participant_averages as (
    select
      profiles.id,
      profiles.display_name,
      round(
        sum(weighted_periods.avg_steps::numeric * weighted_periods.period_days)
        / sum(weighted_periods.period_days),
        1
      ) as average_steps,
      count(*)::integer as reported_periods
    from weighted_periods
    inner join public.profiles
      on profiles.id = weighted_periods.user_id
    where profiles.display_name is not null
      and btrim(profiles.display_name) <> ''
    group by profiles.id, profiles.display_name
  ), ranked_averages as (
    select
      id,
      display_name,
      average_steps,
      reported_periods,
      row_number() over (
        order by average_steps desc, reported_periods desc, lower(display_name) asc, id asc
      )::bigint as rank_position
    from participant_averages
  )
  select rank_position, display_name, average_steps, reported_periods
  from ranked_averages
  order by rank_position;
$$;

revoke all on function private.get_step_leaderboard_data() from public;
grant execute on function private.get_step_leaderboard_data() to anon, authenticated;

create or replace function public.get_step_leaderboard()
returns table (
  rank_position bigint,
  display_name text,
  average_steps numeric,
  reported_periods integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select rank_position, display_name, average_steps, reported_periods
  from private.get_step_leaderboard_data()
  order by rank_position;
$$;

revoke all on function public.get_step_leaderboard() from public;
grant execute on function public.get_step_leaderboard() to anon, authenticated;
