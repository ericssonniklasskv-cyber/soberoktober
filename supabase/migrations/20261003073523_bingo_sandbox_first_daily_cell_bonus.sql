create or replace function private.bingo_test_score(p_cells jsonb)
returns jsonb language sql immutable set search_path = '' as $function$
with cells as (
 select key::integer as cell, value as completed_date
 from pg_catalog.jsonb_each_text(p_cells)
 where key ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
), completed_rows as (
 select cell / 5 as line from cells group by cell / 5 having count(*)=5
), completed_columns as (
 select cell % 5 as line from cells group by cell % 5 having count(*)=5
), totals as (
 select (select count(*)::integer from cells) as cell_points,
 (select count(distinct completed_date)::integer from cells
  where completed_date ~ '^2026-10-(0[5-9]|1[01])$') as day_bonus_points,
 (select count(*)::integer from completed_rows)+(select count(*)::integer from completed_columns) as line_points
)
select jsonb_build_object(
 'cell_points',cell_points,'day_bonus_points',day_bonus_points,'line_points',line_points,
 'full_board_points',case when cell_points=25 then 10 else 0 end,
 'total_points',cell_points+day_bonus_points+line_points+case when cell_points=25 then 10 else 0 end,
 'rows',coalesce((select jsonb_agg(line order by line) from completed_rows),'[]'::jsonb),
 'columns',coalesce((select jsonb_agg(line order by line) from completed_columns),'[]'::jsonb)
) from totals;
$function$;
comment on function private.bingo_test_score(jsonb) is 'Admin sandbox only: one point per square, one extra per distinct completed Swedish calendar date (October 5-11), row/column and full-board bonuses.';