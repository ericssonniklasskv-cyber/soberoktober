const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { browserOptions } = require('../qa/browser.cjs');

(async () => {
  let browser, child;
  try {
    const root = path.resolve(__dirname, '..');
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    child = spawn(process.execPath, ['scripts/dev-derby.mjs'], { cwd: root, env: { ...process.env, DERBY_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      child.stdout.once('data', resolve);
      child.once('error', reject);
      child.once('exit', code => { if (code) reject(Error('Server failed ' + code)); });
    });
    const origin = 'http://127.0.0.1:' + port;
    for (const file of await fs.readdir(path.join(root, 'derby/audio'))) {
      const response = await fetch(origin + '/derby/audio/' + file);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'audio/mp4');
      assert.equal((await response.arrayBuffer()).byteLength, (await fs.stat(path.join(root, 'derby/audio', file))).size);
    }
    const audioURL = origin + '/derby/audio/squats-15.m4a';
    const partial = await fetch(audioURL, { headers: { Range: 'bytes=0-31' } });
    assert.equal(partial.status, 206);
    assert.match(partial.headers.get('content-range'), /^bytes 0-31\/\d+$/);
    assert.equal((await partial.arrayBuffer()).byteLength, 32);
    assert.equal((await fetch(audioURL, { headers: { Range: 'bytes=999999-' } })).status, 416);
    assert.equal((await fetch(origin + '/derby/audio/../README.md')).status, 404);

    browser = await chromium.launch({ headless: true, ...browserOptions() });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.locator('[data-exercise=squats]').click();
    await page.waitForFunction(() => {
      const audio = document.querySelector('#exercise-audio');
      return audio.currentTime > 0 && audio.duration > 0 && !audio.paused && !audio.error;
    });
    await page.locator('#sound-toggle').click();
    assert(await page.locator('#exercise-audio').evaluate(audio => audio.paused));
    await page.locator('#sound-toggle').click();

    // Capture the selected recording independently from actual speaker playback.
    await context.addInitScript(() => {
      window.playedVoices = [];
      window.pauseCount = 0;
      window.failVoice = false;
      const pause = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause = function () { window.pauseCount++; return pause.call(this); };
      HTMLMediaElement.prototype.play = function () {
        window.playedVoices.push(new URL(this.src).pathname);
        return window.failVoice ? Promise.reject(Error('Simulated playback block')) : Promise.resolve();
      };
    });
    await page.reload();
    assert.deepEqual(await page.evaluate(() => playedVoices), [], 'Reload does not play a voice');
    await page.locator('.demo-tools summary').click();
    page.on('dialog', dialog => dialog.accept());
    const reset = () => page.locator('#reset-demo').click();
    await reset();
    for (const [id, levels] of [['squats', [15, 30, 45]], ['pushups', [10, 20, 30]], ['pullups', [5, 10, 15, 20]], ['running', [1, 2, 3, 4, 5]]]) {
      const before = await page.evaluate(() => playedVoices.length);
      for (const value of levels) {
        await page.locator('[data-exercise=' + id + ']').click();
        assert.equal(await page.evaluate(() => playedVoices.at(-1)), '/derby/audio/' + id + '-' + value + '.m4a');
      }
      await page.locator('[data-exercise=' + id + ']').click();
      assert.equal(await page.evaluate(() => playedVoices.length), before + levels.length, 'Past the last recording there is no wrong lower-count voice');
    }
    assert.equal(await page.locator('[data-exercise=running] .exercise-progress').textContent(), 'I dag: 15 km löpning');
    assert.equal(await page.locator('.exercise-total strong').nth(3).textContent(), '15');
    await page.locator('#test-day').selectOption('2026-10-27');
    await page.locator('[data-exercise=squats]').click();
    assert.equal(await page.evaluate(() => playedVoices.at(-1)), '/derby/audio/squats-15.m4a');
    await page.locator('[data-exercise=squats]').click();
    await page.locator('#undo-last').click();
    await page.locator('[data-exercise=squats]').click();
    assert.equal(await page.evaluate(() => playedVoices.at(-1)), '/derby/audio/squats-30.m4a', 'Undo corrects the next milestone');
    await page.locator('[data-exercise=running]').click();
    assert.equal(await page.evaluate(() => playedVoices.at(-1)), '/derby/audio/running-1.m4a');
    assert.match(await page.locator('#activity-list li').first().textContent(), /2,5 km löpning/);
    const beforeMute = await page.evaluate(() => playedVoices.length);
    await page.locator('#sound-toggle').click();
    await page.locator('[data-exercise=running]').click();
    assert.equal(await page.evaluate(() => playedVoices.length), beforeMute);
    await page.reload();
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await page.evaluate(() => playedVoices), []);
    await page.locator('#sound-toggle').click();
    await page.locator('.demo-tools summary').click();
    await page.locator('#test-day').selectOption('2026-10-28');
    await page.evaluate(() => { window.failVoice = true; });
    const points = parseInt(await page.locator('#week-points').textContent());
    await page.locator('[data-exercise=pullups]').click();
    assert.equal(parseInt(await page.locator('#week-points').textContent()), points + 1);
    assert.match(await page.locator('#record-feedback').textContent(), /sparad, men ljudet/);
    assert((await page.evaluate(() => pauseCount)) > 0, 'New clicks stop previous playback');
    assert.deepEqual(errors, []);
    console.log('PASS voices: real AAC playback, all 15 files, byte ranges, daily milestones, running distance, undo, mute persistence, no automatic replay, audio failure preserves registration.');
  } finally {
    await browser?.close();
    child?.kill('SIGTERM');
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
