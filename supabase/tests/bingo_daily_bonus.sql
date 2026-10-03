-- Sandbox scoring regression tests. No participant data is changed.
begin;
do $test$
declare c jsonb; s jsonb;
begin
 s:=private.bingo_test_score('{}');
 assert (s->>'total_points')::integer=0;
 c:='{"0":"2026-10-05"}';
 assert (private.bingo_test_score(c)->>'total_points')::integer=2;
 c:=c||'{"1":"2026-10-05","2":"2026-10-05"}';
 assert (private.bingo_test_score(c)->>'total_points')::integer=4;
 c:=c||'{"3":"2026-10-06"}';
 assert (private.bingo_test_score(c)->>'total_points')::integer=6;
 assert (private.bingo_test_score(c-'0')->>'total_points')::integer=5;
 assert (private.bingo_test_score(c-'3')->>'total_points')::integer=4;
 select jsonb_object_agg(i::text,'2026-10-05') into c from generate_series(0,24)i;
 assert (private.bingo_test_score(c)->>'total_points')::integer=46;
 select jsonb_object_agg(i::text,('2026-10-05'::date+(i%7))::text) into c from generate_series(0,24)i;
 s:=private.bingo_test_score(c);
 assert (s->>'total_points')::integer=52;
 assert (s->>'day_bonus_points')::integer=7;
 assert (private.bingo_test_score(c-'0')->>'total_points')::integer=39;
end $test$;
rollback;
