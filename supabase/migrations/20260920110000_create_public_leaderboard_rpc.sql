create function public.get_leaderboard()
returns table (
  rank_position bigint,
  display_name text,
  total_points numeric,
  completed_days bigint,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with participant_scores as (
    select
      profiles.id,
      profiles.display_name,
      sum(daily_results.points)::numeric as total_points,
      count(*)::bigint as completed_days
    from public.profiles
    inner join public.daily_results
      on daily_results.user_id = profiles.id
    where profiles.display_name is not null
    group by profiles.id, profiles.display_name
  ), ranked_scores as (
    select
      id,
      display_name,
      total_points,
      completed_days,
      row_number() over (
        order by
          total_points desc,
          completed_days desc,
          lower(display_name) asc,
          id asc
      )::bigint as rank_position
    from participant_scores
  )
  select
    rank_position,
    display_name,
    total_points,
    completed_days,
    id = (select auth.uid()) as is_current_user
  from ranked_scores
  order by rank_position;
$$;

revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;
