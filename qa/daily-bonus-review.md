# Dagens bonus — publication review

Based on production main `1b518a06efe00782dbae6915406ce24fe25463ed`.
The user approved production publication. The database migration was applied as
`20261005093117_allow_daily_bonus_during_bingo` on 5 October 2026.

The home launch panel is replaced by a daily bonus task and toggle. Configuration
reuses `daily_challenges.bonus_description` and `bonus_points` in the individual
admin editor, with one point as the default. No new tables or RLS changes.
Mass input and its deletion dialog/handlers are removed; existing challenge data
and the individual editor, result corrections and participant controls remain.

Bonus claims during bingo add to the total and reports but never count as daily
attendance. Historical bonus corrections remain available in Min oktober.
Current-day new awards require active competition status in PostgreSQL; undo
remains allowed. Amounts are read from admin configuration, never client input.

## Validation

- 41 Node tests pass, including shared claim/undo, stale reads, reports and scoring.
- Browser fixtures pass at 320, 390, 768 and 1440 px without overflow/errors.
- Bonus before bingo, reload persistence, undo, empty bonus state, history edits
  and admin create/update/default point/non-admin denial checked in the browser.
- 18 daily bonus, 31 bingo and 23 activity database checks pass inside rollback.
- Temporary test accounts removed by rollback; no real participant data changed.
- Post-migration verification passes all 18 daily bonus checks. Supabase
  advisors show only the existing baseline findings; no new findings.

## Publication files

- `index.html`, `auth.js`, `bonus-client.js`, `styles/daily-bonus.css`
- `bingo-logic.js`, `min-oktober/index.html`, `min-oktober/history.js`
- `admin/index.html`, `admin/admin.js`
- `bonus-client.test.js`, `bingo-logic.test.js`, `competition-bingo-ui.test.cjs`
- `supabase/daily-bonus-rollback-tests.sql`, this review document
- `supabase/migrations/20261005093117_allow_daily_bonus_during_bingo.sql`

Publish only these reviewed files on main. Do not include unrelated local
helper SQL, image files or missing/extra files from this extracted working copy.
No nuisance repository, project or domain is involved.
