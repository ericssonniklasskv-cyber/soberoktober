-- Supabase upsert updates every submitted column on conflict, including its keys.
-- Existing RLS still requires the current user and today's Swedish calendar date.
-- Keep points generated and all other write permissions unchanged.
grant update (user_id, result_date) on public.daily_results to authenticated;
