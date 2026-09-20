revoke insert on table public.profiles from authenticated;
grant insert (id, email) on table public.profiles to authenticated;

drop policy "Users can create their own profile" on public.profiles;

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) = id
  and email = ((select auth.jwt()) ->> 'email')
  and display_name is null
  and is_admin is false
);

create table public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null,
  title text not null,
  description text,
  unit text,
  base_amount integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_challenges_date_key unique (challenge_date),
  constraint daily_challenges_title_check check (char_length(btrim(title)) between 1 and 80),
  constraint daily_challenges_description_check check (description is null or char_length(description) <= 240),
  constraint daily_challenges_unit_check check (unit is null or char_length(btrim(unit)) between 1 and 32),
  constraint daily_challenges_base_amount_check check (base_amount is null or base_amount > 0)
);

create function public.set_daily_challenges_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_daily_challenges_updated_at
before update on public.daily_challenges
for each row execute function public.set_daily_challenges_updated_at();

revoke all on function public.set_daily_challenges_updated_at() from public;

alter table public.daily_challenges enable row level security;

revoke all on table public.daily_challenges from anon, authenticated;
grant select on table public.daily_challenges to anon, authenticated;
grant insert (challenge_date, title, description, unit, base_amount) on table public.daily_challenges to authenticated;
grant update (challenge_date, title, description, unit, base_amount) on table public.daily_challenges to authenticated;
grant delete on table public.daily_challenges to authenticated;

create policy "Anyone can read daily challenges"
on public.daily_challenges
for select
to anon, authenticated
using (true);

create policy "Admins can create daily challenges"
on public.daily_challenges
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_admin is true
  )
);

create policy "Admins can update daily challenges"
on public.daily_challenges
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_admin is true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_admin is true
  )
);

create policy "Admins can delete daily challenges"
on public.daily_challenges
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_admin is true
  )
);
