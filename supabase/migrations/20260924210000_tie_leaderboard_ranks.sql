create or replace function public.get_leaderboard()
returns table (
  rank_position bigint,
  display_name text,
  total_points numeric,
  completed_days bigint,
  is_current_user boolean,
  is_eliminated boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with participant_scores as (
    select profiles.id,
           profiles.display_name,
           coalesce(sum(daily_results.points), 0)::numeric as total_points,
           count(daily_results.id)::bigint as completed_days,
           profiles.competition_status = 'eliminated' as is_eliminated
    from public.profiles
    left join public.daily_results on daily_results.user_id = profiles.id
    where profiles.display_name is not null
    group by profiles.id, profiles.display_name, profiles.competition_status
  ), ranked_scores as (
    select id, display_name, total_points, completed_days, is_eliminated,
           rank() over (
             order by total_points desc, completed_days desc
           )::bigint as rank_position
    from participant_scores
  )
  select rank_position, display_name, total_points, completed_days,
         id = (select auth.uid()), is_eliminated
  from ranked_scores
  order by rank_position, total_points desc, completed_days desc, lower(display_name), id;
$$;

revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;
