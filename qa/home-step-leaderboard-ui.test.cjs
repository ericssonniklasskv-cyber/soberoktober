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
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*.js*', route => new URL(route.request().url()).pathname === '/home/step-leaderboard.js'
      ? route.continue() : route.fulfill({ contentType: 'text/javascript', body: '' }));
    const rows = [
      { rank_position: 1, display_name: '<img src=x onerror=alert(1)>', average_steps: 12430, reported_periods: 1 },
      { rank_position: 2, display_name: 'Anna', average_steps: 11420, reported_periods: 2 },
      { rank_position: 2, display_name: 'Delad placering', average_steps: 11420, reported_periods: 2 },
      ...[4, 5, 6, 7, 8].map(rank => ({ rank_position: rank, display_name: 'Deltagare ' + rank, average_steps: 10000 - rank, reported_periods: 1 })),
    ];
    for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(server.origin);
      assert.equal(await page.locator('#home-step-preview').evaluate(el => el.closest('#app-shell').inert), true, 'panel stays behind the locked entry');
      assert.equal(await page.locator('#tomorrow-preview').count(), 0);
      await page.evaluate(data => {
        document.querySelector('#entry-gate').hidden = true;
        document.body.classList.remove('entry-active');
        document.querySelector('#app-shell').inert = false;
        window.stepCalls = [];
        window.SoberOctoberStepPreview.init({
          rpc: async name => { window.stepCalls.push(name); return { data, error: null }; },
          from: () => { throw Error('Private table access is forbidden'); },
        });
      }, rows);
      await page.waitForFunction(() => document.querySelectorAll('.home-step-row').length === 8);
      assert.deepEqual(await page.evaluate(() => window.stepCalls), ['get_step_leaderboard']);
      assert.equal(await page.locator('.home-step-name img').count(), 0, 'names use textContent');
      assert.deepEqual(await page.locator('.home-step-rank').allTextContents(), ['1', '2', '2', '4', '5', '6', '7', '8']);
      assert.match(await page.locator('.home-step-meta').first().textContent(), /12\s430 steg\/dag · 1\/4 perioder/);
      const bounds = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { panel: rect('#home-step-preview'), hero: rect('.hero'), activity: rect('.activity-preview'), workout: rect('#dagens-pass'), scroll: document.documentElement.scrollWidth, width: innerWidth };
      });
      assert(bounds.scroll <= width, 'no horizontal overflow at ' + width);
      assert(Math.abs(bounds.hero.x + bounds.hero.width / 2 - width / 2) < 3, 'hero stays centered');
      if (width <= 860) {
        assert(bounds.panel.top >= bounds.workout.bottom, 'mobile panel follows workout');
        assert(bounds.activity.top >= bounds.panel.bottom, 'activity follows panel');
      } else {
        assert(bounds.panel.right <= bounds.hero.left, 'desktop panel stays left of hero');
        assert(bounds.panel.bottom <= bounds.activity.top, 'step panel does not overlap activity');
      }
      if ([320, 1440].includes(width)) await page.screenshot({ path: artifactPath(`home-step-filled-${width}.png`), fullPage: true });
      assert(await page.locator('.home-step-list').evaluate(el => el.scrollHeight > el.clientHeight), 'long list scrolls');
      await page.locator('.home-step-link').click();
      assert.match(page.url(), /\/stegtavling\/#step-leaderboard-title$/);
      await page.goBack();
      await page.evaluate(() => {
        document.querySelector('#entry-gate').hidden = true;
        document.body.classList.remove('entry-active');
        document.querySelector('#app-shell').inert = false;
        document.querySelector('#dagens-pass').hidden = true;
        document.querySelector('#competition-bingo').hidden = false;
        window.SoberOctoberStepPreview.init({ rpc: async () => ({ data: [], error: null }) });
      });
      await page.waitForFunction(() => document.querySelector('.home-step-empty').textContent.includes('första perioden'));
      if (width <= 860) assert(await page.evaluate(() => document.querySelector('#home-step-preview').getBoundingClientRect().top >= document.querySelector('#competition-bingo').getBoundingClientRect().bottom), 'mobile panel follows bingo too');
      await page.screenshot({ path: artifactPath(`home-step-leaderboard-${width}.png`), fullPage: true });
    }
    // Handle network errors without leaking error payloads; refresh on return to the tab.
    await page.evaluate(() => {
      window.SoberOctoberStepPreview.init({ rpc: async () => { throw Error('sensitive backend details'); } });
    });
    await page.waitForFunction(() => document.querySelector('.home-step-empty').textContent.includes('kunde inte laddas'));
    assert(!(await page.locator('#home-step-preview').textContent()).includes('sensitive'));
    await page.evaluate(data => {
      let first = true;
      window.SoberOctoberStepPreview.init({ rpc: async () => first
        ? (first = false, { data: null, error: { message: 'temporarily unavailable' } })
        : { data, error: null } });
    }, rows);
    await page.waitForFunction(() => document.querySelector('.home-step-empty').textContent.includes('kunde inte laddas'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => document.querySelectorAll('.home-step-row').length === 8);
    assert.deepEqual(errors, []);
    console.log('Home step leaderboard: public aggregate RPC, original ranks, safe names, empty/error/retry, entry gate, full link, centered hero and workout/bingo placement at 320/390/768/1024/1280/1440/1920px passed.');
  } finally { await browser?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
