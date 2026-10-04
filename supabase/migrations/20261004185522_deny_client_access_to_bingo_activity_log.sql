create policy deny_client_bingo_activity_access on private.bingo_activity_events for all to anon,authenticated using (false) with check (false);
