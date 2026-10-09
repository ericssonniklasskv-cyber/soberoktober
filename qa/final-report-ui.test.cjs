const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { browserOptions, artifactPath } = require('./browser.cjs');
const { serveFrontend } = require('./frontend-server.cjs');

(async () => {
  const server = await serveFrontend();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...browserOptions() });
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [], calls = [], queries = [];
    let hasFinalPass = false, hasFinalSteps = false;
    const own = 'private-fixture-user';
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('fixtureQuery', (table, args, single) => {
      queries.push({ table, args });
      let data = [];
      if (table === 'profiles') data = { display_name: 'Testaren' };
      if (table === 'daily_results') data = hasFinalPass ? [{ result_date: '2026-10-31', multiplier: 2, points: 1.5 }] : [];
      if (table === 'daily_challenges') data = [{ challenge_date: '2026-10-31', title: 'Squats', description: '15 squats', base_amount: 15, unit: 'squats', completion_mode: 'single' }];
      if (table === 'step_period_results') data = hasFinalSteps ? [{ period_key: 'oct_22_31', avg_steps: 10000 }] : [];
      return { data: single && Array.isArray(data) ? data[0] || null : data, error: null };
    });
    await page.exposeFunction('fixtureRPC', name => {
      calls.push(name);
      const data = name === 'sync_competition_status' ? { status: 'active' }
        : name === 'my_competition_bingo' ? { enabled: false, completed_cells: {}, daily_scores: [], activity_dates: [] }
        : name === 'get_leaderboard' ? [{ display_name: 'Testaren', is_current_user: true, rank_position: 7 }]
        : name === 'get_step_leaderboard' ? [{ display_name: 'Testaren', average_steps: 10000, reported_periods: 1, rank_position: 3 }]
        : [];
      return { data, error: null };
    });
    await page.route('**/api/config', route => route.fulfill({ json: { supabaseUrl: 'https://fixture.invalid', supabasePublishableKey: 'fixture-only' } }));
    await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/javascript', body: `
      window.supabase = { createClient: () => ({
        auth: { getSession: async () => ({ data: { session: { user: { id: '${own}' } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }) },
        from(table) { const args = []; let single = false; const q = new Proxy({}, { get: (_, name) => name === 'then' ? ((resolve, reject) => window.fixtureQuery(table, args, single).then(resolve, reject)) : ((...values) => { args.push([name, ...values]); if (name === 'maybeSingle') single = true; return q; }) }); return q; },
        rpc: name => window.fixtureRPC(name)
      }) };` }));
    await page.clock.install({ time: new Date('2026-10-30T12:00:00+01:00') });
    const load = async () => {
      await page.goto(server.origin + '/min-oktober/');
      await page.waitForFunction(() => document.querySelectorAll('#history-calendar .calendar-day').length === 31);
    };
    await load();
    assert.equal(await page.locator('#final-report-action').isVisible(), false);
    assert.equal(calls.includes('get_leaderboard'), false, 'no placement reads before October 31');
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00+01:00'));
    await load();
    assert.equal(await page.locator('#final-report-action').isVisible(), false, 'requires final pass and step period');
    hasFinalPass = true; await load();
    assert.equal(await page.locator('#final-report-action').isVisible(), false, 'final step period still required');
    hasFinalSteps = true;
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await load();
      await page.locator('#final-report-action').click();
      await page.locator('#final-report-detail').waitFor({ state: 'visible' });
      assert.match(await page.locator('#final-report-stats').innerText(), /Träningsplacering\s+7:e plats/i);
      assert.match(await page.locator('#final-report-step-stats').innerText(), /Stegplacering\s+3:e plats/i);
      assert.match(await page.locator('#final-report-exercises').innerText(), /30 squats/);
      assert.match(await page.locator('#final-report-step-stats').innerText(), /20\/30/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow ${width}px`);
      await page.screenshot({ path: artifactPath(`sober-final-report-${width}.png`) });
      await page.locator('#final-report-close').click();
    }
    assert.ok(calls.includes('get_leaderboard') && calls.includes('get_step_leaderboard'), 'both ranking RPCs used on October 31');
    for (const query of queries.filter(q => ['daily_results', 'step_period_results', 'daily_bonus_claims'].includes(q.table))) {
      assert.ok(query.args.some(a => a[0] === 'eq' && a[1] === 'user_id' && a[2] === own), 'private reads scoped to current user');
    }
    await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+01:00'));
    await load(); assert.equal(await page.locator('#final-report-action').isVisible(), true, 'historical report persists');
    assert.deepEqual(errors, []);
    console.log('Final report: October 31 prerequisites, separate live rankings, own data, exercise totals, historical access and 320/390/768/1440px passed.');
  } finally { await browser?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
