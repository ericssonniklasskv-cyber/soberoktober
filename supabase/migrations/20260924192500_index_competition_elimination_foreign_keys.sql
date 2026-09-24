create index if not exists elimination_events_eliminated_user_id_idx
  on public.elimination_events (eliminated_user_id);

create index if not exists profiles_current_elimination_event_id_idx
  on public.profiles (current_elimination_event_id);
