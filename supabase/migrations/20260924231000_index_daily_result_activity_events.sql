create index daily_result_activity_events_daily_result_id_idx
  on public.daily_result_activity_events (daily_result_id);

create index daily_result_activity_events_user_id_idx
  on public.daily_result_activity_events (user_id);
