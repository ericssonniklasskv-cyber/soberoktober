create policy deny_direct_access on private.self_result_write_context for all to public using (false) with check (false);
comment on table private.self_result_write_context is 'Internal transaction-only capability. No client access; rows are removed before the correction RPC returns.';
