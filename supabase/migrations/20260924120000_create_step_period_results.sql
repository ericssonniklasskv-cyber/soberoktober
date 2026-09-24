create table public.step_period_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  avg_steps integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint step_period_results_period_key_check
    check (period_key in ('oct_01_07', 'oct_08_14', 'oct_15_21', 'oct_22_31')),
  constraint step_period_results_avg_steps_check
    check (avg_steps between 1 and 100000),
  constraint step_period_results_user_period_key unique (user_id, period_key)
);

create function public.set_step_period_results_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_step_period_results_updated_at() from public;

create trigger set_step_period_results_updated_at
before update on public.step_period_results
for each row execute function public.set_step_period_results_updated_at();

alter table public.step_period_results enable row level security;

revoke all on table public.step_period_results from anon, authenticated;
grant select (period_key, avg_steps) on table public.step_period_results to authenticated;
grant insert (user_id, period_key, avg_steps) on table public.step_period_results to authenticated;
grant update (avg_steps) on table public.step_period_results to authenticated;

create policy "Users can read their own step period results"
on public.step_period_results
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own step period results"
on public.step_period_results
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own step period results"
on public.step_period_results
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create function private.get_step_leaderboard_data()
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

create function public.get_step_leaderboard()
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
