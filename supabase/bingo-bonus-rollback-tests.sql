-- Run inside BEGIN/ROLLBACK after the bonus migration.
create temporary table bonus_checks(label text);
create function pg_temp.check_bonus(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %', label; end if;
  insert into bonus_checks values(label);
end;
$$;
select pg_temp.check_bonus((private.bingo_score('{}')->>'total_points')::integer = 0, 'Empty board stays zero');
select pg_temp.check_bonus((private.bingo_score('{"0":"2026-10-05"}')->>'total_points')::integer = 2, 'First square still earns two');
select pg_temp.check_bonus((private.bingo_score('{"0":"2026-10-05","1":"2026-10-05"}')->>'total_points')::integer = 3, 'Additional square still earns one');
create temporary table bonus_row as
  select jsonb_object_agg(i::text, '2026-10-05') cells from generate_series(0,4) i;
select pg_temp.check_bonus((select (private.bingo_score(cells)->>'total_points')::integer = 9 from bonus_row), 'Five squares plus daily bonus plus three for row');
select pg_temp.check_bonus((select (private.bingo_score(cells - '4')->>'total_points')::integer = 5 from bonus_row), 'Undo removes three-point row bonus');
select pg_temp.check_bonus((select sum(points) = 9 from bonus_row cross join lateral private.bingo_daily_scores(cells)), 'Daily report includes row bonus');
create temporary table bonus_full as
  select jsonb_object_agg(i::text, ('2026-10-05'::date + i % 7)::text) cells
  from generate_series(0,24) i;
select pg_temp.check_bonus((select (private.bingo_score(cells)->>'line_points')::integer = 30 and
  jsonb_array_length(private.bingo_score(cells)->'rows') = 5 and
  jsonb_array_length(private.bingo_score(cells)->'columns') = 5 from bonus_full), 'Ten lines yield thirty without changing line counts');
select pg_temp.check_bonus((select (private.bingo_score(cells)->>'full_board_points')::integer = 20 and
  (private.bingo_score(cells)->>'total_points')::integer = 82 from bonus_full), 'Full board across seven days yields eighty-two');
select pg_temp.check_bonus((select (private.bingo_score(cells - '0')->>'full_board_points')::integer = 0 and
  (private.bingo_score(cells - '0')->>'total_points')::integer = 55 from bonus_full), 'Undo full board removes square, two lines and full-board bonus');
select pg_temp.check_bonus((select points = 42 from bonus_full cross join lateral private.bingo_daily_scores(cells)
  where result_date = '2026-10-11'), 'Last day receives full-board bonus and last completed lines');
select pg_temp.check_bonus((select private.bingo_test_score(cells) = private.bingo_score(cells) from bonus_full), 'Admin sandbox uses exactly the competition calculation');
select pg_temp.check_bonus((
  select bool_and(coalesce((select sum(points) from private.bingo_daily_scores(cells)), 0) =
    (private.bingo_score(cells)->>'total_points')::numeric)
  from (
    select coalesce((select jsonb_object_agg(i::text, ('2026-10-05'::date + (i + n) % 7)::text)
      from generate_series(0,24) i where (i * 11 + n * 3) % 26 < n), '{}'::jsonb) cells
    from generate_series(0,26) n
  ) samples
), 'Daily allocations equal board scores across twenty-seven partial and full boards');
select pg_temp.check_bonus(not has_function_privilege('anon', 'private.bingo_score(jsonb)', 'execute') and
  not has_function_privilege('authenticated', 'private.bingo_daily_scores(jsonb)', 'execute'), 'Private scoring helpers remain non-client-executable');
select count(*) as bonus_checks_passed from bonus_checks;
