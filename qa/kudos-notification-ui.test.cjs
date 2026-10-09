const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + path.sep)) throw Error('Denied');
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const errors = [], calls = [], records = new Map();
  const add = (user, key) => {
    const item = { kudos_key: key, sender_name: 'Test Zellmani', activity_label: '30 minuter löpning',
      message: 'Bra kämpat! <script>alert(1)</script>', created_at: '2026-10-09T05:00:00Z', is_unread: true };
    records.set(user, [...(records.get(user) || []), item]);
  };
  let failCount = false, failRead = false, holdCount;
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.qaUser = 'anna';
      window.ActivityLogic = { fullTimestamp: text => text, sentence: item => item.display_name + ' klarade dagens pass ×2' };
      window.qaClient = {
        auth: { getSession: async () => ({ data: { session: window.qaUser ? { user: { id: window.qaUser } } : null } }) },
        rpc: async (name, args = {}) => fetch('/qa/rpc/' + name, { method: 'POST', body: JSON.stringify({ user: window.qaUser, args }) }).then(r => r.json()),
      };
      window.SoberActivity = { createClient: async () => window.qaClient };
    });
    await context.route('**/*.js*', route => {
      const p = new URL(route.request().url()).pathname;
      if (['/aktivitet/kudos.js', '/min-oktober/history-logic.js', '/min-oktober/report-seen.js', '/weekly-report-popup.js'].includes(p)) return route.continue();
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    await context.route('**/qa/rpc/*', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      const { user, args } = route.request().postDataJSON();
      calls.push({ name, user, args });
      const own = records.get(user) || [];
      let data, error = null;
      if (name === 'get_my_kudos_unread_count') {
        if (holdCount) { const wait = holdCount; holdCount = null; await wait; }
        if (failCount) { failCount = false; error = { code: '503' }; } else data = own.filter(k => k.is_unread).length;
      } else if (name === 'get_my_activity_kudos') data = [...own].reverse().slice(args.p_offset, args.p_offset + args.p_limit);
      else if (name === 'mark_activity_kudos_read') {
        if (failRead) { failRead = false; error = { code: '503' }; }
        else { own.filter(k => args.p_kudos_keys.includes(k.kudos_key)).forEach(k => { k.is_unread = false; }); data = args.p_kudos_keys.length; }
      } else if (name === 'send_activity_kudos') data = true;
      else throw Error('Unexpected RPC: ' + name);
      await route.fulfill({ json: { data, error } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const dialog = page.locator('.kudos-dialog');
    const ready = async (extra = '') => {
      await page.evaluate(extra => {
        document.body.classList.remove('entry-active');
        const app = document.getElementById('app-shell');
        if (app) { app.inert = false; app.setAttribute('aria-hidden', 'false'); }
        document.getElementById('entry-gate')?.setAttribute('hidden', '');
        if (!document.getElementById('elimination-overlay')) {
          const overlay = document.createElement('div');
          overlay.id = 'elimination-overlay'; overlay.hidden = true; document.body.append(overlay);
        }
        if (extra) document.querySelector(extra).hidden = false;
      }, extra);
    };
    const visit = async (url = '/') => { await page.goto(origin + url); await ready(); };
    const refresh = () => page.evaluate(() => document.dispatchEvent(new CustomEvent('soberoktober:activity-auth', { detail: { userId: window.qaUser } })));
    const signOut = () => page.evaluate(() => { window.qaUser = null; document.dispatchEvent(new CustomEvent('soberoktober:activity-auth', { detail: { userId: null } })); });
    // Regression: unread kudos open without clicking the inbox, then stay read on reload and another device.
    add('anna', '1'); add('anna', '2');
    await visit();
    await page.getByRole('heading', { name: 'Du har fått kudos 👏' }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.kudos-note').length === 2 && document.querySelector('#kudos-unread-count').textContent === '');
    assert.match(await dialog.innerText(), /Test Zellmani gav dig kudos för 30 minuter löpning/);
    assert.equal(await page.locator('.kudos-note-message script').count(), 0, 'message stays plain text');
    assert.equal(records.get('anna').filter(k => k.is_unread).length, 0);
    await page.keyboard.press('Escape');
    await visit();
    await page.getByRole('button', { name: 'Dina kudos', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0, 'already read kudos do not pop up again');
    const device = await context.newPage();
    device.on('pageerror', e => errors.push(e.message));
    await device.goto(origin + '/aktivitet/');
    await device.getByRole('button', { name: 'Dina kudos', exact: true }).waitFor();
    assert.equal(await device.locator('.kudos-dialog').count(), 0, 'read state shared by recipient, not localStorage');
    await device.close();
    // New visit has new unread kudos; no auto-reopening or interrupting a send dialog during that visit.
    add('anna', '3');
    await visit('/aktivitet/');
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#kudos-unread-count').textContent === '');
    await page.getByRole('button', { name: 'Stäng', exact: true }).click();
    add('anna', '4'); await refresh();
    await page.getByRole('button', { name: 'Dina kudos, 1 nya', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0, 'polling does not repeatedly interrupt the same visit');
    await visit();
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#kudos-unread-count').textContent === '');
    await page.getByRole('button', { name: 'Stäng', exact: true }).click();
    // Queue behind weekly report, auth/onboarding, quote and elimination overlay.
    add('anna', '5');
    await page.goto(origin);
    await page.evaluate(() => window.SoberOctoberWeeklyPopup.update('anna', window.SoberOctoberHistory.nextUnseenReport('2026-10-09', [])));
    await ready('#trump-quote-overlay');
    await page.getByRole('button', { name: 'Dina kudos, 1 nya', exact: true }).waitFor();
    assert.equal(await dialog.count(), 0);
    await page.evaluate(() => { document.querySelector('#trump-quote-overlay').hidden = true; document.querySelector('#auth-overlay').classList.add('open'); });
    assert.equal(await dialog.count(), 0);
    await page.evaluate(() => { document.querySelector('#auth-overlay').classList.remove('open'); document.querySelector('#elimination-overlay').hidden = false; });
    assert.equal(await dialog.count(), 0);
    await page.evaluate(() => { document.querySelector('#elimination-overlay').hidden = true; });
    // Either queued dialog may win; they must never be open together.
    await page.waitForFunction(() => document.querySelector('dialog[open]'));
    assert.equal(await page.locator('dialog[open]').count(), 1);
    if (await page.locator('#weekly-release-dialog').isVisible()) await page.getByRole('button', { name: 'Inte just nu' }).click();
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.locator('dialog[open]').count(), 1);
    await page.waitForFunction(() => document.querySelector('#kudos-unread-count').textContent === '');
    await page.getByRole('button', { name: 'Stäng', exact: true }).click();
    if (await page.locator('#weekly-release-dialog').isVisible()) await page.getByRole('button', { name: 'Inte just nu' }).click();
    // Failure preserves unread status; manual retry still works and logout closes private UI.
    add('anna', '6'); failCount = true;
    await visit(); await refresh();
    await dialog.waitFor({ state: 'visible' });
    await signOut();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.locator('#kudos-inbox-button').isVisible(), false);
    add('anna', '7'); failRead = true;
    await visit();
    await page.getByText('Hälsningarna visas, men kunde inte markeras som lästa.').waitFor();
    assert.ok(records.get('anna').some(k => k.is_unread));
    await page.getByRole('button', { name: 'Stäng', exact: true }).click();
    await page.locator('#kudos-inbox-button').click();
    await page.waitForFunction(() => document.querySelector('#kudos-unread-count').textContent === '');
    assert.equal(records.get('anna').filter(k => k.is_unread).length, 0);
    await page.getByRole('button', { name: 'Stäng', exact: true }).click();
    // An in-flight response must not reopen private UI after logout.
    let release; holdCount = new Promise(resolve => { release = resolve; });
    await refresh();
    await signOut(); release();
    await page.getByRole('button', { name: 'Dina kudos' }).waitFor({ state: 'hidden' });
    await dialog.waitFor({ state: 'detached' });
    for (const width of [320, 390, 768, 1440]) {
      add('anna', 'width-' + width);
      await page.setViewportSize({ width, height: 900 });
      await visit();
      await dialog.waitFor({ state: 'visible' });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.kudos-dialog')).opacity === '1');
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, 'dialog fits ' + width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `/private/tmp/sober-kudos-notification-${width}.png` });
      await page.keyboard.press('Escape');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    add('anna', 'reduced'); await visit(); await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.deepEqual(errors, []);
    assert.ok(calls.some(c => c.name === 'mark_activity_kudos_read'));
    console.log('PASS: automatic unread notification, read persistence, new visits, no repeated polling popups, overlay queue, network/read retry, logout races, mobile/desktop, keyboard, reduced motion and XSS. No real user data modified.');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
