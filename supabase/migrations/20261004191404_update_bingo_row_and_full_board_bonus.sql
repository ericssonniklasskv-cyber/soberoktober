-- Recalculate bonuses from existing checked squares; no participant data is changed.
create or replace function private.bingo_score(p_cells jsonb)
returns jsonb language sql immutable set search_path = '' as $$
with cells as (
  select key::integer as cell, value as completed_date
  from pg_catalog.jsonb_each_text(p_cells)
  where key ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
), completed_rows as (
  select cell / 5 as line from cells group by cell / 5 having count(*) = 5
), completed_columns as (
  select cell % 5 as line from cells group by cell % 5 having count(*) = 5
), totals as (
  select (select count(*)::integer from cells) as cell_points,
    (select count(distinct completed_date)::integer from cells
      where completed_date ~ '^2026-10-(0[5-9]|1[01])$') as day_bonus_points,
    3 * ((select count(*)::integer from completed_rows) +
      (select count(*)::integer from completed_columns)) as line_points
)
select jsonb_build_object(
  'cell_points', cell_points, 'day_bonus_points', day_bonus_points,
  'line_points', line_points,
  'full_board_points', case when cell_points = 25 then 20 else 0 end,
  'total_points', cell_points + day_bonus_points + line_points +
    case when cell_points = 25 then 20 else 0 end,
  'rows', coalesce((select jsonb_agg(line order by line) from completed_rows), '[]'::jsonb),
  'columns', coalesce((select jsonb_agg(line order by line) from completed_columns), '[]'::jsonb)
) from totals;
$$;

-- Award each row/column bonus on its last square's date, and full-board bonus
-- on the last square of the board, so daily, weekly and monthly totals agree.
create or replace function private.bingo_daily_scores(cells jsonb)
returns table(result_date date, points numeric)
language sql immutable set search_path = '' as $$
with squares as (
  select key::integer as cell, value::date as day from jsonb_each_text(cells)
), lines as (
  select max(day) as day from squares group by cell / 5 having count(*) = 5
  union all
  select max(day) from squares group by cell % 5 having count(*) = 5
), awards as (
  select day, count(*)::numeric + 1 as points from squares group by day
  union all select day, 3::numeric from lines
  union all select max(day), 20::numeric from squares having count(*) = 25
)
select day, sum(points) from awards group by day;
$$;
