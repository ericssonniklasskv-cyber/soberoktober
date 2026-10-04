-- Apply only with the approved frontend release. Preparation leaves this flag false.
create or replace function private.bingo_enabled() returns boolean language sql immutable set search_path='' as $$ select true; $$;
revoke all on function private.bingo_enabled() from public,anon,authenticated;
