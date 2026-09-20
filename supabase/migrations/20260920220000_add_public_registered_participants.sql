grant select (display_name) on table public.profiles to anon;

create policy "Public can read participant display names"
on public.profiles
for select
to anon
using (
  display_name is not null
  and btrim(display_name) <> ''
);

create or replace function public.get_registered_participants()
returns table (display_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select profiles.display_name
  from public.profiles
  where profiles.display_name is not null
    and btrim(profiles.display_name) <> ''
  order by lower(profiles.display_name), profiles.display_name;
$$;

revoke execute on function public.get_registered_participants() from public;
revoke execute on function public.get_registered_participants() from authenticated;
revoke execute on function public.get_registered_participants() from service_role;
grant execute on function public.get_registered_participants() to anon;
