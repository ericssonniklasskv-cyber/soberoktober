const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { browserOptions } = require('../qa/browser.cjs');

(async () => {
  let child, browser;
  try {
    const root = path.resolve(__dirname, '..');
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    child = spawn(process.execPath, ['scripts/dev-adventure.mjs'], { cwd: root, env: { ...process.env, ADVENTURE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', code => { if (code) reject(Error('Server failed: ' + code)); }); });
    const origin = 'http://127.0.0.1:' + port;
    browser = await chromium.launch({ headless: true, ...browserOptions(), args: ['--mute-audio'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    const directory = '/private/tmp/adventure-preview'; await fs.mkdir(directory, { recursive: true });
    const tools = async () => { if (!await page.locator('.test-tools').evaluate(node => node.open)) await page.locator('.test-tools summary').click(); };
    const imagesReady = async () => page.waitForFunction(() => [...document.querySelectorAll('img.personal-pawn')].every(img => img.complete && img.naturalWidth > 0));
    await page.goto(origin); await imagesReady();
    assert.equal(await page.locator('.home-rank-row img.personal-pawn').count(), 5);
    await page.locator('#choose-avatar').click();
    assert.equal(await page.locator('.avatar-option').count(), 6);
    await page.locator('.avatar-option[data-mount=deer]').click();
    await page.locator('[data-exercise=running]').click();
    const saved = await page.evaluate(() => localStorage.getItem('soberoktober:final-adventure:v1'));
    for (const id of ['mikeb', 'jerka', 'zellmani', 'elliott-da-bomb', 'nillebae']) {
      await tools(); await page.locator('#test-participant').selectOption(id); await imagesReady();
      assert.equal(await page.locator('#choose-avatar').isHidden(), true);
      assert.equal(await page.locator('#choose-avatar').isDisabled(), true);
      assert.equal(await page.locator('#personal-pawn-lock').isVisible(), true);
      assert.equal(await page.locator('#hero-rider img').getAttribute('data-personal-pawn'), id);
      assert.equal(await page.locator('.map-pawn[data-own=true] img').getAttribute('data-personal-pawn'), id);
      assert.equal(new Set(await page.locator('.map-pawn').evaluateAll(nodes => nodes.map(node => node.dataset.mount))).size, 6);
      assert.equal(await page.locator('.home-rank-row').count(), 6);
      assert.equal(await page.evaluate(() => localStorage.getItem('soberoktober:final-adventure:v1')), saved, 'Changing the demo identity preserves progress');
      await page.evaluate(() => { const button = document.getElementById('choose-avatar'); button.disabled = false; button.hidden = false; button.click(); });
      assert.equal(await page.locator('#detail-dialog').isVisible(), false, 'Handler also rejects a forced choice click');
      await page.reload(); await imagesReady();
      assert.equal(await page.locator('#hero-rider img').getAttribute('data-personal-pawn'), id);
      assert.equal(await page.locator('#choose-avatar').isDisabled(), true);
    }
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await imagesReady();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Personal pawn layout fits ' + width);
      await page.locator('#hero-passport').screenshot({ path: directory + '/personal-pawn-' + width + '.png' });
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await tools(); await page.locator('#crowd-test').click(); await page.locator('.crowd-badge').click(); await imagesReady();
    assert.equal(await page.locator('#detail-dialog .player-detail').count(), 6);
    assert.equal(await page.locator('#detail-dialog img.personal-pawn').count(), 5);
    assert(await page.locator('#detail-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
    await page.screenshot({ path: directory + '/personal-pawns-crowd-390.png' });
    await page.keyboard.press('Escape'); await page.locator('#crowd-test').click();
    await page.locator('#test-participant').selectOption('guest');
    assert.equal(await page.locator('#choose-avatar').isVisible(), true);
    assert.equal(await page.locator('#mount-name').textContent(), 'Guldhjorten', 'The previous standard choice remains saved');
    await page.locator('#choose-avatar').click(); await page.locator('.avatar-option[data-mount=fox]').click();
    assert.equal(await page.locator('#mount-name').textContent(), 'Kopparräven');
    await page.locator('#test-participant').selectOption('nillebae');
    await page.evaluate(() => {
      let state = SoberAdventure.createState();
      for (let n = 0; n < 6; n++) state = SoberAdventure.record(state, 'squats', '2026-10-31');
      localStorage.setItem('soberoktober:final-adventure:v1', JSON.stringify(state));
    });
    await page.reload(); await page.locator('#boss-dialog').waitFor({ state: 'visible' }); await imagesReady();
    assert.equal(await page.locator('.encounter-rider img').getAttribute('data-personal-pawn'), 'nillebae');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.locator('#boss-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth));
      await page.screenshot({ path: directory + '/personal-pawn-encounter-' + width + '.png' });
    }
    await page.locator('#defeat-boss').click();
    assert.equal(await page.locator('.encounter-rider img').getAttribute('data-personal-pawn'), 'nillebae');
    assert.match(await page.locator('#boss-dialog-title').textContent(), /Pannben: 1/);
    await page.locator('#continue-journey').click();
    await tools(); await page.locator('#test-day').selectOption('2026-10-31');
    await page.evaluate(() => {
      const G = SoberAdventure; let state = G.createState();
      for (let n = 1; n <= G.BOARD_SIZE; n++) {
        state = G.record(state, 'squats', '2026-10-31');
        const boss = G.progress(state).pendingBoss;
        if (boss && n < G.BOARD_SIZE) state = G.resolveBoss(state, boss.id, boss.choices[0].id, '2026-10-31');
      }
      localStorage.setItem('soberoktober:final-adventure:v1', JSON.stringify(state));
    });
    await page.reload(); await page.locator('#meet-boss').click(); await imagesReady();
    assert.equal(await page.locator('.encounter-rider img').getAttribute('data-personal-pawn'), 'nillebae');
    await page.locator('#defeat-boss').click(); await imagesReady();
    assert.equal(await page.locator('.finale-rider img').getAttribute('data-personal-pawn'), 'nillebae');
    assert.match(await page.locator('.finale-achievement').textContent(), /PANNBEN: 6/);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.screenshot({ path: directory + '/personal-pawn-finale-390.png' });
    await page.locator('#continue-journey').click(); await page.reload(); await imagesReady();
    assert.equal(await page.locator('#hero-rider img').getAttribute('data-personal-pawn'), 'nillebae');
    assert.equal(await page.locator('#choose-avatar').isHidden(), true);
    assert.equal(await page.locator('#score-total').textContent(), '0');
    assert(requests.every(url => url.startsWith(origin)));
    assert.deepEqual(errors, []);
    console.log('PASS personal pawns: all five portraits load, fixed choices survive reload and forced clicks, guest choices remain available, progress is preserved, six unique pawns, crowded tiles, four responsive sizes, encounter/victory/finale use the assigned pawn, no external requests.');
  } finally { await browser?.close(); child?.kill('SIGTERM'); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
