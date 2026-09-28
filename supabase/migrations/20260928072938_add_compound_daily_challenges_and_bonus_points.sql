-- Add optional second workout parts and one-time admin-configured bonus points.
alter table public.daily_challenges
  add column completion_mode text not null default 'single',
  add column second_description text,
  add column second_base_amount integer,
  add column second_unit text,
  add column bonus_description text,
  add column bonus_points integer;

alter table public.daily_challenges
  add constraint daily_challenges_completion_mode_check
    check (completion_mode in ('single', 'and', 'or')),
  add constraint daily_challenges_second_description_check
    check (second_description is null or char_length(second_description) <= 240),
  add constraint daily_challenges_second_unit_check
    check (second_unit is null or char_length(btrim(second_unit)) between 1 and 32),
  add constraint daily_challenges_bonus_description_check
    check (bonus_description is null or char_length(btrim(bonus_description)) between 1 and 240),
  add constraint daily_challenges_bonus_points_check
    check (bonus_points is null or bonus_points between 1 and 100),
  add constraint daily_challenges_parts_consistent_check
    check (
      (
        completion_mode = 'single'
        and second_description is null
        and second_base_amount is null
        and second_unit is null
      )
      or (
        completion_mode in ('and', 'or')
        and base_amount is not null
        and base_amount between 1 and 100000
        and unit is not null and char_length(btrim(unit)) between 1 and 32
        and second_base_amount is not null
        and second_base_amount between 1 and 100000
        and second_unit is not null and char_length(btrim(second_unit)) between 1 and 32
      )
    ),
  add constraint daily_challenges_bonus_consistent_check
    check (
      (bonus_description is null and bonus_points is null)
      or (
        bonus_description is not null
        and btrim(bonus_description) <> ''
        and bonus_points is not null
        and bonus_points between 1 and 100
      )
    );

grant insert (
  challenge_date, title, description, unit, base_amount,
  completion_mode, second_description, second_base_amount, second_unit,
  bonus_description, bonus_points
) on table public.daily_challenges to authenticated;
grant update (
  challenge_date, title, description, unit, base_amount,
  completion_mode, second_description, second_base_amount, second_unit,
  bonus_description, bonus_points
) on table public.daily_challenges to authenticated;

alter table public.daily_results
  add column completed_parts text[] not null default array['first']::text[];

alter table public.daily_results
  add constraint daily_results_completed_parts_check
    check (
      completed_parts = array['first']::text[]
      or completed_parts = array['second']::text[]
      or completed_parts = array['first', 'second']::text[]
    );

grant insert (user_id, result_date, multiplier, completed_parts)
  on table public.daily_results to authenticated;
grant update (multiplier, completed_parts)
  on table public.daily_results to authenticated;

alter policy "Users can create their own daily results"
on public.daily_results
with check (
  (select auth.uid()) = user_id
  and result_date between date '2026-10-01' and date '2026-10-31'
  and result_date = (pg_catalog.timezone('Europe/Stockholm', now()))::date
  and exists (
    select 1
    from public.daily_challenges as challenge
    where challenge.challenge_date = result_date
      and (
        (challenge.completion_mode = 'single' and completed_parts = array['first']::text[])
        or (challenge.completion_mode = 'and' and completed_parts = array['first', 'second']::text[])
        or challenge.completion_mode = 'or'
      )
  )
);

alter policy "Users can update their own daily results"
on public.daily_results
using (
  (select auth.uid()) = user_id
  and result_date = (pg_catalog.timezone('Europe/Stockholm', now()))::date
)
with check (
  (select auth.uid()) = user_id
  and result_date between date '2026-10-01' and date '2026-10-31'
  and result_date = (pg_catalog.timezone('Europe/Stockholm', now()))::date
  and exists (
    select 1
    from public.daily_challenges as challenge
    where challenge.challenge_date = result_date
      and (
        (challenge.completion_mode = 'single' and completed_parts = array['first']::text[])
        or (challenge.completion_mode = 'and' and completed_parts = array['first', 'second']::text[])
        or challenge.completion_mode = 'or'
      )
  )
);

create table public.daily_bonus_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_date date not null,
  points integer not null check (points between 1 and 100),
  created_at timestamptz not null default now(),
  constraint daily_bonus_claims_user_date_key primary key (user_id, challenge_date),
  constraint daily_bonus_claims_october_date_check
    check (challenge_date between date '2026-10-01' and date '2026-10-31')
);

alter table public.daily_bonus_claims enable row level security;
revoke all on table public.daily_bonus_claims from anon, authenticated;
grant select on table public.daily_bonus_claims to authenticated;

create policy "Users can read their own daily bonus claims"
on public.daily_bonus_claims
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.claim_daily_bonus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (pg_catalog.timezone('Europe/Stockholm', now()))::date;
  v_status text;
  v_points integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_today < date '2026-10-01' or v_today > date '2026-10-31' then
    raise exception 'Bonuspoäng kan bara hämtas under tävlingen.' using errcode = '42501';
  end if;

  select profile.competition_status into v_status
  from public.profiles as profile
  where profile.id = v_user_id
  for update;

  if not found or v_status <> 'active' then
    raise exception 'Du är utslagen ur tävlingen.' using errcode = '42501';
  end if;

  select challenge.bonus_points into v_points
  from public.daily_challenges as challenge
  where challenge.challenge_date = v_today
    and challenge.bonus_description is not null
    and challenge.bonus_points between 1 and 100;

  if not found or v_points is null then
    raise exception 'Ingen bonusuppgift är publicerad för idag.' using errcode = 'P0001';
  end if;

  insert into public.daily_bonus_claims (user_id, challenge_date, points)
  values (v_user_id, v_today, v_points);

  return v_points;
end;
$$;

revoke all on function public.claim_daily_bonus() from public, anon, service_role;
grant execute on function public.claim_daily_bonus() to authenticated;

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
  with daily_scores as (
    select result.user_id,
           sum(result.points)::numeric as total_points,
           count(result.id)::bigint as completed_days
    from public.daily_results as result
    group by result.user_id
  ), bonus_scores as (
    select claim.user_id, sum(claim.points)::numeric as bonus_points
    from public.daily_bonus_claims as claim
    group by claim.user_id
  ), participant_scores as (
    select profile.id,
           profile.display_name,
           (coalesce(daily.total_points, 0) + coalesce(bonus.bonus_points, 0))::numeric as total_points,
           coalesce(daily.completed_days, 0)::bigint as completed_days,
           profile.competition_status = 'eliminated' as is_eliminated
    from public.profiles as profile
    left join daily_scores as daily on daily.user_id = profile.id
    left join bonus_scores as bonus on bonus.user_id = profile.id
    where profile.display_name is not null
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
