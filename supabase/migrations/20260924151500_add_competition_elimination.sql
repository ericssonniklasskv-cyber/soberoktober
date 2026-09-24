alter table public.profiles
  add column competition_status text not null default 'active',
  add column eliminated_at timestamptz,
  add column elimination_reason text,
  add column current_elimination_event_id uuid;

alter table public.profiles
  add constraint profiles_competition_status_check
    check (competition_status in ('active', 'eliminated')),
  add constraint profiles_elimination_fields_check
    check (
      (competition_status = 'active' and eliminated_at is null and elimination_reason is null and current_elimination_event_id is null)
      or (competition_status = 'eliminated' and eliminated_at is not null and elimination_reason is not null and current_elimination_event_id is not null)
    );

grant select (competition_status) on table public.profiles to anon;

create table public.elimination_events (
  event_id uuid primary key default gen_random_uuid(),
  eliminated_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  elimination_reason text not null,
  eliminated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index elimination_events_active_recent_idx
  on public.elimination_events (eliminated_at desc)
  where is_active;

alter table public.profiles
  add constraint profiles_current_elimination_event_fkey
  foreign key (current_elimination_event_id)
  references public.elimination_events(event_id);

revoke insert on table public.profiles from authenticated;
grant insert (id, email) on table public.profiles to authenticated;

alter table public.elimination_events enable row level security;
revoke all on table public.elimination_events from anon, authenticated;
grant select (event_id, display_name, elimination_reason, eliminated_at)
  on table public.elimination_events to authenticated;

create policy "Participants can read active eliminations except their own"
on public.elimination_events
for select
to authenticated
using (is_active and eliminated_user_id <> (select auth.uid()));

create table public.elimination_event_receipts (
  event_id uuid not null references public.elimination_events(event_id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (event_id, recipient_user_id)
);

create index elimination_event_receipts_recipient_idx
  on public.elimination_event_receipts (recipient_user_id, event_id);

alter table public.elimination_event_receipts enable row level security;
revoke all on table public.elimination_event_receipts from anon, authenticated;
grant select (event_id, recipient_user_id) on table public.elimination_event_receipts to authenticated;
grant insert (event_id, recipient_user_id) on table public.elimination_event_receipts to authenticated;

create policy "Users can read their own elimination receipts"
on public.elimination_event_receipts
for select
to authenticated
using ((select auth.uid()) = recipient_user_id);

create policy "Users can create their own elimination receipts for active events"
on public.elimination_event_receipts
for insert
to authenticated
with check (
  (select auth.uid()) = recipient_user_id
  and exists (
    select 1
    from public.elimination_events as events
    where events.event_id = elimination_event_receipts.event_id
      and events.is_active
      and events.eliminated_user_id <> (select auth.uid())
  )
);

create or replace function private.apply_elimination(p_user_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_status text;
  v_event_id uuid;
begin
  select profiles.display_name, profiles.competition_status
    into v_display_name, v_status
  from public.profiles
  where profiles.id = p_user_id
  for update;

  if not found or v_display_name is null or btrim(v_display_name) = '' or v_status = 'eliminated' then
    return null;
  end if;

  insert into public.elimination_events (
    eliminated_user_id, display_name, elimination_reason
  ) values (
    p_user_id, v_display_name, p_reason
  ) returning event_id into v_event_id;

  update public.profiles
  set competition_status = 'eliminated',
      eliminated_at = now(),
      elimination_reason = p_reason,
      current_elimination_event_id = v_event_id
  where id = p_user_id
    and competition_status = 'active';

  if not found then
    update public.elimination_events
    set is_active = false
    where event_id = v_event_id;
    return null;
  end if;

  return v_event_id;
end;
$$;

create or replace function private.find_missed_day_elimination(p_user_id uuid, p_closed_through date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select candidate.day::date
  from pg_catalog.generate_series(
    date '2026-10-02',
    least(p_closed_through, date '2026-10-31'),
    interval '1 day'
  ) as candidate(day)
  where not exists (
    select 1 from public.daily_results as result
    where result.user_id = p_user_id
      and result.result_date = candidate.day::date
  )
  and not exists (
    select 1 from public.daily_results as result
    where result.user_id = p_user_id
      and result.result_date = (candidate.day::date - 1)
  )
  order by candidate.day
  limit 1;
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

create or replace function private.sync_my_competition_status()
returns table (
  status text,
  eliminated_at timestamptz,
  elimination_reason text,
  current_elimination_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (pg_catalog.timezone('Europe/Stockholm', now()))::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform private.evaluate_user_elimination(v_user_id, v_today - 1);

  return query
  select profiles.competition_status,
         profiles.eliminated_at,
         profiles.elimination_reason,
         profiles.current_elimination_event_id
  from public.profiles
  where profiles.id = v_user_id;
end;
$$;

create or replace function public.sync_competition_status()
returns table (
  status text,
  eliminated_at timestamptz,
  elimination_reason text,
  current_elimination_event_id uuid
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.sync_my_competition_status();
$$;

create or replace function private.process_missed_competition_days()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.timezone('Europe/Stockholm', now()))::date;
  v_local_time time := (pg_catalog.timezone('Europe/Stockholm', now()))::time;
  v_user record;
  v_count integer := 0;
begin
  if v_local_time >= time '00:15' or v_today < date '2026-10-02' then
    return 0;
  end if;

  for v_user in
    select profiles.id
    from public.profiles
    where profiles.competition_status = 'active'
      and profiles.display_name is not null
      and btrim(profiles.display_name) <> ''
  loop
    if private.evaluate_user_elimination(v_user.id, v_today - 1) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  if v_today > date '2026-11-01' then
    perform cron.unschedule(job.jobid)
    from cron.job as job
    where job.jobname = 'soberoktober-elimination-window-check';
  end if;

  return v_count;
end;
$$;

create or replace function public.get_unseen_elimination_events()
returns table (
  event_id uuid,
  display_name text,
  elimination_reason text,
  eliminated_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $$
  with candidates as materialized (
    select events.event_id, events.display_name, events.elimination_reason, events.eliminated_at
    from public.elimination_events as events
    where not exists (
        select 1
        from public.elimination_event_receipts as receipts
        where receipts.event_id = events.event_id
          and receipts.recipient_user_id = (select auth.uid())
      )
    order by events.eliminated_at, events.event_id
    limit 1
  ), claimed as (
    insert into public.elimination_event_receipts (event_id, recipient_user_id)
    select candidates.event_id, (select auth.uid())
    from candidates
    on conflict (event_id, recipient_user_id) do nothing
    returning event_id
  )
  select candidates.event_id, candidates.display_name, candidates.elimination_reason, candidates.eliminated_at
  from candidates
  inner join claimed using (event_id)
  order by candidates.eliminated_at, candidates.event_id;
$$;

create or replace function private.admin_eliminate_participant(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles as admin
    where admin.id = (select auth.uid()) and admin.is_admin is true
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  perform private.apply_elimination(p_user_id, 'Alkohol');
end;
$$;

create or replace function public.admin_eliminate_participant(p_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.admin_eliminate_participant(p_user_id); $$;

create or replace function private.admin_restore_participant(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if not exists (
    select 1 from public.profiles as admin
    where admin.id = (select auth.uid()) and admin.is_admin is true
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select current_elimination_event_id into v_event_id
  from public.profiles
  where id = p_user_id
    and competition_status = 'eliminated'
  for update;

  if not found then
    return;
  end if;

  update public.elimination_events
  set is_active = false
  where event_id = v_event_id;

  update public.profiles
  set competition_status = 'active',
      eliminated_at = null,
      elimination_reason = null,
      current_elimination_event_id = null
  where id = p_user_id;
end;
$$;

create or replace function public.admin_restore_participant(p_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.admin_restore_participant(p_user_id); $$;

create or replace function private.admin_list_competition_participants()
returns table (
  participant_id uuid,
  display_name text,
  status text,
  eliminated_at timestamptz,
  elimination_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles as admin
    where admin.id = (select auth.uid()) and admin.is_admin is true
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select profiles.id,
         profiles.display_name,
         profiles.competition_status,
         profiles.eliminated_at,
         profiles.elimination_reason
  from public.profiles
  where profiles.display_name is not null
    and btrim(profiles.display_name) <> ''
  order by lower(profiles.display_name), profiles.display_name;
end;
$$;

create or replace function public.get_admin_competition_participants()
returns table (
  participant_id uuid,
  display_name text,
  status text,
  eliminated_at timestamptz,
  elimination_reason text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.admin_list_competition_participants(); $$;

drop function public.get_registered_participants();

create function public.get_registered_participants()
returns table (
  display_name text,
  is_eliminated boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select profiles.display_name, profiles.competition_status = 'eliminated'
  from public.profiles
  where profiles.display_name is not null
    and btrim(profiles.display_name) <> ''
  order by lower(profiles.display_name), profiles.display_name;
$$;

drop function public.get_leaderboard();

create function public.get_leaderboard()
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
           row_number() over (
             order by total_points desc, completed_days desc, lower(display_name), id
           )::bigint as rank_position
    from participant_scores
  )
  select rank_position, display_name, total_points, completed_days,
         id = (select auth.uid()), is_eliminated
  from ranked_scores
  order by rank_position;
$$;

revoke all on function public.sync_competition_status() from public, anon, service_role;
grant execute on function public.sync_competition_status() to authenticated;
revoke all on function public.get_unseen_elimination_events() from public, anon, service_role;
grant execute on function public.get_unseen_elimination_events() to authenticated;
revoke all on function public.admin_eliminate_participant(uuid) from public, anon, service_role;
grant execute on function public.admin_eliminate_participant(uuid) to authenticated;
revoke all on function public.admin_restore_participant(uuid) from public, anon, service_role;
grant execute on function public.admin_restore_participant(uuid) to authenticated;
revoke all on function public.get_admin_competition_participants() from public, anon, service_role;
grant execute on function public.get_admin_competition_participants() to authenticated;
revoke all on function public.get_registered_participants() from public, authenticated, service_role;
grant execute on function public.get_registered_participants() to anon;
revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;

revoke all on function private.apply_elimination(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.find_missed_day_elimination(uuid, date) from public, anon, authenticated, service_role;
revoke all on function private.evaluate_user_elimination(uuid, date) from public, anon, authenticated, service_role;
revoke all on function private.process_missed_competition_days() from public, anon, authenticated, service_role;
revoke all on function private.admin_eliminate_participant(uuid) from public, anon, service_role;
grant execute on function private.admin_eliminate_participant(uuid) to authenticated;
revoke all on function private.admin_restore_participant(uuid) from public, anon, service_role;
grant execute on function private.admin_restore_participant(uuid) to authenticated;
revoke all on function private.admin_list_competition_participants() from public, anon, service_role;
grant execute on function private.admin_list_competition_participants() to authenticated;
revoke all on function private.sync_my_competition_status() from public, anon, service_role;
grant execute on function private.sync_my_competition_status() to authenticated;

create or replace function public.reject_eliminated_competition_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is not null and v_actor <> new.user_id then
    raise exception 'Users may only submit their own competition results.' using errcode = '42501';
  end if;

  perform private.evaluate_user_elimination(
    new.user_id,
    (pg_catalog.timezone('Europe/Stockholm', now()))::date - 1
  );

  select profiles.competition_status into v_status
  from public.profiles
  where profiles.id = new.user_id
  for share;

  if v_status = 'eliminated' then
    raise exception 'Du är utslagen ur tävlingen.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_eliminated_competition_score() from public, anon, authenticated, service_role;

create trigger reject_eliminated_daily_result_writes
before insert or update on public.daily_results
for each row execute function public.reject_eliminated_competition_score();

create trigger reject_eliminated_step_result_writes
before insert or update on public.step_period_results
for each row execute function public.reject_eliminated_competition_score();

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'soberoktober-elimination-window-check',
  '*/15 * * * *',
  'select private.process_missed_competition_days();'
);
