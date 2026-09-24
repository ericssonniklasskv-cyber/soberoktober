create table public.daily_result_activity_events (
  event_id bigint generated always as identity primary key,
  daily_result_id uuid not null references public.daily_results(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  result_date date not null,
  multiplier smallint not null check (multiplier in (1, 2, 3)),
  previous_multiplier smallint check (previous_multiplier in (1, 2, 3)),
  activity_type text not null check (activity_type in ('completed', 'upgraded')),
  event_at timestamptz not null default now(),
  constraint daily_result_activity_previous_check check (
    (activity_type = 'completed' and previous_multiplier is null)
    or (activity_type = 'upgraded' and previous_multiplier is not null and multiplier > previous_multiplier)
  )
);

create index daily_result_activity_events_feed_idx
  on public.daily_result_activity_events (event_at desc, event_id desc);

alter table public.daily_result_activity_events enable row level security;
revoke all on table public.daily_result_activity_events from public, anon, authenticated;

create or replace function private.record_daily_result_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.daily_result_activity_events (
      daily_result_id, user_id, result_date, multiplier, activity_type
    ) values (
      new.id, new.user_id, new.result_date, new.multiplier, 'completed'
    );
  elsif new.multiplier > old.multiplier then
    insert into public.daily_result_activity_events (
      daily_result_id, user_id, result_date, multiplier, previous_multiplier, activity_type
    ) values (
      new.id, new.user_id, new.result_date, new.multiplier, old.multiplier, 'upgraded'
    );
  end if;
  return new;
end;
$$;

revoke all on function private.record_daily_result_activity() from public, anon, authenticated, service_role;

create trigger record_daily_result_activity
after insert or update of multiplier on public.daily_results
for each row execute function private.record_daily_result_activity();

create or replace function public.get_activity_feed(p_limit integer default 4, p_offset integer default 0)
returns table (
  display_name text,
  multiplier smallint,
  activity_type text,
  event_at timestamptz,
  result_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.display_name,
    events.multiplier,
    events.activity_type,
    events.event_at,
    events.result_date
  from public.daily_result_activity_events as events
  inner join public.profiles as profiles on profiles.id = events.user_id
  where events.result_date >= date '2026-10-01'
    and events.result_date <= date '2026-10-31'
    and nullif(btrim(profiles.display_name), '') is not null
  order by events.event_at desc, events.event_id desc
  limit least(greatest(coalesce(p_limit, 4), 1), 51)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_activity_feed(integer, integer) from public;
grant execute on function public.get_activity_feed(integer, integer) to anon, authenticated;
