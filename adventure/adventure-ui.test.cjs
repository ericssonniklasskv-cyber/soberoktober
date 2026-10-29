const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
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
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    child = spawn(process.execPath, ['scripts/dev-adventure.mjs'], { cwd: root, env: { ...process.env, ADVENTURE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      child.stdout.once('data', resolve); child.once('error', reject);
      child.once('exit', code => { if (code) reject(Error('Local server failed: ' + code)); });
    });
    const origin = 'http://127.0.0.1:' + port;
    for (const route of ['/api/config', '/.env.local', '/adventure/AGENTS.md', '/adventure/adventure-logic.test.js', '/derby/audio/squats-15.m4a']) {
      assert.equal((await fetch(origin + route)).status, 404);
    }
    const audioFiles = ['beer-orc', 'wine-gnome', 'shots-dragon', 'prosecco-witch', 'nightclub-gollum', 'hangover-baron'];
    for (const name of [...audioFiles, 'final-fanfare']) {
      const url = origin + '/adventure/audio/' + name + '.m4a';
      const head = await fetch(url, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get('content-type'), 'audio/mp4');
      assert.equal(head.headers.get('accept-ranges'), 'bytes');
      const length = Number(head.headers.get('content-length'));
      assert(length > 100000 && length < 2000000, 'Web-sized audio file: ' + name);
      assert.equal((await head.arrayBuffer()).byteLength, 0);
      for (const [range, start, end] of [['bytes=0-1', 0, 1], ['bytes=100-', 100, length - 1], ['bytes=-16', length - 16, length - 1]]) {
        const part = await fetch(url, { headers: { Range: range } });
        assert.equal(part.status, 206);
        assert.equal(part.headers.get('content-range'), `bytes ${start}-${end}/${length}`);
        assert.equal((await part.arrayBuffer()).byteLength, end - start + 1);
      }
      for (const range of ['bytes=999999999-', 'bytes=10-1', 'bytes=-0', 'bytes=0-1,4-5']) {
        assert.equal((await fetch(url, { headers: { Range: range } })).status, 416);
      }
    }
    browser = await chromium.launch({ headless: true, ...browserOptions() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], requests = [];
    const positionLabel = async () => {
      const label = await page.locator('.map-pawn[data-own=true]').getAttribute('aria-label');
      const match = label.match(/ruta (\d+)/);
      return match ? 'Ruta ' + match[1] : 'Start';
    };
    const defeatedBossesLabel = async () => {
      return await page.locator('.map-tile.boss-tile[data-state=done]').count() + ' av 6';
    };
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    const audioStopped = async () => {
      await page.waitForFunction(() => {
        const audio = document.getElementById('boss-audio');
        return audio.paused && !audio.hasAttribute('src') && audio.currentTime === 0;
      });
    };
    const fanfareStopped = async () => {
      await page.waitForFunction(() => {
        const audio = document.getElementById('finale-audio');
        return audio.paused && !audio.hasAttribute('src') && audio.currentTime === 0;
      });
    };
    const fanfarePlaying = async () => {
      await page.waitForFunction(() => {
        const audio = document.getElementById('finale-audio');
        return !audio.paused && audio.currentTime > 0 && audio.volume === 1 && !audio.loop && audio.duration > 10 && audio.currentSrc.endsWith('/final-fanfare.m4a');
      }, null, { timeout: 10000 });
    };
    const playBossAudio = async name => {
      assert.equal(await page.locator('#boss-audio').getAttribute('src'), null, 'Opening a card never loads audio');
      assert.equal(await page.locator('#boss-audio-toggle').textContent(), '▶Spela ljud');
      assert.equal(await page.locator('#boss-audio-toggle').getAttribute('aria-pressed'), 'false');
      assert(await page.locator('#boss-audio').evaluate(audio => audio.paused && !audio.autoplay && audio.preload === 'none'));
      await page.locator('#boss-audio-toggle').click();
      await page.waitForFunction(name => {
        const audio = document.getElementById('boss-audio');
        return !audio.paused && audio.currentTime > 0 && Number.isFinite(audio.duration) && audio.duration > 50 && audio.currentSrc.endsWith('/' + name + '.m4a');
      }, name, { timeout: 10000 });
      assert.match(await page.locator('#boss-audio-toggle').textContent(), /Stoppa ljud/);
      assert.equal(await page.locator('#boss-audio-toggle').getAttribute('aria-pressed'), 'true');
    };
    await page.goto(origin);
    assert.equal(await page.locator('.journey-stats').count(), 0);
    assert.equal(await positionLabel(), 'Start');
    assert.equal(await page.locator('.map-tile').count(), 61);
    assert.equal(await page.locator('.boss-gallery,.gallery-card').count(), 0);
    assert.equal(await page.locator('audio').count(), 2);
    await audioStopped();
    assert.equal(requests.filter(url => url.includes('/audio/')).length, 0);
    await fanfareStopped();
    assert.equal(await page.locator('#score-summary').isVisible(), false);
    assert.equal(await page.locator('[data-exercise=running] strong').textContent(), 'Löpning 1 km');
    assert.match(await page.locator('#exercise-intro').textContent(), /Riket ger inga poäng/);
    assert(await page.evaluate(() => {
      try { SoberAdventure.recordScore(SoberAdventure.createState(), 'squats', '2026-10-26'); return false; } catch { return true; }
    }), 'Points cannot be recorded before playing the realm');
    assert.equal(new Set(await page.locator('.map-pawn').evaluateAll(nodes => nodes.map(node => node.dataset.mount))).size, 6);
    const directory = '/private/tmp/adventure-preview'; await fs.mkdir(directory, { recursive: true });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(100);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow at ' + width);
      assert(await page.locator('.exercise-button,.map-actions button').evaluateAll(nodes => nodes.every(node => {
        const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
      })), 'Touch controls stay usable');
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: directory + '/' + width + '.png', fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.locator('#choose-avatar').click();
    await page.locator('[data-mount=deer].avatar-option').click();
    assert.equal(await page.locator('#mount-name').textContent(), 'Guldhjorten');
    assert.equal(new Set(await page.locator('.map-pawn').evaluateAll(nodes => nodes.map(node => node.dataset.mount))).size, 6);
    await page.locator('.test-tools summary').click();
    await page.locator('#crowd-test').click();
    assert.equal(await page.locator('.crowd-badge').textContent(), '+3');
    await page.locator('.crowd-badge').click();
    assert.equal(await page.locator('#detail-dialog .player-detail').count(), 6);
    await page.locator('[data-close=detail-dialog]').click();
    await page.locator('#crowd-test').click();
    for (const id of ['squats', 'pushups', 'running', 'pullups', 'squats', 'pushups']) await page.locator('[data-quick-exercise=' + id + ']').click();
    await page.locator('#boss-dialog').waitFor({ state: 'visible' });
    assert.equal(await positionLabel(), 'Ruta 6');
    assert.equal(await page.locator('#boss-dialog-title').textContent(), 'Attraktiva Öl-Orcen');
    assert.equal(await page.locator('.encounter-enemy svg').getAttribute('data-boss-sprite'), 'troll');
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => node.disabled)));
    assert.equal(await page.locator('.encounter-rider').getAttribute('data-mount'), 'deer', 'Encounter uses the chosen player mount');
    assert.match(await page.locator('.boss-stage').getAttribute('aria-label'), /Guldhjorten.*Attraktiva Öl-Orcen/);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
      assert(await page.locator('#boss-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), 'Boss encounter does not overflow at ' + width);
      assert(await page.locator('.boss-stage').evaluate(stage => stage.getBoundingClientRect().height >= 260), 'Boss art has a larger stage');
      assert(await page.locator('#boss-audio-toggle').evaluate(button => {
        const box = button.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
      }), 'Prominent sound button stays usable at ' + width);
      await page.locator('#boss-dialog').evaluate(dialog => { dialog.scrollTop = 0; });
      await page.screenshot({ path: directory + '/encounter-' + width + '.png' });
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.locator('.boss-audio-player').screenshot({ path: directory + '/boss-audio-390.png' });
    assert.equal(requests.filter(url => url.includes('/audio/')).length, 0, 'No sound is downloaded before opt-in');
    await playBossAudio('beer-orc');
    await page.locator('#boss-audio-toggle').click();
    await audioStopped();
    await page.locator('#boss-audio-toggle').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('boss-audio').currentTime > 0);
    await page.locator('#boss-audio').evaluate(audio => { audio.currentTime = audio.duration - .1; });
    await page.waitForFunction(() => document.getElementById('boss-audio-status').textContent.includes('Klart!'));
    await audioStopped();
    await playBossAudio('beer-orc');
    await page.keyboard.press('Escape');
    await audioStopped();
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => node.disabled)), 'Dismissing boss does not unlock exercises');
    assert(await page.evaluate(() => {
      const state = SoberAdventure.restore(localStorage.getItem('soberoktober:final-adventure:v1'));
      try { SoberAdventure.record(state, 'squats', '2026-10-27'); return false; } catch { return true; }
    }), 'Logic independently rejects boss bypass');
    await page.reload();
    await page.locator('#boss-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#mount-name').textContent(), 'Guldhjorten');
    assert.equal(await positionLabel(), 'Ruta 6');
    assert.equal(await page.locator('#boss-audio-toggle').getAttribute('aria-pressed'), 'false', 'Reload never autoplays the pending boss');
    await playBossAudio('beer-orc');
    await page.locator('[data-close=boss-dialog]').click();
    await audioStopped();
    await page.locator('.test-tools summary').click();
    await page.locator('#test-day').selectOption('2026-10-27');
    assert.equal(await page.locator('#test-day').inputValue(), '2026-10-27');
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => node.disabled)), 'New day keeps the boss gate');
    await page.locator('#meet-boss').click();
    assert.equal(await page.locator('.boss-choice').count(), 0, 'A single mission replaces the old A/B choices');
    assert.equal(await page.locator('#challenge-timer').count(), 0, 'Group missions are not timed');
    assert.equal(await page.locator('#challenge-panel').getAttribute('data-challenge'), 'somersault');
    assert.match(await page.locator('.mission-description').textContent(), /kullerbytta/);
    assert.match(await page.locator('#defeat-boss').textContent(), /gjort och delat/);
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => node.disabled)), 'Mission remains gated until explicitly confirmed');
    await page.route('**/adventure/audio/beer-orc.m4a', route => route.abort());
    await page.locator('#boss-audio-toggle').click();
    await page.waitForFunction(() => document.getElementById('boss-audio-status').textContent.includes('kunde inte spelas'));
    await audioStopped();
    assert.equal(await page.locator('#defeat-boss').isEnabled(), true, 'Audio failure never blocks the mission');
    await page.unroute('**/adventure/audio/beer-orc.m4a');
    await playBossAudio('beer-orc');
    await page.locator('#defeat-boss').click();
    await audioStopped();
    assert.equal(await defeatedBossesLabel(), '1 av 6');
    assert.equal(await positionLabel(), 'Ruta 6', 'Defeating boss does not add a training step');
    assert.equal(await page.locator('.boss-stage').getAttribute('data-mode'), 'victory');
    assert.equal(await page.locator('.encounter-rider').getAttribute('data-mount'), 'deer');
    await page.locator('#continue-journey').click();
    await page.locator('#undo-last').click();
    assert.equal(await defeatedBossesLabel(), '0 av 6');
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => node.disabled)), 'Undo boss restores gate');
    await page.locator('#meet-boss').click();
    assert.equal(await page.locator('#challenge-panel').getAttribute('data-challenge'), 'somersault');
    await page.locator('#defeat-boss').click();
    await page.locator('#continue-journey').click();
    for (let boss = 1; boss < 5; boss++) {
      for (let step = 0; step < (boss < 2 ? 6 : 12); step++) {
        await page.locator('[data-exercise=' + ['squats', 'pushups', 'pullups', 'running'][step % 4] + ']').click();
        if(boss===2&&step===5){await page.locator('#icecream-dialog').waitFor({state:'visible'});assert.equal(await positionLabel(),'Ruta 18');assert.equal(await page.locator('#score-summary').isVisible(),false);assert.equal(await page.locator('#treat-rider svg').count(),1);await page.locator('#treat-continue').click();}
        if(boss===2&&step===8){await page.locator('#shortcut-dialog').waitFor({state:'visible'});await page.locator('#keep-path').click();await page.locator('#shortcut-done').click();}
        if(boss===3&&step===3){await page.locator('#ride-dialog').waitFor({state:'visible'});await page.locator('#decline-ride').click();await page.locator('#ride-done').click();}
        if(boss===3&&step===8){await page.locator('#icecream-trap-dialog').waitFor({state:'visible'});await page.locator('#leave-icecream').click();await page.locator('#trap-done').click();}
        if(boss===4&&step===7){await page.locator('#return-ride-dialog').waitFor({state:'visible'});await page.locator('#return-decline').click();await page.locator('#return-done').click();}
      }
      await page.locator('#boss-dialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.encounter-enemy svg').getAttribute('data-boss-sprite'), ['troll', 'witch', 'dragon', 'sphinx', 'kraken'][boss]);
      assert.equal(await page.locator('#challenge-panel').getAttribute('data-challenge'), ['somersault', 'handstand', 'morning-walk', 'ball-juggling', 'bottle-flip'][boss]);
      assert.equal(await page.locator('.boss-choice').count(), 0);
      await playBossAudio(audioFiles[boss]);
      await page.locator('#defeat-boss').click();
      await audioStopped();
      await fanfareStopped();
      assert.equal(await page.locator('.finale-shell').count(), 0, 'Normal bosses never trigger the month finale');
      await page.locator('#continue-journey').click();
    }
    for (let step = 0; step < 12; step++) {
      await page.locator('[data-exercise=squats]').click();
      if(step>=6&&step<=10){await page.locator('#greeting-dialog').waitFor({state:'visible'});assert.equal(await positionLabel(),'Ruta '+(49+step));assert.match(await page.locator('.greeting-copy').textContent(),/Mästare Äventyraren/);await page.locator('#greeting-continue').click();}
    }
    await page.locator('#start-scoring').waitFor({ state: 'visible' });
    assert.match(await page.locator('#detail-title').textContent(), /framme vid slottet/);
    assert.equal(await page.locator('#boss-dialog').isVisible(), false);
    await page.locator('#start-scoring').click();
    assert.equal(await positionLabel(), 'Ruta 60');
    assert.equal(await defeatedBossesLabel(), '5 av 6');
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => !node.disabled)));
    assert.equal(await page.locator('#score-summary').isVisible(), true);
    assert.equal(await page.locator('#score-total').textContent(), '0');
    assert.equal(await page.locator('#meet-boss').isDisabled(), true);
    assert.equal(await page.locator('#quick-gate').isDisabled(), true);
    assert.equal(await page.locator('[data-exercise=running] strong').textContent(), 'Löpning 1 km');
    assert.equal(await page.locator('[data-quick-exercise=running] strong').textContent(), '1 km');
    await page.locator('.map-pawn[data-own=true]').click();
    assert.equal(await page.locator('[data-open-boss=final]').isDisabled(), true, 'Map previews cannot open the final early');
    assert.match(await page.locator('[data-open-boss=final]').textContent(), /31 oktober/);
    await page.locator('[data-close=detail-dialog]').click();
    assert(await page.evaluate(() => {
      const state = SoberAdventure.restore(localStorage.getItem('soberoktober:final-adventure:v1'));
      try { SoberAdventure.resolveBoss(state, 'final', 'victory-jump', '2026-10-27'); return false; } catch { return true; }
    }), 'The final date lock also exists in the logic');
    for (const id of ['squats', 'pushups', 'pullups', 'running']) await page.locator('[data-exercise=' + id + ']').click();
    assert.equal(await page.locator('#score-total').textContent(), '4');
    assert.equal(await page.locator('#score-today').textContent(), '4');
    assert.equal(await positionLabel(), 'Ruta 60');
    assert.deepEqual(await page.evaluate(() => SoberAdventure.scoreTotals(SoberAdventure.restore(localStorage.getItem('soberoktober:final-adventure:v1')))), { points: 4, squats: 15, pushups: 10, pullups: 5, running: 1 });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Scoring does not overflow at ' + width);
      assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => {
        const box = node.getBoundingClientRect(); return box.width >= 44 && box.height >= 44;
      })));
      await page.locator('#exercise-panel').screenshot({ path: directory + '/scoring-' + width + '.png' });
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    const mirror = await context.newPage();
    await mirror.goto(origin);
    assert.equal(await mirror.locator('#score-total').textContent(), '4');
    if (!await page.locator('.test-tools').evaluate(node => node.open)) await page.locator('.test-tools summary').click();
    await page.locator('#test-day').selectOption('2026-10-28');
    assert.equal(await page.locator('#score-today').textContent(), '0');
    await page.locator('[data-quick-exercise=running]').click();
    assert.equal(await page.locator('#score-today').textContent(), '1');
    assert.equal(await page.locator('#score-total').textContent(), '5');
    await mirror.waitForFunction(() => document.getElementById('score-total').textContent === '5');
    await mirror.close();
    await page.locator('#test-day').selectOption('2026-10-26');
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => node.disabled)));
    await page.locator('#test-day').selectOption('2026-10-28');
    await page.reload();
    await page.waitForTimeout(250);
    assert.equal(await defeatedBossesLabel(), '5 av 6');
    assert.equal(await page.locator('#boss-dialog').isVisible(), false, 'Reload does not open the locked final');
    assert.equal(await page.locator('#score-total').textContent(), '5');
    assert.equal(await page.locator('#score-today').textContent(), '1');
    await page.locator('#show-journal').click();
    assert.equal(await page.locator('.journal-list li').count(), 70);
    assert.equal(await page.locator('.journal-list li[data-type=score]').count(), 5);
    assert.match(await page.locator('.journal-list li[data-type=score]').first().textContent(), /1 km löpning.*1 poäng/);
    await page.locator('[data-close=detail-dialog]').click();
    await page.locator('.test-tools summary').click();
    await page.locator('#test-day').selectOption('2026-10-30');
    assert.equal(await page.locator('#meet-boss').isDisabled(), true);
    await page.locator('[data-exercise=pushups]').click();
    assert.equal(await page.locator('#score-total').textContent(), '6', 'Points are earned before the final day');
    await page.locator('#exercise-panel').screenshot({ path: directory + '/waiting-final-390.png' });
    assert(!requests.some(url => url.endsWith('/hangover-baron.m4a') || url.endsWith('/final-fanfare.m4a')), 'The locked final never loads its narration or fanfare');
    await page.locator('#test-day').selectOption('2026-10-31');
    assert.equal(await page.locator('#meet-boss').isDisabled(), false);
    assert.equal(await page.locator('#quick-gate').isDisabled(), false);
    assert.equal(await page.locator('#score-today').textContent(), '0');
    assert.equal(await page.locator('#score-total').textContent(), '6');
    await page.locator('#meet-boss').click();
    assert.equal(await page.locator('#boss-dialog-title').textContent(), 'Bakrusbaronen');
    assert.equal(await page.locator('#challenge-panel').getAttribute('data-challenge'), 'victory-jump');
    await page.screenshot({ path: directory + '/final-open-390.png' });
    await playBossAudio('hangover-baron');
    await page.keyboard.press('Escape');
    await audioStopped();
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => !node.disabled)), 'The final does not block scoring on October 31');
    await page.locator('#quick-gate').click();
    await fanfareStopped();
    await page.locator('#defeat-boss').click();
    await fanfarePlaying();
    await audioStopped();
    assert.equal(await page.locator('#boss-dialog').getAttribute('data-mode'), 'finale');
    assert.match(await page.locator('#boss-dialog-title').textContent(), /31 dagar.*Du gjorde det/);
    assert.match(await page.locator('.finale-copy').textContent(), /klarat Sober Oktober/);
    assert.deepEqual(await page.locator('.finale-rider svg path').evaluateAll(paths => paths.map(p => p.getAttribute('d'))), await page.locator('#hero-rider svg path').evaluateAll(paths => paths.map(p => p.getAttribute('d'))), 'Finale uses the chosen rider');
    assert.equal(await page.locator('#finale-confetti').getAttribute('data-motion'), 'still', 'Reduced motion has a static celebration');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
      assert(await page.locator('#boss-dialog').evaluate(dialog => {
        const box = dialog.getBoundingClientRect();
        return Math.abs(box.top) < 1 && Math.abs(box.left) < 1 && Math.abs(box.width - innerWidth) < 1 && Math.abs(box.height - innerHeight) < 1 && dialog.scrollWidth <= dialog.clientWidth;
      }), 'Celebration fills the viewport without overflow at ' + width);
      assert(await page.locator('#finale-sound,#continue-journey,#finale-replay').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44)));
      await page.screenshot({ path: directory + '/month-finale-' + width + '.png' });
    }
    await page.locator('#finale-sound').click();
    await fanfareStopped();
    await page.locator('#finale-sound').focus(); await page.keyboard.press('Enter');
    await fanfarePlaying();
    await page.locator('#finale-audio').evaluate(audio => { audio.currentTime = audio.duration - .1; });
    await page.waitForFunction(() => document.getElementById('finale-sound-status').textContent.includes('Vilken månad'));
    await fanfareStopped();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#finale-replay').click();
    await fanfarePlaying();
    await page.waitForFunction(() => Number(document.getElementById('finale-confetti').dataset.particles) >= 900);
    assert.equal(await page.locator('#finale-confetti').getAttribute('data-motion'), 'celebrating');
    assert(await page.locator('#finale-confetti').evaluate(canvas => {
      const bytes = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      for (let n=3;n<bytes.length;n+=4) if (bytes[n]) return true;
      return false;
    }), 'Animated confetti is drawn in the modal top layer');
    await page.screenshot({ path: directory + '/month-finale-confetti-1440.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => Number(document.getElementById('finale-confetti').dataset.particles) <= 1000);
    await page.screenshot({ path: directory + '/month-finale-confetti-390.png' });
    await page.evaluate(() => { window.lastFinalCanvas = document.getElementById('finale-confetti'); });
    await page.keyboard.press('Escape');
    await fanfareStopped();
    assert.equal(await page.evaluate(() => lastFinalCanvas.dataset.motion), 'stopped', 'Closing cancels the animation');
    assert.equal(await page.evaluate(() => lastFinalCanvas.dataset.particles), '0');
    assert.equal(await page.locator('#score-total').textContent(), '6', 'Closing the celebration retains points');
    await page.route('**/adventure/audio/final-fanfare.m4a', route => route.abort());
    await page.locator('#see-finish').click();
    await page.waitForFunction(() => document.getElementById('finale-sound-status').textContent.includes('kunde inte spelas') || document.getElementById('finale-sound-status').textContent.includes('för att starta'));
    await fanfareStopped();
    assert.equal(await page.locator('#continue-journey').isEnabled(), true, 'A blocked fanfare never traps the winner');
    await page.unroute('**/adventure/audio/final-fanfare.m4a');
    await page.locator('#finale-sound').click();
    await fanfarePlaying();
    await page.locator('[data-close=boss-dialog]').click();
    await fanfareStopped();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#see-finish').click();
    await fanfarePlaying();
    assert.equal(await page.locator('#score-total').textContent(), '6', 'The final does not add or remove points');
    assert.match(await page.locator('#continue-journey').textContent(), /Tillbaka till poängjakten/);
    await page.locator('#continue-journey').click();
    await fanfareStopped();
    assert.equal(await defeatedBossesLabel(), '6 av 6');
    await page.locator('[data-exercise=running]').click();
    assert.equal(await page.locator('#score-total').textContent(), '7');
    await page.reload();
    assert.equal(await page.locator('#score-total').textContent(), '7');
    assert.equal(await page.locator('#score-today').textContent(), '1');
    await fanfareStopped();
    assert.equal(await page.locator('.finale-shell').count(), 0, 'Reload never replays the celebration automatically');
    await page.locator('#undo-last').click();
    assert.equal(await page.locator('#score-total').textContent(), '6');
    await page.locator('#undo-last').click();
    assert.equal(await defeatedBossesLabel(), '5 av 6');
    assert.equal(await page.locator('#score-summary').isVisible(), true);
    assert.equal(await page.locator('#score-total').textContent(), '6');
    assert(await page.locator('.exercise-button').evaluateAll(nodes => nodes.every(node => !node.disabled)), 'Undoing the final leaves scoring open');
    for (let point = 0; point < 6; point++) await page.locator('#undo-last').click();
    assert.equal(await page.locator('#score-total').textContent(), '0');
    await page.locator('#undo-last').click();
    assert.equal(await positionLabel(), 'Ruta 59');
    assert.equal(await page.locator('#score-summary').isVisible(), false, 'Undoing arrival relocks scoring');
    assert.equal(await page.locator('[data-exercise=running] strong').textContent(), 'Löpning 1 km');
    await page.locator('[data-exercise=running]').click();
    await page.locator('#arrival-meet-final').waitFor({ state: 'visible' });
    await page.locator('#arrival-meet-final').click();
    assert.equal(await page.locator('#boss-dialog-title').textContent(), 'Bakrusbaronen');
    await page.locator('#defeat-boss').click();
    await page.locator('#continue-journey').click();
    assert.equal(await page.locator('#score-total').textContent(), '0');
    if (!await page.locator('.test-tools').evaluate(node => node.open)) await page.locator('.test-tools summary').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#reset-game').click();
    assert.equal(await positionLabel(), 'Start');
    assert.equal(await page.locator('#score-summary').isVisible(), false);
    assert.equal(await page.locator('[data-exercise=running] strong').textContent(), 'Löpning 1 km');
    await page.locator('[data-exercise=squats]').focus(); await page.keyboard.press('Enter');
    assert.equal(await positionLabel(), 'Ruta 1');
    await page.evaluate(() => localStorage.setItem('soberoktober:final-adventure:v1', '{broken'));
    await page.reload();
    assert.equal(await positionLabel(), 'Start');
    assert.match(await page.locator('#storage-status').textContent(), /skadad/);
    assert(requests.every(url => url.startsWith(origin)), 'Only local game assets and explicitly requested boss audio; no external API');
    assert.deepEqual(errors, []);
    console.log('PASS final adventure: four screen widths, six unique mounts, crowded tiles, all 60 steps/six bosses, five normal gates, castle arrival scoring, October 30/31 final lock on map/logic/reload, final-day victory, scoring units/daily totals/tab sync/undo, journal, keyboard, corrupt state, six opt-in boss recordings, real audio decoding, play/stop/replay/end/close/victory/error retry, local byte ranges, full-screen 31-day celebration, real fanfare/stop/replay/error, dense animated and reduced-motion confetti, animation cleanup, no external API.');
  } finally {
    await browser?.close(); child?.kill('SIGTERM');
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
