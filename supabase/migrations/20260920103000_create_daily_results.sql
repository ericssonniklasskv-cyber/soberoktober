create table public.daily_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result_date date not null,
  multiplier smallint not null,
  points numeric(2, 1) generated always as (
    case multiplier
      when 1 then 1.0
      when 2 then 1.5
      when 3 then 2.0
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_results_multiplier_check check (multiplier in (1, 2, 3)),
  constraint daily_results_user_date_key unique (user_id, result_date)
);

create function public.set_daily_results_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_daily_results_updated_at
before update on public.daily_results
for each row execute function public.set_daily_results_updated_at();

revoke all on function public.set_daily_results_updated_at() from public;

alter table public.daily_results enable row level security;

revoke all on table public.daily_results from anon, authenticated;
grant select on table public.daily_results to authenticated;
grant insert (user_id, result_date, multiplier) on table public.daily_results to authenticated;
grant update (multiplier) on table public.daily_results to authenticated;

create policy "Users can read their own daily results"
on public.daily_results
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own daily results"
on public.daily_results
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own daily results"
on public.daily_results
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
