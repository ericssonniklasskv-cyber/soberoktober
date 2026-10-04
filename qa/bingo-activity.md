# Bingo activity feed

Adds square, row/column, and full-board achievements to the existing public activity RPC. The main page still shows at most four activities and refreshes every 30 seconds when visible; successful own bingo writes also refresh it immediately. The full activity page uses the same RPC and renders both normal workouts and bingo events.

A small private `bingo_activity_events` table tracks exact click timestamps. A trigger reconciles it with the existing board using `private.bingo_score`, without changing points or result rows. Invalidated achievements are withdrawn on undo, but private audit rows remain. Recompletion reactivates one event with the new time. Repeated attendance creates no new achievement. Other participants' events and unrelated square timestamps remain unchanged.

The public RPC returns only display name, activity type, optional exercise description, relevant dates/time, and the existing workout multiplier. No email, user identifier, internal event identifier, or raw board is returned. Raw private events and mutation helpers are unavailable to clients, and RLS is enabled. Public access is a narrow invoker wrapper over a private read-only function.

Verified with 23 rollback database assertions and 35 unit tests. Isolated browser fixtures at 320/390/768/1440 px verify four main-feed entries, long task text, immediate addition/withdrawal, full activity navigation, existing workout rendering, and no overflow or console errors. Migration parity check preserves the pre-existing workout feed exactly. Fake users and events are always rolled back; no participant test data is published.

Run `node --test aktivitet/activity-logic.test.js` and `node competition-bingo-ui.test.cjs`. Run `supabase/bingo-activity-rollback-tests.sql` only inside a BEGIN/ROLLBACK transaction against the migrated database.
