-- Local only; clock changes, scores and fixtures are rolled back.
begin;
do $$
declare one uuid:=gen_random_uuid();two uuid:=gen_random_uuid();s jsonb;
begin
 insert into auth.users(id,email)values(one,one::text||'@example.invalid'),(two,two::text||'@example.invalid');
 insert into public.profiles(id,email,display_name)values(one,one::text||'@example.invalid','Steps SQL one'),(two,two::text||'@example.invalid','Steps SQL two');
 perform set_config('request.jwt.claim.sub',one::text,true);
 update private.vote_preview_settings set test_now='2026-10-18 21:00+02' where singleton;
 begin perform public.local_workout_vote('steps','2026-10-19');raise exception 'Expected early steps rejection';exception when insufficient_privilege then null;end;
 update private.vote_preview_settings set test_now='2026-10-19 00:00+02' where singleton;
 perform public.local_workout_vote('steps','2026-10-19');perform public.local_workout_vote('steps','2026-10-19');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=1 and completed_days=1)then raise exception 'Steps must give exactly one point/day';end if;
 s:=public.local_workout_vote('get');if s#>>'{days,0,completion,kind}'<>'steps' or s#>>'{days,0,completion,points}'<>'1' then raise exception 'Invalid steps state';end if;
 begin perform public.local_workout_vote('complete','2026-10-19');raise exception 'Expected workout/steps conflict';exception when insufficient_privilege then null;end;
 perform public.local_workout_vote('uncomplete','2026-10-19');
 if not exists(select 1 from private.vote_preview_completions where user_id=one and kind='steps' and points=1)then raise exception 'Stale workout undo erased steps';end if;
 begin update private.vote_preview_completions set points=3 where user_id=one;raise exception 'Constraint permitted wrong points';exception when check_violation then null;end;
 perform set_config('request.jwt.claim.sub',two::text,true);s:=public.local_workout_vote('get');if s#>'{days,0,completion}'<>'null'::jsonb then raise exception 'Steps leaked across accounts';end if;
 perform set_config('request.jwt.claim.sub',one::text,true);
 perform public.local_workout_vote('unsteps','2026-10-19');perform public.local_workout_vote('unsteps','2026-10-19');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=0 and completed_days=0)then raise exception 'Undo steps did not remove point/day';end if;
 perform public.local_workout_vote('complete','2026-10-19');
 begin perform public.local_workout_vote('steps','2026-10-19');raise exception 'Expected steps/workout conflict';exception when insufficient_privilege then null;end;
 perform public.local_workout_vote('unsteps','2026-10-19');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=3 and completed_days=1)then raise exception 'Stale steps undo erased workout';end if;
 perform public.local_workout_vote('uncomplete','2026-10-19');perform public.local_workout_vote('steps','2026-10-19');
 update private.vote_preview_settings set test_now='2026-10-20 00:00+02' where singleton;
 begin perform public.local_workout_vote('steps','2026-10-19');raise exception 'Expected old day rejection';exception when insufficient_privilege then null;end;
 perform public.local_workout_vote('steps','2026-10-20');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=2 and completed_days=2)then raise exception 'Per-day step score incorrect';end if;
 perform private.apply_elimination(one,'alcohol');
 begin perform public.local_workout_vote('steps','2026-10-20');raise exception 'Inactive participant accepted';exception when insufficient_privilege then null;end;
 perform public.local_workout_vote('unsteps','2026-10-20');
 if not exists(select 1 from public.get_leaderboard()where is_current_user and total_points=1 and completed_days=1)then raise exception 'Inactive participant could not undo';end if;
end $$;
rollback;
