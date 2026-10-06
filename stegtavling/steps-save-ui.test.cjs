const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      let pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.resolve(root, `.${pathname}`);
      if (!file.startsWith(`${root}${path.sep}`)) throw Error('Invalid path');
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.STEPS_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
    const page = await browser.newPage();
    const rows = new Map();
    const writes = [], errors = [];
    let failNext = false, raceNext = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('stepsFixtureQuery', async args => {
      const operation = args.find(a => ['update', 'insert', 'upsert'].includes(a[0]));
      if (!operation) {
        const key = args.find(a => a[0] === 'eq' && a[1] === 'period_key')?.[2];
        return { data: [...rows].filter(([period_key]) => !key || key === period_key).map(([period_key, avg_steps]) => ({ period_key, avg_steps })), error: null };
      }
      writes.push(args);
      if (failNext) { failNext = false; return { error: { code: '42501', message: 'Write rejected' } }; }
      const [kind, payload] = operation;
      if (kind === 'update') {
        assert.equal(args.some(a => a[0] === 'select'), false, 'Updates must not request row representation');
        assert.deepEqual(Object.keys(payload), ['avg_steps'], 'Only avg_steps has UPDATE permission');
        assert.ok(args.some(a => a[0] === 'eq' && a[1] === 'user_id' && a[2] === 'own-test-user'));
        const key = args.find(a => a[0] === 'eq' && a[1] === 'period_key')[2];
        if (!rows.has(key)) return { data: null, error: null };
        rows.set(key, payload.avg_steps);
        return { data: null, error: null };
      }
      assert.equal(kind, 'insert', 'Upsert must never be used with immutable key columns');
      assert.equal(payload.user_id, 'own-test-user');
      if (raceNext) { raceNext = false; rows.set(payload.period_key, 9000); }
      if (rows.has(payload.period_key)) return { error: { code: '23505', message: 'Unique constraint' } };
      rows.set(payload.period_key, payload.avg_steps);
      return { data: null, error: null };
    });
    await page.exposeFunction('stepsFixtureLeaderboard', () => ({ data: rows.size ? [{ rank_position: 1, display_name: 'Stegtest', average_steps: [...rows.values()].reduce((a, b) => a + b) / rows.size, reported_periods: rows.size }] : [], error: null }));
    await page.route('**/api/config', route => route.fulfill({ json: { supabaseUrl: 'https://steps-fixture.invalid', supabasePublishableKey: 'fixture-only' } }));
    await page.route('**/supabase.js', route => route.fulfill({ contentType: 'text/javascript', body: `
      window.supabase = {createClient: () => ({
        auth: {getSession: async () => ({data:{session:{user:{id:'own-test-user'}}},error:null}), onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}})},
        from() { const args=[]; const q={then(resolve,reject){return window.stepsFixtureQuery(args).then(resolve,reject)}};
          ['select','update','insert','upsert','eq','order'].forEach(k => q[k]=(...v) => {args.push([k,...v]);return q});return q; },
        rpc: () => window.stepsFixtureLeaderboard()
      })};
    ` }));
    await page.goto(`http://127.0.0.1:${server.address().port}/stegtavling/`);
    const input = key => page.locator(`[data-period-card="${key}"] input`);
    const button = key => page.locator(`[data-period-card="${key}"] button`);
    const feedback = key => page.locator(`[data-period-card="${key}"] .period-feedback`);
    await input('oct_01_07').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#steps-oct-01-07').disabled);
    const save = async (key, value) => {
      await input(key).fill(value);
      await button(key).click();
      await page.waitForFunction(k => document.querySelector(`[data-period-card="${k}"] .period-feedback`).textContent.startsWith('Sparat snitt:'), key);
    };
    await save('oct_01_07', '10 430');
    assert.equal(rows.get('oct_01_07'), 10430);
    assert.equal(await page.locator('#steps-score').textContent(), '20');
    assert.equal(await page.locator('#reported-count').textContent(), '1/4');
    assert.match(await page.locator('#step-leaderboard-list').textContent(), /Stegtest/);
    await save('oct_01_07', '12000');
    assert.equal(rows.size, 1);
    assert.equal(rows.get('oct_01_07'), 12000);
    assert.equal(await page.locator('#steps-score').textContent(), '25');
    const beforeInvalid = writes.length;
    await input('oct_01_07').fill('100001');
    await button('oct_01_07').click();
    assert.match(await feedback('oct_01_07').textContent(), /positivt heltal/);
    assert.equal(writes.length, beforeInvalid);
    raceNext = true;
    await save('oct_08_14', '14000');
    assert.equal(rows.get('oct_08_14'), 14000);
    assert.equal(rows.size, 2, 'Concurrent creation still leaves one row per period');
    failNext = true;
    await input('oct_01_07').fill('13000');
    await button('oct_01_07').click();
    await page.waitForFunction(() => document.querySelector('[data-period-card="oct_01_07"] .period-feedback').textContent.includes('kunde inte sparas'));
    assert.equal(await input('oct_01_07').isEnabled(), true);
    assert.equal(await button('oct_01_07').isEnabled(), true);
    assert.equal(rows.get('oct_01_07'), 12000);
    await save('oct_01_07', '13000');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#steps-oct-01-07').value === '13000');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}px`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: first save, update, one row per period, unique conflict retry, validation, error recovery, reload, leaderboard and responsive layout');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
