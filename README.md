# Sober Oktober

Static HTML/CSS/JavaScript frontend with Supabase RPCs and RLS. No frontend build step is required. Production uses the `main` branch; pushing `main` can publish through the existing Vercel Git integration. Keep review changes local until their preview is approved.

## Tests

Use Node.js 24 (22 or later supported):

```sh
npm ci
npx playwright install chromium
npm test              # Pure calculation tests
npm run test:ui       # Browser regression tests
npm run test:all      # Both suites
```

Browser tests serve the actual frontend locally with mocked auth/database responses. They never write to production or require Supabase credentials. GitHub Actions runs both suites with Chromium and read-only repository permissions; it does not deploy.

To use an existing browser, set `SOBER_BROWSER_PATH` to its executable path. Otherwise Playwright uses its installed Chromium. Generated screenshots are diagnostic artifacts, not runtime assets.

`npm run test:local-db` is an **opt-in** integration test that writes fixture data. It requires `SOBER_LOCAL_ENV_MODULE` pointing to the local environment adapter, which must target the local test database. Do not supply a production adapter.

## Shared logic

- `shared/calendar.js`: Stockholm calendar dates, October 2026 and period boundaries.
- `min-oktober/history-logic.js`: history, streaks and report calculations.
- `stegtavling/steps-logic.js`: weighted steps and the single step-points ladder.
- `shared/popup-coordinator.js`: automatic popup queue, app gates and focus handling.
- `home/participants.js`: public participant and training leaderboard rendering.
- `min-oktober/reports-ui.js`: weekly/final report presentation and existing read markers.

Controllers still own their existing data calls. PostgreSQL remains authoritative for competition status, permissions and saved scores. Shared browser calendar logic does not replace server-side validation.
