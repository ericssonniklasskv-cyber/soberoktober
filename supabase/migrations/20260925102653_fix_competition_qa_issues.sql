-- Keep participant notification reads behind a narrow authenticated RPC.
-- The underlying event table still does not grant SELECT on eliminated_user_id.
create or replace function private.claim_unseen_elimination_event()
returns table (
  event_id uuid,
  display_name text,
  elimination_reason text,
  eliminated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles as profile
    where profile.id = v_user_id
      and nullif(btrim(profile.display_name), '') is not null
  ) then
    return;
  end if;

  return query
  with candidates as materialized (
    select events.event_id, events.display_name,
           events.elimination_reason, events.eliminated_at
    from public.elimination_events as events
    where events.is_active
      and events.eliminated_user_id <> v_user_id
      and not exists (
        select 1 from public.elimination_event_receipts as receipts
        where receipts.event_id = events.event_id
          and receipts.recipient_user_id = v_user_id
      )
    order by events.eliminated_at, events.event_id
    limit 1
  ), claimed as (
    insert into public.elimination_event_receipts as receipt
      (event_id, recipient_user_id)
    select candidates.event_id, v_user_id
    from candidates
    on conflict on constraint elimination_event_receipts_pkey do nothing
    returning receipt.event_id
  )
  select candidates.event_id, candidates.display_name,
         candidates.elimination_reason, candidates.eliminated_at
  from candidates
  inner join claimed on claimed.event_id = candidates.event_id;
end;
$$;

revoke all on function private.claim_unseen_elimination_event()
  from public, anon, authenticated, service_role;
grant execute on function private.claim_unseen_elimination_event()
  to authenticated;

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
  select * from private.claim_unseen_elimination_event();
$$;

revoke all on function public.get_unseen_elimination_events()
  from public, anon, service_role;
grant execute on function public.get_unseen_elimination_events()
  to authenticated;

-- A manual restoration forgives missed-day pairs already closed at that time.
-- Newly closed pairs after restoration can still eliminate the participant.
alter table public.profiles
  add column auto_elimination_recheck_after date not null
  default date '2026-10-01';

create or replace function private.find_missed_day_elimination(
  p_user_id uuid, p_closed_through date
)
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
  where candidate.day::date > (
    select profile.auto_elimination_recheck_after
    from public.profiles as profile
    where profile.id = p_user_id
  )
  and not exists (
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
      current_elimination_event_id = null,
      auto_elimination_recheck_after = greatest(
        date '2026-10-01',
        (pg_catalog.timezone('Europe/Stockholm', now()))::date
      )
  where id = p_user_id;
end;
$$;

-- The client's upsert remains owner-only and is now limited to the current,
-- published Swedish calendar day in October 2026.
alter policy "Users can create their own daily results"
on public.daily_results
with check (
  (select auth.uid()) = user_id
  and result_date between date '2026-10-01' and date '2026-10-31'
  and result_date = (pg_catalog.timezone('Europe/Stockholm', now()))::date
  and exists (
    select 1 from public.daily_challenges as challenge
    where challenge.challenge_date = result_date
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
    select 1 from public.daily_challenges as challenge
    where challenge.challenge_date = result_date
  )
);
