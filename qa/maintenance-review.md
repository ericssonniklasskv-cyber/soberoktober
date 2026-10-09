# Maintenance review — 2026-10-09

Baseline: production/main `e5eef879de421724616baec460f48f3e06371242`.

## Changes

- Fixed final report ranking reads to begin on October 31, matching its existing unlock conditions. Training and step placements remain separate.
- Shared Stockholm date handling and immutable October period definitions across history, steps, countdown, admin, bingo, tomorrow preview and quote rotation.
- Extracted participant/leaderboard rendering from the home auth controller and report presentation from the history controller. RPC contracts and calculations remain unchanged.
- One automatic popup coordinator replaces separate observers and timer gates. Pending elimination, quote, report and kudos notices are shown sequentially; auth/onboarding and manually opened dialogs block automatic notices. Existing read markers and server read state remain in their feature modules.
- Added stale-response protection to elimination notifications after logout/account switching.
- Removed retired bulk-entry CSS; retained the `bulk-copy` style still used by corrections.
- Added npm test commands, pinned Playwright dependency/lockfile and a read-only GitHub Actions test workflow. No deploy action or credentials are required by CI.
- CI caught a pre-existing 320px admin heading overflow with its Linux fallback font. The heading now scales down on screens at or below 360px; the regression includes text/control overflow diagnostics.

## Validation

`npm run test:all` passed: **44 calculation tests and nine browser suites**.

Browser checks use the actual frontend with mocked auth/database responses and cover admin edits/corrections, bingo/feed, self-corrections, final reports, unread kudos, popup order/account races, weekly reports and step saving. Responsive checks cover 320, 390, 768 and 1440px. No page errors were reported by these suites.

New regressions cover Stockholm midnight and DST, the 7/7/7/10 shared period configuration, October 31 prerequisites and separate rankings, own-data query filters, popup focus/gates, daily quote rotation and stale account responses. Before/after computed admin styles were identical at all four widths after removing retired CSS.

Tests do not perform real Google OAuth or writes to production Supabase. The optional local-database E2E test was not run because it writes fixtures to the shared local environment. No schema, migration, RLS, auth-provider or competition-rule changes were made.

## Release state

The isolated Vercel preview was approved for production on October 9. The maintenance release is published through GitHub `main`. Live checks cover both domains, runtime asset parity, signed-out entry/rules at all four widths and the key feature routes; no JavaScript page errors or Vercel runtime errors were found. No participant data was modified by these checks. The original local maintenance commit is retained on `checkpoint-maintenance-1d5fff3`.

Further controller splitting can be done incrementally with future features; this pass keeps the current static frontend architecture.
