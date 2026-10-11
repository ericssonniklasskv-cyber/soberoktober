const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { browserOptions } = require('./browser.cjs');
const root = path.resolve(__dirname, '..');
(async () => {
  if (!process.env.SOBER_LOCAL_ENV_MODULE) throw Error('Explicit local stack adapter required');
  const { localEnvironment, getLocalStack, runLocalSql, localRequest } = await import(pathToFileURL(process.env.SOBER_LOCAL_ENV_MODULE).href);
  const env = localEnvironment(), stack = getLocalStack(env, {start:false});
  const sdk = await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js').then(r => r.text());
  const headers = {apikey:stack.publishable,'Content-Type':'application/json'};
  const admin = {...headers,Authorization:'Bearer '+stack.serviceRole};
  const users = [], errors = [];
  let server, browser, page;
  const rpc = (session,name,body={}) => localRequest(stack.api+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,Authorization:'Bearer '+session.access_token},body:JSON.stringify(body)});
  const clock = date => runLocalSql(`create or replace function private.roulette_clock() returns timestamptz language sql stable set search_path='' as $$select timestamptz '${date}';$$;`,env);
  try {
    clock('2026-10-12 12:00:00+02');
    for (const name of ['One','Two']) {
      const email = `roulette-e2e-${name.toLowerCase()}-${Date.now()}@example.invalid`, password = 'Local-Roulette-Test-2026!';
      const user = await localRequest(stack.api+'/auth/v1/admin/users',{method:'POST',headers:admin,body:JSON.stringify({email,password,email_confirm:true})});
      users.push({id:user.id});
      runLocalSql(`insert into public.profiles(id,email,display_name,auto_elimination_recheck_after) values ('${user.id}','${email}','Roulette E2E ${name}','2026-10-11');`,env);
      users.at(-1).session = await localRequest(stack.api+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password})});
    }
    const [one,two] = users;
    server = http.createServer(async(req,res) => {
      try {
        const pathname = new URL(req.url,'http://localhost').pathname;
        if (pathname==='/api/config') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({supabaseUrl:stack.api,supabasePublishableKey:stack.publishable,rouletteMode:'server'}));return;}
        const file = path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
        if (!file.startsWith(root+path.sep)||/\/(?:supabase|\.git)\//.test(file)) throw Error('Denied');
        res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');
        res.end(await fs.readFile(file));
      } catch {res.writeHead(404).end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({headless:true,...browserOptions()});
    const context=await browser.newContext({reducedMotion:'reduce'});
    await context.route('**/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
    await context.addInitScript(({session}) => {
      session.expires_at=Date.parse('2026-10-15T00:00:00+02:00')/1000;
      localStorage.setItem('sb-127-auth-token',JSON.stringify(session));
      localStorage.setItem('soberoktober-trump-quote-seen-date','2026-10-12');
    },{session:one.session});
    page=await context.newPage();
    await page.clock.install({time:new Date('2026-10-12T12:00:00+02:00')});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/');
    await page.locator('#training-roulette').waitFor({state:'visible'});
    await page.locator('#app-shell').waitFor({state:'visible'});
    assert.equal(await page.locator('#dagens-pass').isVisible(),false);
    assert.equal(await page.locator('#competition-bingo').isVisible(),false);
    assert.equal(await page.locator('.main-nav a[href="#training-roulette"]').textContent(),'Spinn The Wheel');
    await page.locator('#weekly-release-close').click();
    await page.locator('#open-roulette').click();
    async function draw(category) {
      await page.locator('[data-category="'+category+'"]').click();
      await page.locator('#spin-button').waitFor({state:'visible'});
      assert.equal(await page.locator('#wheel-segments path').count(),category==='mobility'?3:9);
      await page.locator('#spin-button').click();
      await page.locator('#wheel-winner').waitFor({state:'visible'});
      await page.locator('#continue-result').click();
    }
    await draw('strength');
    await page.locator('#show-checklist').click();
    const check=page.locator('[data-check-step]').first();await check.check();
    await page.locator('#checklist-complete').click();
    await page.locator('#completed-view').waitFor({state:'visible'});
    const first=await rpc(one.session,'my_training_roulette');
    assert.equal(first.state.days['2026-10-12'].checkedSteps.length,1);
    const other=await rpc(two.session,'my_training_roulette');assert.deepEqual(other.state.days,{});
    const scores=()=>localRequest(stack.api+'/rest/v1/roulette_daily_scores?select=*',{headers:{...headers,Authorization:'Bearer '+one.session.access_token}});
    assert.equal((await scores())[0].completed_workouts,1);
    await page.locator('#new-round-button').click();await draw('cardio');
    await page.locator('#combine-button').click();await draw('mobility');
    await page.locator('#show-checklist').click();
    await page.locator('#checklist-view').waitFor({state:'visible'});
    assert.equal(await page.locator('#checklist-workouts input:checked').count(),0);
    await page.locator('#checklist-complete').click();
    await page.locator('#completed-view').waitFor({state:'visible'});
    assert.equal((await scores())[0].completed_workouts,3);
    assert.equal(await page.locator('#new-round-button').isVisible(),false);
    assert(await page.locator('#undo-completion').isEnabled());
    await page.locator('#undo-completion').click();
    await page.locator('#checklist-view').waitFor({state:'visible'});
    assert.equal((await scores())[0].completed_workouts,1,'Undo preserves the earlier completed round');
    await page.locator('#checklist-complete').click();
    await page.locator('#completed-view').waitFor({state:'visible'});
    const final=await rpc(one.session,'my_training_roulette');
    await assert.rejects(()=>rpc(one.session,'my_training_roulette',{p_action:'draw',p_date:'2026-10-12',p_payload:{category:'strength',revision:final.revision}}),/dagens tre/);
    const leaderboard=await rpc(one.session,'get_leaderboard');
    assert.equal(Number(leaderboard.find(entry=>entry.display_name==='Roulette E2E One').total_points),(await scores())[0].points);
    const feed=await rpc(two.session,'get_kudos_activity_feed');assert(feed.some(item=>item.activity_type==='roulette_pass'&&item.display_name==='Roulette E2E One'));
    const publicFeed=await localRequest(stack.api+'/rest/v1/rpc/get_activity_feed',{method:'POST',headers,body:'{}'});
    assert(publicFeed.some(item=>item.activity_type==='roulette_pass'&&item.display_name==='Roulette E2E One'));
    await page.waitForFunction(()=>document.querySelector('#activity-preview-list').textContent.includes('Spinn The Wheel'));
    const shots=await fs.mkdtemp(path.join(tmpdir(), 'roulette-live-e2e-'));
    for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(shots,'completed-'+width+'.png')});}
    await page.reload();await page.locator('#weekly-release-close').click();await page.locator('#open-roulette').click();await page.locator('#completed-view').waitFor({state:'visible'});
    assert.equal(await page.locator('#new-round-button').isVisible(),false);
    // A fresh device reads the same saved state without copying localStorage.
    const second=await context.newPage();await second.clock.install({time:new Date('2026-10-12T12:00:00+02:00')});
    await second.goto(origin+'/min-oktober/');await second.locator('#history-state').waitFor({state:'visible'});
    assert((await second.locator('body').innerText()).includes('Spinn The Wheel'));
    await second.close();
    // Simultaneous callers share a single revision and cannot get two independent draws.
    const start=await rpc(two.session,'my_training_roulette');
    const concurrent=await Promise.allSettled([0,1].map(()=>rpc(two.session,'my_training_roulette',{p_action:'draw',p_date:'2026-10-12',p_payload:{category:'strength',revision:start.revision}})));
    assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1);
    clock('2026-10-13 12:00:00+02');
    const yesterday=await rpc(two.session,'my_training_roulette',{p_date:'2026-10-12'});
    await rpc(two.session,'my_training_roulette',{p_action:'complete',p_date:'2026-10-12',p_payload:{revision:yesterday.revision}});
    assert.equal((await rpc(two.session,'my_training_roulette')).state.days['2026-10-12'].completed,true);
    // A tab left open across the boundary switches automatically; the old workout never reappears.
    clock('2026-10-11 23:59:50+02');
    const boundary=await context.newPage();await boundary.clock.install({time:new Date('2026-10-11T23:59:50+02:00')});
    await boundary.goto(origin+'/');await boundary.locator('#competition-bingo').waitFor({state:'visible'});
    await boundary.clock.runFor(11000);
    assert.equal(await boundary.locator('#dagens-pass').isVisible(),false,'Old card stays hidden at midnight');
    assert.equal(await boundary.locator('#training-roulette').isVisible(),false,'Roulette waits until 00:01');
    clock('2026-10-12 00:01:01+02');await boundary.clock.runFor(61000);
    await boundary.locator('#training-roulette').waitFor({state:'visible'});
    assert.equal(await boundary.locator('#competition-bingo').isVisible(),false);
    assert.equal(await boundary.locator('#dagens-pass').isVisible(),false);
    await boundary.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: real local Auth → roulette RPC → server state → points/leaderboard/history/feed; 1+2 daily cap, optional checks, reload, responsive UI, account isolation, concurrent draw rejection, yesterday completion and automatic midnight/00:01 transition without the old workout. Screenshots: '+shots);
  } catch (error) {
    if(page) console.error('UI feedback:',await page.locator('#checklist-feedback,#storage-status,#completed-feedback,#spin-status').allTextContents());
    console.error(error.stack); throw error;
  } finally {
    clock('2026-10-11 12:00:00+02');
    runLocalSql("create or replace function private.roulette_clock() returns timestamptz language sql stable set search_path='' as $$select now();$$;",env);
    await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
    for(const user of users)await localRequest(stack.api+'/auth/v1/admin/users/'+user.id,{method:'DELETE',headers:admin}).catch(()=>{});
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
