const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright'),{browserOptions}=require('./browser.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
  if(!process.env.SOBER_LOCAL_ENV_MODULE)throw Error('Explicit local stack adapter required');
  const {localEnvironment,getLocalStack,runLocalSql,localRequest}=await import(pathToFileURL(process.env.SOBER_LOCAL_ENV_MODULE).href);
  const env=localEnvironment(),stack=getLocalStack(env,{start:false});
  const headers={apikey:stack.publishable,'Content-Type':'application/json'},admin={...headers,Authorization:'Bearer '+stack.serviceRole};
  const date='2026-10-12',endpoint=stack.api+'/rest/v1/daily_challenges';
  const previous=await localRequest(endpoint+'?challenge_date=eq.'+date,{headers:admin});
  const sdk=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js').then(r=>r.text());
  const users=[],errors=[];let browser,server;
  try{
    for(const isAdmin of [true,false]){
      const email=`bonus-e2e-${isAdmin}-${Date.now()}@example.invalid`,password='Local-Bonus-Test-2026!';
      const user=await localRequest(stack.api+'/auth/v1/admin/users',{method:'POST',headers:admin,body:JSON.stringify({email,password,email_confirm:true})});users.push({id:user.id});
      runLocalSql(`insert into public.profiles(id,email,display_name,is_admin,auto_elimination_recheck_after) values('${user.id}','${email}','Bonus E2E ${isAdmin?'Admin':'Participant'}',${isAdmin},'2026-10-11');`,env);
      users.at(-1).session=await localRequest(stack.api+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password})});
    }
    await localRequest(endpoint+'?challenge_date=eq.'+date,{method:'DELETE',headers:{...admin,Prefer:'return=representation'}});
    server=http.createServer(async(req,res)=>{try{
      const p=new URL(req.url,'http://localhost').pathname;
      if(p==='/api/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({supabaseUrl:stack.api,supabasePublishableKey:stack.publishable,rouletteMode:'server'}));return;}
      const file=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(!file.startsWith(root+path.sep))throw Error('Denied');
      res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
    }catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true,...browserOptions()});
    async function loggedIn(user){
      const context=await browser.newContext({reducedMotion:'reduce'});await context.route('**/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
      await context.addInitScript(session=>{session.expires_at=Date.parse('2026-10-30T00:00:00+02:00')/1000;localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.setItem('soberoktober-trump-quote-seen-date','2026-10-12');},user.session);
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-12T12:00:00+02:00'));return page;
    }
    const editor=await loggedIn(users[0]);await editor.goto(origin+'/admin/');await editor.locator('#admin-state').waitFor({state:'visible'});
    await editor.waitForFunction(()=>document.querySelector('#challenge-date').value==='2026-10-12');
    assert.equal(await editor.locator('#challenge-title').isVisible(),false);await editor.locator('#bonus-description').fill('Lokal bonus utan träningspass');await editor.locator('#bonus-points').fill('2');
    await editor.locator('#challenge-form [type="submit"]').click();await editor.waitForFunction(()=>document.querySelector('#form-status').textContent==='Bonusen är sparad.');
    const configured=await localRequest(endpoint+'?challenge_date=eq.'+date,{headers:admin});assert.equal(configured[0].base_amount,null);assert.equal(configured[0].bonus_points,2);
    const participant=await loggedIn(users[1]);await participant.goto(origin+'/');await participant.locator('#app-shell').waitFor({state:'visible'});
    await participant.locator('#weekly-release-close').click();await participant.waitForFunction(()=>document.querySelector('#bonus-description').textContent==='Lokal bonus utan träningspass');
    assert.equal(await participant.locator('#bonus-challenge').isVisible(),true);assert.equal(await participant.locator('#dagens-pass').isVisible(),false);
    assert.equal(await participant.locator('#bonus-button').isEnabled(),true);await participant.locator('#bonus-button').click();
    await participant.waitForFunction(()=>document.querySelector('#bonus-button').getAttribute('aria-pressed')==='true');
    const own={...headers,Authorization:'Bearer '+users[1].session.access_token};
    const bonus=await localRequest(stack.api+'/rest/v1/daily_bonus_claims?select=*',{headers:own});assert.equal(bonus[0].points,2);
    assert.deepEqual(await localRequest(stack.api+'/rest/v1/daily_results?select=*',{headers:own}),[]);
    assert.deepEqual(await localRequest(stack.api+'/rest/v1/roulette_daily_scores?select=*',{headers:own}),[]);
    const board=await localRequest(stack.api+'/rest/v1/rpc/get_leaderboard',{method:'POST',headers:own,body:'{}'});
    const result=board.find(r=>r.display_name==='Bonus E2E Participant');assert.equal(Number(result.total_points),2);assert.equal(Number(result.completed_days),0,'Bonus does not replace training attendance');
    participant.on('dialog',d=>d.accept());await participant.locator('#bonus-button').click();await participant.waitForFunction(()=>document.querySelector('#bonus-button').getAttribute('aria-pressed')==='false');
    assert.deepEqual(await localRequest(stack.api+'/rest/v1/daily_bonus_claims?select=*',{headers:own}),[]);
    assert.deepEqual(errors,[]);console.log('PASS: local admin bonus-only save → actual Supabase → home bonus → participant claim/undo → leaderboard, without a workout or roulette result.');
  }finally{
    if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
    await localRequest(endpoint+'?challenge_date=eq.'+date,{method:'DELETE',headers:{...admin,Prefer:'return=representation'}});
    if(previous.length)await localRequest(endpoint,{method:'POST',headers:{...admin,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(previous)});
    if(users.length) {
      const ids=users.map(user=>`'${user.id}'`).join(',');
      runLocalSql(`delete from private.daily_result_corrections where actor_id in (${ids}) or user_id in (${ids});`,env);
    }
    for(const user of users)await localRequest(stack.api+'/auth/v1/admin/users/'+user.id,{method:'DELETE',headers:{...admin,Prefer:'return=representation'}});
  }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
