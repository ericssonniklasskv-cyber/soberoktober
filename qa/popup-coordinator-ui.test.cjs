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
    await page.route('**/*.js*', route => {
      const file = new URL(route.request().url()).pathname;
      if (['/shared/calendar.js', '/shared/popup-coordinator.js', '/min-oktober/history-logic.js', '/min-oktober/report-seen.js', '/weekly-report-popup.js', '/trump-quote.js', '/elimination.js'].includes(file)) return route.continue();
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    await page.clock.install({ time: new Date('2026-10-08T12:00:00+02:00') });
    await page.goto(server.origin);
    await page.evaluate(async () => {
      window.fixtureClient = { rpc: async name => ({ data: name === 'sync_competition_status'
        ? { status: 'eliminated', current_elimination_event_id: 'first-event', elimination_reason: 'Alkohol' } : [], error: null }) };
      await window.SoberOctoberEliminations.refresh(window.fixtureClient, 'anna', 'Anna');
      window.SoberOctoberWeeklyPopup.update('anna', window.SoberOctoberHistory.REPORT_PERIODS[0]);
    });
    assert.equal(await page.locator('#elimination-overlay').isVisible(), false, 'entry gates all automatic notices');
    await page.evaluate(() => {
      document.querySelector('#entry-gate').hidden = true;
      document.querySelector('#app-shell').inert = false;
      document.body.classList.remove('entry-active');
      document.querySelector('#auth-trigger').textContent = 'Hej, Anna';
      document.querySelector('#auth-trigger').disabled = false;
      document.querySelector('#auth-trigger').focus();
    });
    await page.locator('#elimination-overlay').waitFor({ state: 'visible' });
    assert.match(await page.locator('#elimination-title').innerText(), /Anna has been eliminated/);
    assert.equal(await page.locator('#trump-quote-overlay').isVisible(), false, 'elimination takes priority');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#elimination-close').evaluate(el => el === document.activeElement), true, 'overlay traps focus');
    await page.getByRole('button', { name: 'Acceptera mitt öde' }).click();
    await page.locator('#trump-quote-overlay').waitFor({ state: 'visible' });
    const quote = await page.locator('#trump-quote-modal-text').innerText();
    assert.equal(await page.locator('#weekly-release-dialog').isVisible(), false, 'quote and report never overlap');
    await page.getByRole('button', { name: 'Fortsätt', exact: true }).click();
    await page.locator('#weekly-release-dialog').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Inte just nu' }).click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#auth-trigger'));
    assert.equal(await page.evaluate(() => localStorage.getItem('soberoktober-trump-quote-seen-date')), '2026-10-08');
    // Same-day refresh preserves the quote marker, and another day rotates it.
    await page.reload();
    await page.evaluate(() => {
      document.querySelector('#entry-gate').hidden = true;
      document.querySelector('#app-shell').inert = false;
      document.body.classList.remove('entry-active');
      document.querySelector('#auth-trigger').textContent = 'Hej, Anna';
    });
    assert.equal(await page.locator('#trump-quote-overlay').isVisible(), false, 'same-day reload does not repeat quote');
    await page.clock.setFixedTime(new Date('2026-10-09T12:00:00+02:00'));
    await page.evaluate(() => window.SoberOctoberPopups.request());
    await page.locator('#trump-quote-overlay').waitFor({ state: 'visible' });
    assert.notEqual(await page.locator('#trump-quote-modal-text').innerText(), quote, 'new day rotates quote');
    await page.keyboard.press('Escape');
    // Native user-opened dialogs block automatic notices; a pending auth screen does too.
    await page.evaluate(() => {
      window.manualDialog = document.createElement('dialog');
      window.manualDialog.innerHTML = '<button>Manual</button>';
      document.body.append(window.manualDialog); window.manualDialog.showModal();
      window.SoberOctoberWeeklyPopup.update('erik', window.SoberOctoberHistory.REPORT_PERIODS[0]);
    });
    assert.equal(await page.locator('#weekly-release-dialog').isVisible(), false);
    await page.evaluate(() => { document.querySelector('#auth-overlay').classList.add('open'); window.manualDialog.close(); });
    assert.equal(await page.locator('#weekly-release-dialog').isVisible(), false);
    await page.evaluate(() => document.querySelector('#auth-overlay').classList.remove('open'));
    await page.locator('#weekly-release-dialog').waitFor({ state: 'visible' });
    await page.evaluate(() => window.SoberOctoberWeeklyPopup.update(null, null));
    await page.locator('#weekly-release-dialog').waitFor({ state: 'hidden' });
    // Late database responses cannot re-open notices for a user who has logged out or switched accounts.
    await page.evaluate(() => {
      window.late = new Promise(resolve => { window.resolveLate = resolve; });
      window.oldRefresh = window.SoberOctoberEliminations.refresh({ rpc: () => window.late }, 'old', 'Old user');
      window.SoberOctoberEliminations.resetOnLogout('old');
      window.resolveLate({ data: { status: 'eliminated', current_elimination_event_id: 'old-event' }, error: null });
    });
    await page.evaluate(() => window.oldRefresh);
    assert.equal(await page.locator('#elimination-overlay').isVisible(), false);
    await page.evaluate(async () => {
      window.late = new Promise(resolve => { window.resolveLate = resolve; });
      window.oldRefresh = window.SoberOctoberEliminations.refresh({ rpc: () => window.late }, 'old', 'Old user');
      await window.SoberOctoberEliminations.refresh({ rpc: async name => ({ data: name === 'sync_competition_status' ? { status: 'active' } : [], error: null }) }, 'new', 'New user');
      window.resolveLate({ data: { status: 'eliminated', current_elimination_event_id: 'old-event' }, error: null });
      await window.oldRefresh;
    });
    assert.equal(await page.locator('#elimination-overlay').isVisible(), false, 'account switch discards old user response');
    // A consumed queue of other participants remains sequential.
    await page.evaluate(async () => {
      const events = [{ display_name: 'First', elimination_reason: 'Alkohol' }, { display_name: 'Second', elimination_reason: 'Två missade dagar i rad' }];
      await window.SoberOctoberEliminations.refresh({ rpc: async name => ({ data: name === 'sync_competition_status' ? { status: 'active' } : events.splice(0), error: null }) }, 'new', 'New user');
    });
    await page.locator('#elimination-overlay').waitFor({ state: 'visible' });
    assert.match(await page.locator('#elimination-title').innerText(), /First has been eliminated/);
    await page.getByRole('button', { name: 'Brutalt.' }).click();
    await page.waitForFunction(() => document.querySelector('#elimination-title').textContent.startsWith('Second'));
    await page.getByRole('button', { name: 'Brutalt.' }).click();
    await page.locator('#elimination-overlay').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log('Popup coordinator: real elimination/quote/report order, focus trap/restoration, date persistence, auth/manual gates, logout/account races and sequential notifications passed.');
  } finally { await browser?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
