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
    const root = path.resolve(__dirname, '..'), probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    child = spawn(process.execPath, ['scripts/dev-adventure.mjs'], { cwd: root, env: {...process.env,ADVENTURE_PORT:String(port)}, stdio:['ignore','pipe','pipe'] });
    await new Promise((resolve,reject) => { child.stdout.once('data',resolve); child.once('error',reject); });
    const origin = 'http://127.0.0.1:' + port;
    browser = await chromium.launch({headless:true,...browserOptions(),args:['--mute-audio']});
    const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const page = await context.newPage(), errors=[], requests=[];
    page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>requests.push(r.url()));
    const directory='/private/tmp/adventure-preview'; await fs.mkdir(directory,{recursive:true});
    const tools=async()=>{if(!await page.locator('.test-tools').evaluate(n=>n.open))await page.locator('.test-tools summary').click();};
    const ownPoints=async()=>Number(await page.locator('.home-rank-row[data-own=true]').getAttribute('data-points'));
    await page.goto(origin);
    assert.equal(await page.locator('.home-nav a').count(),3);
    assert.equal(await page.locator('.home-rank-row').count(),6);
    assert.equal(await page.locator('.home-activity-row').count(),5);
    assert.equal(await page.locator('#home-admin').isHidden(),true);
    assert.equal(await page.locator('#pawn-welcome-dialog').isVisible(),false,'No personal popup for a standard participant');
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Homepage fits '+width);
      await page.screenshot({path:directory+'/homepage-'+width+'.png',fullPage:true});
    }
    await page.locator('[data-home-scope=week]').click();
    assert.equal(await ownPoints(),0);
    await page.locator('[data-exercise=running]').click();
    assert.equal(await ownPoints(),0,'Journey exercise is not a leaderboard point');
    assert.match(await page.locator('.home-activity-row[data-own=true]').first().textContent(),/1 km löpning.*0 poäng/);
    await page.locator('.home-bonus summary').click(); await page.locator('#home-bonus-toggle').click();
    assert.equal(await ownPoints(),1);
    assert.match(await page.locator('.home-activity-row').first().textContent(),/dagens bonus/);
    await page.locator('[data-exercise=pushups]').click();
    assert.match(await page.locator('.home-activity-row').first().textContent(),/gick fram en ruta/,'New game events follow the bonus chronologically');
    await page.locator('#undo-last').click(); await page.locator('#home-bonus-toggle').click();
    assert.equal(await ownPoints(),0);
    assert.equal(await page.locator('.home-activity-row[data-type=bonus]').count(),0);
    await page.evaluate(()=>{const b=document.getElementById('home-admin');b.hidden=false;b.disabled=false;b.click();});
    assert.equal(await page.locator('#detail-dialog').isVisible(),false,'Forced participant admin click is rejected');
    await tools(); await page.locator('#test-role').selectOption('admin');
    assert.equal(await page.locator('#home-admin').isVisible(),true);
    await page.locator('#home-admin').click();
    await page.locator('#home-admin-bonus').fill('Testbonus: peppa en vän <strong>i gruppen</strong>.');
    await page.locator('#home-bonus-form button[type=submit]').click();
    assert.match(await page.locator('#home-admin-status').textContent(),/Sparat/);
    await page.locator('[data-close=detail-dialog]').click();
    assert.equal(await page.locator('#home-bonus-description').textContent(),'Testbonus: peppa en vän <strong>i gruppen</strong>.');
    assert.equal(await page.locator('#home-bonus-description strong').count(),0,'Admin text is rendered as text');
    await page.locator('#test-role').selectOption('participant');
    assert.equal(await page.locator('#home-admin').isHidden(),true);
    await page.locator('#test-participant').selectOption('mikeb');
    await page.locator('#pawn-welcome-dialog').waitFor({state:'visible'});
    assert.match(await page.locator('#pawn-welcome-title').textContent(),/MikeB/);
    assert.match(await page.locator('#pawn-welcome-image').getAttribute('src'),/mikeb\.webp/);
    await page.waitForFunction(()=>document.getElementById('pawn-welcome-image').naturalWidth>0);
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:width<400?844:1000});
      assert(await page.locator('#pawn-welcome-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth),'Personal welcome fits '+width);
      assert(await page.locator('#pawn-welcome-image').evaluate(i=>i.getBoundingClientRect().width>=190));
      await page.screenshot({path:directory+'/pawn-welcome-'+width+'.png'});
    }
    await page.locator('#pawn-welcome-go').click(); await page.reload();
    assert.equal(await page.locator('#pawn-welcome-dialog').isVisible(),false,'Reload does not repeat a seen welcome');
    for(const id of ['jerka','elliott-da-bomb','nillebae']){
      await tools();await page.locator('#test-participant').selectOption(id);
      await page.locator('#pawn-welcome-dialog').waitFor({state:'visible'});
      assert.match(await page.locator('#pawn-welcome-image').getAttribute('src'),new RegExp(id+'\\.webp'));
      if(id==='jerka')await page.locator('[data-close=pawn-welcome-dialog]').click();
      else if(id==='elliott-da-bomb')await page.keyboard.press('Escape');
      else await page.locator('#pawn-welcome-go').click();
    }
    await page.locator('#home-account').click(); await page.locator('#home-account-pawn').click();
    await page.locator('#pawn-welcome-dialog').waitFor({state:'visible'});
    assert.match(await page.locator('#pawn-welcome-title').textContent(),/Nillebae/,'Account can replay the presentation');
    await page.locator('#pawn-welcome-go').click();
    await tools(); await page.locator('#test-role').selectOption('admin');
    await page.setViewportSize({width:320,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Admin header also fits mobile');
    await page.screenshot({path:directory+'/homepage-admin-320.png',fullPage:true});
    await page.locator('#test-role').selectOption('participant');
    await page.evaluate(()=>{
      const G=SoberAdventure;let state=G.createState();
      for(let n=0;n<6;n++)state=G.record(state,'squats','2026-10-26');
      localStorage.setItem('soberoktober:final-adventure:v1',JSON.stringify(state));
      localStorage.setItem('soberoktober:final-adventure-prefs:v1',JSON.stringify({participantId:'zellmani',mountIndex:0,testDay:'2026-10-26'}));
    });
    await page.reload();await page.locator('#pawn-welcome-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#boss-dialog').isVisible(),false,'Pawn introduction takes priority over an automatic boss');
    await page.locator('#pawn-welcome-go').click();await page.locator('#boss-dialog').waitFor({state:'visible'});
    assert.match(await page.locator('#boss-dialog-title').textContent(),/Öl-Orcen/);
    assert(await page.locator('.exercise-button').evaluateAll(buttons=>buttons.every(b=>b.disabled)),'Introduction never bypasses the boss gate');
    await page.locator('#defeat-boss').click(); await page.locator('#continue-journey').click();
    await page.evaluate(()=>{
      const G=SoberAdventure;let state=G.createState();
      for(let n=1;n<=G.BOARD_SIZE;n++){state=G.record(state,'squats','2026-10-26');const boss=G.progress(state).pendingBoss;if(boss&&n<G.BOARD_SIZE)state=G.resolveBoss(state,boss.id,boss.choices[0].id,'2026-10-26');}
      localStorage.setItem('soberoktober:final-adventure:v1',JSON.stringify(state));
    });
    await page.reload();assert.equal(await page.locator('#pawn-welcome-dialog').isVisible(),false);
    await page.locator('[data-exercise=running]').click();
    assert.equal(await ownPoints(),1,'Actual post-castle points reach the week leaderboard');
    assert.match(await page.locator('.home-activity-row').first().textContent(),/samlade 1 poäng/);
    await page.locator('#undo-last').click();assert.equal(await ownPoints(),0);
    await page.locator('#home-rules').click();assert.match(await page.locator('#detail-content').textContent(),/1 km löpning/);
    await page.keyboard.press('Escape');
    assert(requests.every(url=>url.startsWith(origin)));assert.deepEqual(errors,[]);
    console.log('PASS homepage and welcome: three sections, four screen sizes, admin role/guard/local bonus, live demo ranking/feed and undo, five personal introductions once per browser, manual replay, welcome-before-boss sequencing, actual score phase, no external requests.');
  }finally{await browser?.close();child?.kill('SIGTERM');}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
