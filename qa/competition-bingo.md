# Competition bingo / BingoBingo

Originally prepared from production main `0bc7976`; the competition frontend and timed activation have since been released.

## Release switch

The preparation migration is applied with `private.bingo_enabled() = false`. Participant boards start empty; no sandbox progress is copied. Existing points, elimination, daily challenges and bonus behavior are retained while disabled. The shared result trigger also fixes a pre-existing step-write failure caused by looking for `result_date` on `step_period_results`.

After explicit release approval: publish this frontend to the soberoktober production project and apply `supabase/activate_competition_bingo.sql`. Do not include activation in automatic migrations. Once enabled, home changes at 2026-10-05 00:01 Europe/Stockholm and returns to daily challenges on 2026-10-12 00:00. The database blocks ordinary daily-result writes and bonus claims for bingo dates; old rows remain intact. Earlier bingo days can be corrected in Min oktober even after the week ends.

Do not disable the switch after participants start without reviewing the impact on points/status first. Keeping it enabled after October 11 preserves bingo history and reporting while the home shows normal daily challenges again.

## Rules and privacy

- Each new square: 1 point, plus 1 extra for the first new square on each Swedish date. A repeat only records attendance.
- Five horizontal and five vertical lines: 3 extra each. Full board: 20 extra. Maximum 82 over seven days (76 if all squares are completed on one day).
- Daily allocations date each line/full-board award to the last required square, so weekly totals add up to the monthly total. Units aggregate from the frozen board, separately from ordinary training volume.
- Elimination uses the same database attendance helper across normal/bingo days. Historical corrections may restore missed-day elimination, never alcohol elimination. Historical elimination events remain acknowledged rather than replaying.
- Own writes only through a scoped authenticated RPC, with profile/board row locks. No caller-supplied user identifier, timestamp or points. The simulated-clock helper cannot be executed by anon/authenticated.
- Public BingoBingo returns names, opaque numeric board selectors, square indexes, score and public current-user/elimination flags. No email, account UUID or completion dates. Other boards are read-only.

## Verification

32 rollback SQL assertions passed, including RLS, public data shape, exact start, future dates, daily bonus, 76/82 maximum, undo, repeat, status restoration and Oct4/5 plus Oct11/12 boundaries. No real participants were mutated by tests; fake users were rolled back. A same-transaction before/after comparison confirmed disabled preparation preserves the live leaderboard exactly.

31 unit tests passed across bingo, challenge/history reports, existing sandbox and step logic. Isolated Playwright fixtures passed at 320/390/768/1440 px: no page overflow, readable full task text, touch targets, centered hero, mobile order, read-only other boards, own complete/uncheck, Min oktober correction, weekly bingo section, return to ordinary pass and disabled flag. No console/page errors. These are controlled tests, not claims of real participant writes on preview.

Run unit tests: `node --test bingo-logic.test.js min-oktober/history-logic.test.js min-oktober/challenge-logic.test.js admin/bingo/bingo-logic.test.js stegtavling/steps-logic.test.js`.

Run browser fixtures: `node competition-bingo-ui.test.cjs` with Playwright available and Chrome path configured via `BINGO_BROWSER_PATH` if needed. This script uses a local server and mocked Supabase; it never writes participant data.

For database verification, execute `supabase/bingo-rollback-tests.sql` inside BEGIN/ROLLBACK on the current database. It temporarily disables and enables the switch only in the rolled-back transaction. Do not execute it outside a rollback transaction. To test migration parity, first capture `before_bingo_qa` in the same transaction before applying preparation DDL, then compare leaderboard JSON immediately after preparation.

Supabase security/performance advisors after preparation: no new findings; existing intentional public-function/password/unused-index findings remain unchanged.

## Bonus update (4 October 2026)

Rows and columns now award 3 points each; a full board awards 20. Existing squares and daily attendance are untouched. Both the live board and admin sandbox use the same private SQL scorer. Daily allocations award bonuses on the final required square's date, so leaderboard/history/report totals remain consistent.

Validation: 35 unit tests; 32 competition, 23 activity and 13 dedicated bonus SQL checks in isolated rollback transactions. Dedicated checks cover row undo, full-board undo (82 to 55), seven-day maximum 82, same-day maximum 76, sandbox parity, last-day bonus allocation, private function grants and total parity across 27 partial/full boards. Browser fixtures cover rules, row bonus and undo, 320/390/768/1440 layouts, public boards, Min oktober and the activity feed. No real participant results are modified by tests.

Applied migration `20261004191404_update_bingo_row_and_full_board_bonus`. Security/performance advisors introduce no new findings (baseline: one intentional RLS info, existing public-function/password warnings and five unused-index infos). Rollback fixture users were confirmed absent after testing.

## Square 13: golf (4 October 2026)

Migration `20261004192301_change_bingo_square13_to_golf` changes square 13 to “spela en runda golf eller slå på rangen”, with report amount 1 and unit `golfaktivitet`. The public board, sandbox default and existing uncustomized sandbox entries all match. Rollback checks confirm the other 24 squares and all participant/sandbox progress remain unchanged. Existing responsive browser checks passed at 320/390/768/1440 px with full task texts. Security/performance advisors remain at the previous baseline.
