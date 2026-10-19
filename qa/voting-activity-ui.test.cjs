const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { browserOptions } = require('./browser.cjs');
const { serveFrontend } = require('./frontend-server.cjs');

(async () => {
  const server = await serveFrontend();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...browserOptions() });
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*.js*', route => /\/aktivitet\/activity(?:-(?:logic|shared|preview))?\.js$/.test(new URL(route.request().url()).pathname)
      ? route.continue() : route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/api/config', route => route.fulfill({ json: { supabaseUrl: 'http://127.0.0.1:54321', supabasePublishableKey: 'fixture' } }));
    await page.addInitScript(() => {
      window.rows = []; window.feedCalls = 0;
      window.fixtureClient = {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'fixture' } } } }), onAuthStateChange: () => ({}) },
        rpc: async (name, { p_limit, p_offset }) => {
          if (name !== 'get_kudos_activity_feed') throw Error('Unexpected RPC');
          window.feedCalls++; return { data: window.rows.slice(p_offset, p_offset + p_limit), error: null };
        },
      };
      window.supabase = { createClient: () => window.fixtureClient };
    });
    const row = (i, type = 'vote_pass') => ({ display_name: i ? 'Deltagare ' + i : '<img src=x onerror=alert(1)>',
      activity_type: type, activity_label: '30 minuter löpning', multiplier: null,
      event_at: '2026-10-19T10:00:00Z', result_date: '2026-10-19', activity_key: 'vote:' + i, is_own: false, kudos_sent: false });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      await page.evaluate(() => {
        document.querySelector('#entry-gate').hidden = true;
        document.body.classList.remove('entry-active');
        document.querySelector('#app-shell').inert = false;
        window.SoberActivity.useClient(window.fixtureClient);
      });
      await page.waitForFunction(() => document.querySelector('.activity-empty').textContent.includes('Inga aktiviteter'));
      await page.evaluate(rows => { window.rows = rows; window.dispatchEvent(new CustomEvent('vote-result-changed')); }, Array.from({ length: 6 }, (_, i) => row(i)));
      await page.waitForFunction(() => document.querySelectorAll('#activity-preview-list .activity-item').length === 4);
      assert.match(await page.locator('#activity-preview-list').textContent(), /klarade av 30 minuter löpning/);
      assert(!/framröstade pass|3 poäng/.test(await page.locator('#activity-preview-list').textContent()));
      assert.equal(await page.locator('#activity-preview-list img').count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(rows => { window.rows = rows; window.dispatchEvent(new CustomEvent('vote-result-changed')); }, [row(1, 'vote_steps')]);
      await page.waitForFunction(() => document.querySelector('#activity-preview-list').textContent.includes('Deltagare 1 gick 10 000 steg'));
      assert.equal(await page.locator('#activity-preview-list .activity-item').count(), 1);
      await page.evaluate(() => { window.rows = []; window.dispatchEvent(new CustomEvent('vote-result-changed')); });
      await page.waitForFunction(() => document.querySelector('.activity-empty').textContent.includes('Inga aktiviteter'));
    }
    await page.goto(server.origin + '/aktivitet/');
    await page.waitForFunction(() => window.SoberActivity);
    await page.evaluate(rows => { window.rows = rows; document.dispatchEvent(new CustomEvent('soberoktober:activity-auth')); }, [row(1), row(2, 'vote_steps')]);
    await page.waitForFunction(() => document.querySelectorAll('#activity-list .activity-item').length === 2);
    assert.match(await page.locator('#activity-list').textContent(), /klarade av 30 minuter löpning/);
    assert.match(await page.locator('#activity-list').textContent(), /10 000 steg/);
    assert.deepEqual(errors, []);
    console.log('PASS: voting workout/steps feed, instant refresh, undo, max four, safe labels, full feed, 320/390/768/1440.');
  } finally { await browser?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
