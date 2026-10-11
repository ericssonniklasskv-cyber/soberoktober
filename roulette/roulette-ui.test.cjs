const { chromium } = require('playwright');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { browserOptions } = require('../qa/browser.cjs');
const R = require('./roulette-logic.js');
(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      let file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (file.endsWith('/')) file += 'index.html';
      const target = path.resolve(root, '.' + file);
      if (!target.startsWith(root + path.sep)) throw Error('Bad path');
      let content = await fs.readFile(target);
      if (file.endsWith('.html')) {
        // Exercise the actual home markup and CSS; isolate the component from competition APIs.
        content = content.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, tag =>
          /src="(?:https:\/\/cdn\.jsdelivr\.net|\/roulette\/|\/shared\/calendar\.js)/.test(tag) ? tag : '');
        content = content.replace('</body>', '<script src="/fixture-home.js" defer></script></body>');
      }
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...browserOptions() });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    let signedIn = true, userId = 'fixture-admin', configUrl = 'http://127.0.0.1:54321';
    const errors = [], queries = [], requests = [];
    await context.exposeFunction('fixtureProfile', () => { queries.push('profiles read'); return { data: { display_name: 'Testdeltagare' }, error: null }; });
    await context.exposeFunction('fixtureSession', () => ({ data: { session: signedIn ? { user: { id: userId } } : null }, error: null }));
    await context.exposeFunction('verifyClientOptions', options => { assert.equal(options.auth.persistSession, true); assert.equal(options.auth.autoRefreshToken, true); });
    await context.route('**/api/config', route => route.fulfill({ json: { supabaseUrl: configUrl, supabasePublishableKey: 'fixture-only' } }));
    await context.route('**/fixture-home.js', route => route.fulfill({ contentType: 'application/javascript', body: `
      document.querySelector('#entry-gate').hidden=true;
      document.body.classList.remove('entry-active');
      document.querySelector('#app-shell').removeAttribute('inert');
      document.querySelector('#app-shell').removeAttribute('aria-hidden');
      document.querySelector('#auth-trigger').disabled=false;
      fetch('/api/config').then(r=>r.json()).then(config=>window.SoberRouletteUI.init(
        window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}}),config));` }));
    await context.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'application/javascript', body: `window.supabase={createClient:(url,key,options)=>{window.verifyClientOptions(options);return {auth:{getSession:()=>window.fixtureSession(),onAuthStateChange:(cb)=>{window.fixtureAuthChange=cb;return {data:{subscription:{unsubscribe(){}}}}}},from:(table)=>{if(table!=='profiles')throw Error('Unexpected table '+table);return {select:(fields)=>{if(fields!=='display_name')throw Error('Unexpected profile fields');return {eq:()=>({maybeSingle:()=>window.fixtureProfile()})}}}},rpc:()=>{throw Error('Prototype must never call an RPC')}}}};` }));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('503')) errors.push(msg.text()); });
    context.on('request', request => { requests.push(request.url()); if (request.method() !== 'GET') errors.push('Unexpected write request'); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const url = origin + '/';
    const screenshots = await fs.mkdtemp('/private/tmp/roulette-home-check-');
    const getState = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), 'soberoktober:roulette-test:v4:2026-10-12:' + userId);

    const card = slot => page.locator('.workout-piece').filter({ has: page.locator('[data-reroll="'+slot+'"]') });
    async function edit(slot) {
      const details=card(slot).locator('.workout-edit');
      if(!await details.evaluate(el=>el.open))await details.locator('summary').click();
    }
    async function detailsResult() {
      await page.locator('#wheel-winner').waitFor({state:'visible'});
      assert.equal(await page.locator('#result-card').isVisible(),false,'Winner waits for an explicit click');
      const before=await getState(),day=before.days[before.date],title=await page.locator('#winner-title').innerText();
      assert(R.taskIds(day).some(id=>R.getTask(id).title===title));
      assert(await page.locator('#winner-title').evaluate(el=>el===document.activeElement));
      await page.locator('#continue-result').click();await page.locator('#result-card').waitFor({state:'visible'});
      assert.deepEqual(await getState(),before,'Viewing the result changes no points or credit');
    }
    async function draw(category) {
      await page.locator('button[data-category="'+category+'"]').click();
      assert(await page.locator('#category-intro').isVisible(),'Category humor has its own screen before the wheel');
      assert.equal(await page.locator('#wheel-step').isVisible(),false,'Wheel stays hidden during the comment');
      assert(await page.locator('#category-intro-message').evaluate(el=>el===document.activeElement));
      const comments={strength:'ooh, big man? Big muscles?',cardio:'Lean och jävligt snärt, sånt gillar vi',mobility:'Aha.... Du valde rörlighet? Var handlar du dina trosor?'};
      assert.equal(await page.locator('#category-intro-message').innerText(),comments[category]);
      await page.locator('#spin-button').waitFor({state:'visible'});
      assert.equal(await page.locator('#category-intro').isVisible(),false,'Intro ends before the wheel appears');
      assert(await page.locator('#spin-button').evaluate(el=>el===document.activeElement));
      assert.equal(await page.locator('#wheel-segments path').count(),R.TASKS[category].length);
      if(category==='mobility')assert.deepEqual(await page.locator('#wheel-segments .wheel-label').allTextContents(),['10 min','20 min','30 min']);
      await page.locator('#spin-button').click();await detailsResult();
    }
    async function allChecks() {
      const inputs=page.locator('[data-check-step]');
      for(let i=0;i<await inputs.count();i++)await inputs.nth(i).check();
    }
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});await page.goto(url);await page.locator('#training-roulette').waitFor({state:'visible'});
      assert(await page.locator('.hero-stage').isVisible());assert(await page.locator('.activity-preview').isVisible());
      assert.equal(await page.locator('#roulette-dialog').isVisible(),false);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.locator('#open-roulette').click();
      assert.equal(await page.locator('.category-option').count(),3);
      assert.equal(await page.locator('.category-cost').first().innerText(),'Gratis');
      assert.equal(await page.locator('#roulette-dialog').evaluate(el=>el.getAnimations({subtree:true}).length),0,'No fades');
      assert(await page.locator('#roulette-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
      await page.screenshot({path:path.join(screenshots,'choice-'+width+'.png')});
      await page.locator('button[data-category="strength"]').click();
      assert(await page.locator('#category-intro').isVisible());
      assert.equal(await page.locator('#wheel-step').isVisible(),false);
      assert(await page.locator('#roulette-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
      assert.equal(await page.locator('#roulette-dialog').evaluate(el=>el.getAnimations({subtree:true}).length),0);
      await page.screenshot({path:path.join(screenshots,'intro-'+width+'.png')});
      await page.keyboard.press('Escape');assert(await page.locator('#open-roulette').evaluate(el=>el===document.activeElement));
    }
    await page.locator('#open-roulette').click();
    await page.waitForTimeout(3400);assert(await page.locator('#category-step').isVisible(),'Closing the intro cancels its delayed transition');
    await page.locator('button[data-category="strength"]').click();
    await page.locator('#back-to-categories').click();
    await page.waitForTimeout(3400);assert(await page.locator('#category-step').isVisible(),'Back cancels the intro transition');
    assert.deepEqual((await getState()).days,{});assert.equal(R.remaining(await getState()),5);
    await draw('strength');
    let day=(await getState()).days['2026-10-12'];const firstId=day.taskId;
    assert.equal(await page.locator('.workout-piece').count(),1);
    assert.equal(await page.locator('.workout-details').evaluate(el=>el.open),false,'Instructions start compact');
    assert.equal(await page.locator('.workout-edit').evaluate(el=>el.open),false,'Editing is secondary');
    assert((await page.locator('#round-meta').innerText()).includes('1 pass'));
    await page.locator('.workout-details summary').click();assert(await page.locator('.result-instructions').isVisible());
    await page.locator('#show-checklist').click();assert.equal(await page.locator('.checklist-workout').count(),1);
    const inputs=page.locator('[data-check-step]');await inputs.first().focus();await page.keyboard.press('Space');
    assert(await inputs.first().isChecked());assert(await inputs.first().evaluate(el=>el===document.activeElement));
    assert.equal(R.summary(await getState()).total,0);
    assert((await page.locator('#roulette-invite').innerText()).includes('1 av'));
    await page.locator('#close-roulette').click();await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();
    assert(await page.locator('#checklist-view').isVisible(),'Opening resumes started training');assert(await inputs.first().isChecked());
    const other=await context.newPage();await other.goto(url);await other.locator('#training-roulette').waitFor({state:'visible'});await other.locator('#open-roulette').click();
    assert(await other.locator('[data-check-step]').first().isChecked());
    await inputs.first().uncheck();await other.waitForFunction(()=>!document.querySelector('[data-check-step]').checked);await inputs.first().check();await other.waitForFunction(()=>document.querySelector('[data-check-step]').checked);await other.close();
    await page.locator('#back-from-checklist').click();assert(await page.locator('#show-checklist').evaluate(el=>el===document.activeElement));
    await page.locator('#combine-button').click();await draw('cardio');
    assert.equal(await page.locator('.workout-piece').count(),2);
    await page.locator('#show-checklist').click();assert.equal(await page.locator('.checklist-workout').count(),2);assert(await inputs.first().isChecked());
    await page.locator('#back-from-checklist').click();await page.locator('#combine-button').click();await draw('mobility');
    day=(await getState()).days['2026-10-12'];assert.equal(R.taskIds(day).length,3);assert.equal(R.remaining(await getState()),5);
    assert.equal(await page.locator('#combine-button').isVisible(),false);
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});await page.waitForTimeout(250);
      await page.screenshot({path:path.join(screenshots,'overview-'+width+'.png')});
      assert(await page.locator('#roulette-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
    }
    await page.locator('#show-checklist').click();
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});await page.waitForTimeout(250);
      await page.locator('#roulette-dialog').evaluate(el=>el.scrollTop=el.scrollHeight);
      assert(await page.locator('#close-roulette').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight;}),'Close is available during scroll');
      assert(await page.locator('#back-from-checklist').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight;}));
      assert(await page.locator('#checklist-complete').evaluate(el=>{const r=el.getBoundingClientRect();const d=document.querySelector('#roulette-dialog').getBoundingClientRect();return r.top>=0&&r.bottom<=d.bottom-2;}),'Finish button remains inside the popup');
      assert.equal(await inputs.first().evaluate(el=>getComputedStyle(el.closest('label').querySelector('.checklist-item-copy')).fontSize),'16px');
      await page.locator('#roulette-dialog').evaluate(el=>el.scrollTop=0);
      await page.screenshot({path:path.join(screenshots,'checklist-'+width+'.png')});
    }
    await allChecks();assert.equal(R.summary(await getState()).total,0,'Checking all steps does not award points');
    const earned=R.plannedPoints(day);await page.locator('#checklist-complete').click();
    assert(await page.locator('#completed-view').isVisible());assert.equal(R.summary(await getState()).total,earned);
    assert((await page.locator('#completed-points').innerText()).includes(String(earned)));
    await page.screenshot({path:path.join(screenshots,'completed-1440.png')});
    await page.locator('#review-round').click();assert(await inputs.first().isDisabled(),'Completed checklist is read-only');
    await page.locator('#back-from-checklist').click();assert(await page.locator('#completed-view').isVisible());
    await page.locator('#undo-completion').click();assert.equal(R.summary(await getState()).total,0);assert(await inputs.first().isChecked());
    await inputs.first().uncheck();assert.equal(R.checklistSummary((await getState()).days['2026-10-12']).done,R.checklistItems(day).length-1);
    await inputs.first().check();await page.locator('#checklist-complete').click();await page.locator('#completed-home').click();
    await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();assert(await page.locator('#completed-view').isVisible());
    assert.equal(await page.locator('#new-round-button').isVisible(),false,'Three combined workouts close the day');
    const closedDay=await getState();await page.locator('#new-round-button').evaluate(el=>el.click());assert.deepEqual(await getState(),closedDay,'Even a programmatic click cannot bypass the cap');
    userId='fixture-daily-budget';const oneComplete=R.toggleCompleted(R.spin(R.fresh(),0)),previouslyEarned=R.summary(oneComplete).total;
    await page.evaluate(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:'soberoktober:roulette-test:v4:2026-10-12:'+userId,data:oneComplete});
    await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();
    assert(await page.locator('#new-round-button').isVisible());assert((await page.locator('#completed-limit').innerText()).includes('1 av 3'));
    await page.locator('#review-round').click();assert.equal(await page.locator('input:checked').count(),0,'Completing a workout does not fill the optional checklist');
    await page.locator('#back-from-checklist').click();
    await page.locator('#new-round-button').click();await page.locator('#return-result').click();assert(await page.locator('#completed-title').evaluate(el=>el===document.activeElement));await page.locator('#new-round-button').click();assert.equal(R.summary(await getState()).total,previouslyEarned);
    assert.equal(await page.locator('[data-category="strength"] .category-cost').innerText(),'1 frispinn');
    await draw('mobility');assert.equal(R.summary(await getState()).total,previouslyEarned);assert.equal(await page.locator('.workout-piece').count(),1);
    assert.equal((await getState()).days['2026-10-12'].trainingStarted,false);
    for(let i=0;i<5;i++){
      await edit('primary');await page.locator('[data-reroll="primary"]').click();
      assert.equal(R.remaining(await getState()),5-i,'Opening reroll does not spend credit');
      assert.equal(await page.locator('#spin-button').innerText(),'Snurra igen · 1 frispinn');
      await page.locator('#spin-button').click();await detailsResult();assert.equal(R.remaining(await getState()),4-i);
      assert.equal(R.summary(await getState()).total,previouslyEarned);
    }
    await edit('primary');assert(await page.locator('[data-reroll="primary"]').isDisabled());
    await page.locator('[data-change-category="primary"]').click();assert(await page.locator('[data-category="mobility"]').isDisabled());
    assert.equal(await page.locator('[data-category="cardio"] .category-cost').innerText(),'Gratis');await draw('cardio');assert.equal(R.remaining(await getState()),0);
    await page.locator('#combine-button').click();await draw('strength');assert.equal(R.remaining(await getState()),0,'New extra category can still be free');
    await edit('extra:0');await page.locator('[data-remove-extra="extra:0"]').click();assert.equal(await page.locator('.workout-piece').count(),1);
    await page.locator('#combine-button').click();await draw('cardio');assert.equal(await page.locator('#combine-button').isVisible(),false,'Only two workouts fit after one already completed');
    await page.locator('#show-checklist').click();assert(await page.locator('#checklist-complete').isEnabled());assert.equal(await page.locator('input:checked').count(),0);
    await page.locator('#checklist-complete').click();assert.equal(R.completedWorkouts((await getState()).days['2026-10-12']),3);
    assert.equal(await page.locator('#new-round-button').isVisible(),false);assert((await page.locator('#completed-limit').innerText()).includes('3 av 3'));
    await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();assert.equal(await page.locator('#new-round-button').isVisible(),false);
    await page.locator('.roulette-test-tools summary').click();await page.locator('[data-date="2026-10-13"]').click();await draw('strength');assert.equal(R.remaining(await getState()),0);
    page.once('dialog',d=>d.accept());await page.locator('#reset-test').click();assert.deepEqual((await getState()).days,{});assert.equal(R.remaining(await getState()),5);

    // The three-option mobility wheel cannot draw a fourth unique task or spend credit on an impossible reroll.
    userId='fixture-three-mobility';
    const threeMobility=R.combine(R.combine(R.spin(R.chooseCategory(R.fresh(),'mobility'),0),'mobility',0),'mobility',0);
    await page.evaluate(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:'soberoktober:roulette-test:v4:2026-10-12:'+userId,data:threeMobility});
    await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();
    for(const slot of ['primary','extra:0','extra:1']){await edit(slot);assert(await page.locator('[data-reroll="'+slot+'"]').isDisabled());}
    await page.locator('[data-change-category="primary"]').click();
    assert(await page.locator('[data-category="mobility"]').isDisabled());assert.equal(await page.locator('[data-category="mobility"] .category-cost').innerText(),'Alla pass valda');
    assert.equal(R.remaining(await getState()),5);await page.screenshot({path:path.join(screenshots,'mobility-all-selected.png')});
    await draw('cardio');assert.equal(R.remaining(await getState()),5);
    await edit('extra:0');await page.locator('[data-reroll="extra:0"]').click();
    assert.equal(await page.locator('#wheel-segments path').count(),3);assert(await page.locator('#spin-button').isEnabled());
    await page.screenshot({path:path.join(screenshots,'mobility-three-segments.png')});
    await page.locator('#spin-button').click();await detailsResult();assert.equal(R.remaining(await getState()),4);
    await page.locator('#show-checklist').click();assert.equal(await page.locator('.checklist-workout').count(),3);
    assert.equal(await page.locator('.checklist-workout').filter({hasText:'Rörlighet'}).locator('[data-check-step]').count(),2);

    // A partially checked v2 workout retains its original content and rollback copy after updating v4.
    userId='fixture-v2';const v2Key='soberoktober:roulette-test:v2:2026-10-12:'+userId;
    const v2={version:2,date:'2026-10-12',category:'strength',days:{'2026-10-12':{taskId:'s1',rerolls:1,completed:false,trainingStarted:true,checkedSteps:['s1:0:0']}}};
    await page.evaluate(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:v2Key,data:v2});
    await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();
    assert(await page.locator('#checklist-view').isVisible());assert.equal(await page.locator('[data-check-step]').count(),3);
    assert.equal(await page.locator('input:checked').count(),1);assert((await page.locator('.checklist-item-copy').first().innerText()).includes('10 squats + 10 utfall totalt.'));
    await page.locator('[data-check-step]').nth(1).check();assert.equal((await getState()).version,4);
    assert.equal(R.remaining(await getState()),4);assert.equal(R.checklistSummary((await getState()).days['2026-10-12']).done,2);
    assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),v2Key),v2);

    // Legacy data is imported into v4 without rewriting the rollback copy.
    userId='fixture-legacy';const oldKey='soberoktober:roulette-test:v1:2026-10-12:'+userId;
    const legacy={version:1,date:'2026-10-12',category:'cardio',days:{'2026-10-12':{taskId:'c4',rerolls:2,completed:true,checkedSteps:['c4:0','c4:1']}}};
    await page.evaluate(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:oldKey,data:legacy});
    await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();assert(await page.locator('#completed-view').isVisible());
    await page.locator('#review-round').click();assert.equal(await page.locator('[data-check-step]').count(),8);assert.equal(await page.locator('input:checked').count(),8);
    await page.locator('#back-from-checklist').click();await page.locator('#undo-completion').click();
    assert.equal((await getState()).version,4);assert.equal(R.remaining(await getState()),3);
    assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),oldKey),legacy,'v1 remains intact for rollback');

    // Storage failures cannot silently consume a spin or change a checkbox.
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('fixture storage full');};});
    await page.locator('[data-check-step]').first().locator('..').click();assert(await page.locator('[data-check-step]').first().isChecked());assert((await page.locator('#checklist-feedback').innerText()).includes('kunde inte sparas'));
    await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);

    // Original jokes and flashes remain automatic with normal motion.
    userId='fixture-animated';await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();
    await page.evaluate(()=>{window.flashes=[];new MutationObserver(records=>records.forEach(({target})=>{if(!target.hidden)window.flashes.push(target.textContent);})).observe(document.querySelector('#spin-flash'),{attributes:true,attributeFilter:['hidden']});});
    await page.locator('[data-category="strength"]').click();await page.locator('#spin-button').click();
    assert(await page.locator('#spin-button').isDisabled());await page.locator('#close-roulette').click();await page.locator('#open-roulette').click();assert.equal(await page.locator('.workout-piece').count(),1,'Closing a spin retains the draw');
    await edit('primary');await page.locator('[data-reroll="primary"]').click();await page.locator('#spin-button').click();
    await page.evaluate(()=>window.fixtureAuthChange('SIGNED_OUT',null));await page.waitForFunction(()=>!document.querySelector('#roulette-dialog').open);await page.waitForTimeout(2300);
    assert.equal(await page.locator('#roulette-dialog').isVisible(),false);await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();assert.equal(await page.locator('#free-spin-count').innerText(),'4/5');
    await edit('primary');await page.locator('[data-reroll="primary"]').click();await page.locator('#spin-button').click();await page.locator('#back-to-categories').click();await page.waitForTimeout(2300);assert(await page.locator('#category-step').isVisible());assert.equal(R.remaining(await getState()),3);
    await draw('cardio');assert.equal(await page.locator('#winner-flash').isVisible(),false);assert.equal(await page.locator('#roulette-dialog').evaluate(el=>el.getAnimations({subtree:true}).length),0);
    userId='fixture-other';await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();assert(await page.locator('#category-step').isVisible());assert.equal(await page.locator('#free-spin-count').innerText(),'5/5');
    signedIn=false;await page.reload();await page.locator('#training-roulette').waitFor({state:'visible'});await page.locator('#open-roulette').click();await page.locator('#signed-out-state').waitFor({state:'visible'});
    await page.evaluate(()=>document.querySelector('#auth-trigger').addEventListener('click',()=>window.fixtureLoginRequested=true));
    await page.locator('#roulette-login').click();
    assert.equal(await page.evaluate(()=>window.fixtureLoginRequested),true,'Roulette uses the normal login');
    assert.equal(await page.locator('#roulette-dialog').isVisible(),false);
    configUrl='https://production-fixture.invalid';await page.reload();await page.waitForLoadState('networkidle');assert.equal(await page.locator('#training-roulette').isVisible(),false);
    assert(!requests.some(url=>url.includes('/rest/v1/')||url.includes('/rpc/')));assert.deepEqual(errors,[]);
    console.log('PASS: compact overview; 1–3 workout checklist; resume, keyboard, two-tab sync; sticky mobile navigation/actions and 320/390/768/1440 layouts; interval migration and rollback-safe v1/v2/v3/v4; daily three-workout cap and optional checklists; three mobility segments and exhausted-pool blocking; separate completion/undo/new round; cost previews and five shared spins; separate automatic category intro, canceled intro transitions, original automatic humor, animation cancellation, account isolation and local-only activation. Screenshots: '+screenshots);
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
