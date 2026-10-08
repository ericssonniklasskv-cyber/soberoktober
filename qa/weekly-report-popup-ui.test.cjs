const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const name = path.resolve(root, '.' + (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
      if (!name.startsWith(root + path.sep)) throw Error('Path denied');
      res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript');
      res.end(await fs.readFile(name));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    // Exercise production HTML/CSS and popup modules without real auth or database writes.
    await page.route('**/*.js*', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (['/min-oktober/history-logic.js', '/min-oktober/report-seen.js', '/weekly-report-popup.js'].includes(p)) return route.continue();
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const visit = async (date = '2026-10-08', user = 'qa-anna') => {
      await page.goto(origin);
      await page.evaluate(({ date, user }) => {
        document.body.classList.remove('entry-active');
        document.querySelector('#entry-gate').hidden = true;
        document.querySelector('#app-shell').inert = false;
        window.SoberOctoberWeeklyPopup.update(user, window.SoberOctoberHistory.nextUnseenReport(date, window.SoberOctoberReportSeen.read(user)));
      }, { date, user });
    };
    const dialog = page.locator('#weekly-release-dialog');
    await visit('2026-10-07');
    assert.equal(await dialog.isVisible(), false, 'no report before the Swedish period ends');
    await visit();
    await dialog.waitFor({ state: 'visible' });
    assert.match(await dialog.innerText(), /de senaste 7 dagarna/);
    assert.equal(await page.locator('#weekly-release-open').getAttribute('href'), '/min-oktober/?rapport=oct_01_07');
    assert.deepEqual(await page.evaluate(() => window.SoberOctoberReportSeen.read('qa-anna')), [], 'showing is not reading');
    await page.getByRole('button', { name: 'Inte just nu' }).click();
    assert.equal(await dialog.isVisible(), false);
    await visit();
    await dialog.waitFor({ state: 'visible' });
    await page.getByRole('link', { name: 'Öppna rapport' }).click();
    await page.waitForURL('**/min-oktober/?rapport=oct_01_07');
    assert.deepEqual(await page.evaluate(() => window.SoberOctoberReportSeen.read('qa-anna')), ['oct_01_07']);
    await visit();
    assert.equal(await dialog.isVisible(), false, 'opening persists across a return visit');
    await visit('2026-10-15');
    await dialog.waitFor({ state: 'visible' });
    assert.match(await dialog.innerText(), /Vecka 2/i);
    await page.evaluate(() => window.SoberOctoberWeeklyPopup.update(null, null));
    assert.equal(await dialog.isVisible(), false, 'logout closes popup');
    await visit('2026-10-08', 'qa-erik');
    await dialog.waitFor({ state: 'visible' });
    assert.match(await dialog.innerText(), /Vecka 1/i, 'different users keep separate read status');
    // Existing overlays always have priority, then the report opens when they close.
    await page.evaluate(() => { document.querySelector('#trump-quote-overlay').hidden = false; });
    await dialog.waitFor({ state: 'hidden' });
    await page.evaluate(() => { document.querySelector('#trump-quote-overlay').hidden = true; });
    await dialog.waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Inte just nu' }).click();
    await page.evaluate(() => window.SoberOctoberReportSeen.mark('qa-erik', 'oct_01_07'));
    await visit('2026-10-08', 'qa-erik');
    assert.equal(await dialog.isVisible(), false, 'reports opened in Min oktober use the same marker');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await visit('2026-10-08', `qa-width-${width}`);
      await dialog.waitFor({ state: 'visible' });
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, `dialog fits ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow ${width}px`);
      assert.equal(await page.locator('#weekly-release-open').evaluate((el) => el === document.activeElement), true);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#weekly-release-dialog')).opacity === '1');
      await page.screenshot({ path: `/private/tmp/sober-weekly-popup-${width}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(), false);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visit('2026-11-01', 'qa-last-period');
    await page.evaluate(() => {
      ['oct_01_07', 'oct_08_14', 'oct_15_21'].forEach((key) => window.SoberOctoberReportSeen.mark('qa-last-period', key));
      window.SoberOctoberWeeklyPopup.update('qa-last-period', window.SoberOctoberHistory.nextUnseenReport('2026-11-01', window.SoberOctoberReportSeen.read('qa-last-period')));
    });
    await dialog.waitFor({ state: 'visible' });
    assert.match(await dialog.innerText(), /de senaste 10 dagarna/);
    assert.equal(await dialog.evaluate((el) => getComputedStyle(el).animationName), 'none');
    assert.deepEqual(errors, []);
    console.log('Weekly popup: date gates, read persistence, user isolation, overlay queue, navigation, 320/390/768/1440px, keyboard and reduced motion passed.');
  } finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
