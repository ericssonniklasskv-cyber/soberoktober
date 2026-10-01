# Admin bingo sandbox

Admin-only test UI (available on production): /admin/bingo/. Based on current main; no homepage or competition changes.

- The 25 October 5–11 activities are initialized by migration 20261001122644.
- Requires the existing profiles.is_admin flag. Anonymous and regular users cannot call the sandbox RPC.
- Each admin has their own sandbox row. All writes go through the guarded RPC; direct client writes are denied.
- Canonical score comes from private.bingo_test_score: 25 cells + 10 horizontal/vertical lines + 10 full-board bonus = 45.
- Click a completed cell to uncheck it; scoring, bonuses, activity dates and report totals are recalculated.
- Activity dates follow the remaining marked cells. Repeated completions do not add new activity days.
- Simulation starts October 5; dates only move forward to October 12. Reset clears test results/status and retains the saved board.
- Two missed closed calendar days eliminate the simulated participant. Today's and future dates never count.
- Alcohol simulation and restoration affect the sandbox row only.
- The report is a separate draft; it is not wired into real weekly/monthly reports.
- Report exercise amounts count each remaining completed square once.
- There is no automatic switch to live bingo on October 5.
- This migration adds only sandbox objects to the existing soberoktober DB. It was applied to support preview; it does not create a paid Supabase branch.

## Verification

Logic: node --test admin/bingo/bingo-logic.test.js

UI smoke: with Playwright installed, node admin/bingo/bingo-ui.test.js.
Uses an isolated local server and mocked auth/API; never writes to Supabase.
Optionally set BINGO_BROWSER_PATH to an installed Chromium/Chrome executable.
Checks 320/390/768/1440px, overflow, touch sizes, check/uncheck/recheck, editor, date, reset and access gates.

Database: run supabase/tests/admin_bingo_sandbox.sql as postgres only in soberoktober.
All sandbox writes roll back; fingerprints assert that competition tables are unchanged.
Requires one existing admin and one regular participant. Do not remove BEGIN/ROLLBACK.

## Browser login in preview

The exact preview root must be allowed in Supabase Auth Redirect URLs.
Login via the preview homepage with the existing Google flow, then open /admin/bingo/.
No OAuth scopes, auth flow or production redirect URL changes are required.

## Launch later

After review, a separate implementation will connect bingo scoring and daily activity to the real
competition for October 5–11. Never treat sandbox points or simulation dates as real results.
