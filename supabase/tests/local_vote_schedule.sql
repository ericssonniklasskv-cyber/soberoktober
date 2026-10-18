-- Local-only opening/deadline tests; all records and clock changes roll back.
begin;
-- Isolate schedule assertions from existing winners, then restore everything on rollback.
delete from private.vote_preview_completions where workout_date between date '2026-10-19' and date '2026-10-25';
delete from private.vote_preview_votes where workout_date between date '2026-10-19' and date '2026-10-25';
delete from private.vote_preview_results where workout_date between date '2026-10-19' and date '2026-10-25';
do $$
declare actor uuid:=gen_random_uuid(); day date; expected timestamptz;
begin
 for day in select distinct workout_date from private.vote_preview_options loop
  expected:=case when day=date '2026-10-19' then timestamptz '2026-10-18 21:00+02' else ((day-1)::timestamp+interval '15 hours') at time zone 'Europe/Stockholm' end;
  if private.vote_preview_opens(day)<>expected then raise exception 'Wrong opening time for %',day;end if;
 end loop;
 insert into auth.users(id,email)values(actor,actor::text||'@example.invalid');
 insert into public.profiles(id,email,display_name)values(actor,actor::text||'@example.invalid','Schedule SQL fixture');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 update private.vote_preview_settings set test_now='2026-10-18 20:59:59+02' where singleton;
 begin perform public.local_workout_vote('vote','2026-10-19',0);raise exception 'Vote accepted before Sunday 21';exception when insufficient_privilege then null;end;
 update private.vote_preview_settings set test_now='2026-10-18 21:00+02' where singleton;
 perform public.local_workout_vote('vote','2026-10-19',0);
 update private.vote_preview_settings set test_now='2026-10-19 00:00+02' where singleton;
 begin perform public.local_workout_vote('vote','2026-10-19',1);raise exception 'Vote accepted after midnight';exception when insufficient_privilege then null;end;
 perform public.local_workout_vote('complete','2026-10-19');
 update private.vote_preview_settings set test_now='2026-10-19 14:59:59+02' where singleton;
 begin perform public.local_workout_vote('vote','2026-10-20',0);raise exception 'Vote accepted before weekday 15';exception when insufficient_privilege then null;end;
 update private.vote_preview_settings set test_now='2026-10-19 15:00+02' where singleton;
 perform public.local_workout_vote('vote','2026-10-20',0);
 update private.vote_preview_settings set test_now='2026-10-20 00:00+02' where singleton;
 begin perform public.local_workout_vote('vote','2026-10-20',1);raise exception 'Weekday vote accepted at midnight';exception when insufficient_privilege then null;end;
end $$;
rollback;
