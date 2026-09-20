create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 2 and 32)
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) = id
  and email = (select auth.jwt() ->> 'email')
  and display_name is null
);

create policy "Users can update their own display name"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
