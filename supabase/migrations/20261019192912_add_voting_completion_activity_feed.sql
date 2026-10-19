-- Keep voted workouts in the same feed/kudos source as earlier competition themes.
-- A private event number identifies a completion, never its participant.
-- Existing completions receive an ID and appear with their original timestamp.
alter table private.workout_vote_completions
  add column activity_id bigint generated always as identity unique;
revoke all on sequence private.workout_vote_completions_activity_id_seq from public,anon,authenticated;

create or replace function private.kudos_feed_events()
returns table(user_id uuid, multiplier smallint, activity_type text,
  event_at timestamptz, result_date date, activity_label text,
  event_id bigint, source_order integer, activity_key text, kudos_label text)
language sql stable security invoker set search_path='' as $$
  select e.user_id,e.multiplier,e.activity_type,e.event_at,e.result_date,
    null::text,e.event_id,0,'daily:'||e.event_id,
    'dagens pass ×'||e.multiplier
  from public.daily_result_activity_events e
  where e.result_date between date '2026-10-01' and date '2026-10-31'
  union all
  select e.user_id,null::smallint,e.activity_type,e.event_at,e.result_date,
    case when e.activity_type='bingo_cell' then private.competition_bingo_board()->e.cell_index->>'description' else null end,
    e.event_id,1,'bingo:'||e.event_id,
    case e.activity_type
      when 'bingo_cell' then private.competition_bingo_board()->e.cell_index->>'description'
      when 'bingo_row' then 'en hel bingorad'
      else 'hela bingobrickan' end
  from private.bingo_activity_events e where e.is_active and private.bingo_enabled()
  union all
  select e.user_id,null::smallint,case when e.round_index=-1 then 'roulette_steps' else 'roulette_pass' end,
    e.event_at,e.result_date,e.activity_label,e.event_id,2,'roulette:'||e.event_id,e.activity_label
  from private.roulette_activity_events e where e.is_active
  union all
  select c.user_id,null::smallint,case when c.kind='steps' then 'vote_steps' else 'vote_pass' end,
    c.completed_at,c.workout_date,
    case when c.kind='steps' then '10 000 steg' else coalesce(nullif(btrim(o.task->>'description'),''),o.task->>'title') end,
    c.activity_id,3,'vote:'||c.activity_id,
    case when c.kind='steps' then '10 000 steg' else coalesce(nullif(btrim(o.task->>'description'),''),o.task->>'title') end
  from private.workout_vote_completions c
  join private.workout_vote_results r on r.workout_date=c.workout_date
  join private.workout_vote_options o on o.workout_date=r.workout_date and o.option_id=r.option_id;
$$;
revoke all on function private.kudos_feed_events() from public,anon,authenticated;

notify pgrst,'reload schema';
