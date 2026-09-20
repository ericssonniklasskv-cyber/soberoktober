drop policy "Users can create their own profile" on public.profiles;

create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) = id
  and email = ((select auth.jwt()) ->> 'email')
  and display_name is null
);
