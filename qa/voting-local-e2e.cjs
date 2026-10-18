// Real local Auth + PostgREST + browser. Never uses a remote Supabase URL.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {browserOptions}=require('./browser.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {localEnvironment,getLocalStack,localRequest,runLocalSql}=await import(pathToFileURL(path.join(root,'scripts/local-env.mjs')).href);
 const env=localEnvironment(),stack=getLocalStack(env,{start:false});
 const origin='http://127.0.0.1:3000';
 const config=await fetch(origin+'/api/config').then(r=>r.json());
 assert.equal(config.supabaseUrl,stack.api);assert.equal(config.votingPreview,true,'Start npm run dev:vote first');
 const initial=JSON.parse(runLocalSql("select json_build_object('votes',(select count(*) from private.vote_preview_votes),'results',(select count(*) from private.vote_preview_results),'clock',(select test_now from private.vote_preview_settings))::text;",env).split('\n').find(line=>line.trim().startsWith('{')));
 assert.equal(initial.votes+initial.results,0,'Refusing to erase existing local preview votes: use a fresh/reset preview.');
 const headers={apikey:stack.publishable,'Content-Type':'application/json'},service={...headers,Authorization:'Bearer '+stack.serviceRole};
 const users=[],errors=[];let browser,adminPage,memberPage;
 const rpc=(user,name,body={})=>localRequest(stack.api+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,Authorization:'Bearer '+user.session.access_token},body:JSON.stringify(body)});
 const get=user=>rpc(user,'local_workout_vote');
 const vote=(user,date,option)=>rpc(user,'local_workout_vote',{p_action:'vote',p_date:date,p_option:option});
 let admin;
 const control=(action,instant)=>rpc(admin,'local_workout_vote_admin',{p_action:action,p_now:instant||null});
 const resetOpen=async()=>{await control('reset');await control('clock','2026-10-18T21:00:00+02:00');};
 const poll=(state,date)=>state.days.find(d=>d.date===date);
 try{
  for(const [index,name] of ['Admin','Anna','Erik'].entries()){
   const email=`vote-e2e-${Date.now()}-${index}@example.invalid`,password='Local-Vote-Test-2026!';
   const user=await localRequest(stack.api+'/auth/v1/admin/users',{method:'POST',headers:service,body:JSON.stringify({email,password,email_confirm:true})});
   users.push({id:user.id});
   runLocalSql(`insert into public.profiles(id,email,display_name,is_admin,auto_elimination_recheck_after) values ('${user.id}','${email}','Vote E2E ${name}',${index===0},'2026-10-18');`,env);
   users.at(-1).session=await localRequest(stack.api+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password})});
  }
  const [adminUser,anna,erik]=users;admin=adminUser;
  const baseline=JSON.stringify(await rpc(anna,'get_leaderboard'));
  await assert.rejects(()=>rpc(anna,'local_workout_vote_admin',{p_action:'reset'}),/Endast lokal admin/);
  await assert.rejects(()=>localRequest(stack.api+'/rest/v1/rpc/local_workout_vote',{method:'POST',headers,body:'{}'}),/401|403/);
  assert.match(runLocalSql("select not has_table_privilege('authenticated','private.vote_preview_votes','INSERT') and not has_table_privilege('authenticated','private.vote_preview_settings','UPDATE') and not has_function_privilege('authenticated','private.vote_preview_settle(date,timestamptz)','EXECUTE');",env),/\bt\b/);
  await control('reset');
  await assert.rejects(()=>vote(anna,'2026-10-19',0),/inte öppen/);
  await control('clock','2026-10-18T21:00:00+02:00');
  assert.equal(poll(await get(anna),'2026-10-19').options.length,4);
  await assert.rejects(()=>vote(anna,'2026-10-20',0),/inte öppen/);
  await assert.rejects(()=>vote(anna,'2026-10-19',4),/fyra passen/);
  await vote(anna,'2026-10-19',2);
  await assert.rejects(()=>vote(anna,'2026-10-19',1),/redan röstat/);
  assert.equal(poll(await get(erik),'2026-10-19').own_vote,null,'Votes are private per account');
  const result=await control('clock','2026-10-19T00:00:00+02:00');
  assert.equal(poll(result,'2026-10-19').result.option_id,2,'A single voter is enough');
  assert.equal(poll(result,'2026-10-19').result.total_votes,1);
  await assert.rejects(()=>vote(erik,'2026-10-19',0),/inte öppen/);
  await assert.rejects(()=>vote(anna,'2026-10-20',1),/inte öppen/);
  await control('clock','2026-10-19T15:00:00+02:00');
  await vote(anna,'2026-10-20',1);
  assert.equal(poll(await get(anna),'2026-10-20').own_vote,1,'Same participant may vote the next day');
  await assert.rejects(()=>control('clock','2026-10-18T21:00:00+02:00'),/bara framåt/);
  await resetOpen();
  const raced=await Promise.allSettled([vote(erik,'2026-10-19',0),vote(erik,'2026-10-19',3)]);
  assert.equal(raced.filter(r=>r.status==='fulfilled').length,1,'Concurrent requests accept one vote');
  await resetOpen();await vote(anna,'2026-10-19',0);await vote(erik,'2026-10-19',1);
  const tie=poll(await control('clock','2026-10-19T00:00:00+02:00'),'2026-10-19').result;
  assert.equal(tie.tied_options,2);assert([0,1].includes(tie.option_id));
  for(let n=0;n<4;n++)assert.deepEqual(poll(await get(anna),'2026-10-19').result,tie,'Lottery is saved once');
  await resetOpen();
  const empty=poll(await control('clock','2026-10-19T00:00:00+02:00'),'2026-10-19').result;
  assert.equal(empty.total_votes,0);assert.equal(empty.tied_options,4);assert([0,1,2,3].includes(empty.option_id));
  assert.deepEqual(poll(await get(erik),'2026-10-19').result,empty);
  assert.equal(JSON.stringify(await rpc(anna,'get_leaderboard')),baseline,'Voting does not change competition points');
  await resetOpen();
  const sdk=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js').then(r=>r.text());
  browser=await chromium.launch({headless:true,...browserOptions()});
  async function open(user,failFirst=false){
   const context=await browser.newContext();
   if(failFirst){let failed=false;await context.route('**/rest/v1/rpc/local_workout_vote',route=>{if(!failed){failed=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Tillfälligt lokalt testfel'})});}return route.continue();});}
   await context.route('**/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
   await context.addInitScript(session=>{if(!sessionStorage.getItem('vote-e2e-ready')){localStorage.setItem('sb-127-auth-token',JSON.stringify(session));sessionStorage.setItem('vote-e2e-ready','1');}localStorage.setItem('soberoktober-trump-quote-seen-date',new Date().toLocaleDateString('en-CA'));},user.session);
   const page=await context.newPage();await page.addLocatorHandler(page.locator('#weekly-release-dialog[open]'),()=>page.locator('#weekly-release-close').click());page.on('pageerror',e=>errors.push(e.message));
   page.on('request',req=>{if(req.url().includes('.supabase.co'))errors.push('Unexpected remote Supabase request');});
   await page.goto(origin+'/');await page.locator('#app-shell').waitFor({state:'visible'});
   if(await page.locator('#weekly-release-dialog').isVisible())await page.locator('#weekly-release-close').click();
   await page.locator('#vote-preview').waitFor({state:'visible'});if(failFirst){await page.locator('#vote-retry').click();await page.locator('.vote-option').first().waitFor({state:'visible'});assert.equal(await page.locator('#vote-feedback').textContent(),'');}return page;
  }
  adminPage=await open(admin);adminPage.on('dialog',dialog=>dialog.accept());
  await adminPage.locator('#vote-reset').click();await adminPage.locator('#vote-open-sunday').waitFor({state:'visible'});
  assert.equal(await adminPage.locator('#vote-preview').isVisible(),false);assert(await adminPage.locator('#training-roulette').isVisible());
  await adminPage.locator('#open-roulette').click();await adminPage.locator('#roulette-dialog').waitFor({state:'visible'});
  await control('clock','2026-10-18T21:00:00+02:00');await adminPage.locator('#vote-preview').waitFor({state:'visible'});
  assert.equal(await adminPage.locator('#roulette-dialog').isVisible(),false,'Open roulette dialog closes when voting opens');
  memberPage=await open(anna,true);
  assert(await adminPage.locator('#vote-admin-tools').isVisible());assert.equal(await memberPage.locator('#vote-admin-tools').isVisible(),false);
  assert.equal(await memberPage.locator('#training-roulette').isVisible(),false);
  assert.equal(await memberPage.locator('#dagens-pass').isVisible(),false);
  assert.equal(await memberPage.locator('#competition-bingo').isVisible(),false);
  assert.equal(await memberPage.locator('.vote-option').count(),4);
  assert(await memberPage.locator('#vote-submit').isDisabled());
  await memberPage.locator('.vote-option').nth(2).click();await memberPage.locator('#vote-submit').click();
  await memberPage.locator('.vote-own-mark').waitFor({state:'visible'});
  assert.equal(poll(await get(anna),'2026-10-19').own_vote,2);
  assert.equal(await memberPage.locator('input[name="workout-vote"]:disabled').count(),4);
  await memberPage.reload();await memberPage.locator('.vote-own-mark').waitFor({state:'visible'});
  if(await memberPage.locator('#weekly-release-dialog').isVisible())await memberPage.locator('#weekly-release-close').click();
  const shots='/private/tmp/sober-vote-e2e';await fs.mkdir(shots,{recursive:true});
  for(const width of [320,390,768,1280,1440]){
   await memberPage.setViewportSize({width,height:1000});
   assert(await memberPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);
   if(width>=1271){const activity=await memberPage.locator('.activity-preview').boundingBox(),ballot=await memberPage.locator('#vote-preview').boundingBox();assert(activity.x+activity.width<=ballot.x,'Activity column does not overlap ballot at '+width);}
   await memberPage.locator('#vote-preview').screenshot({path:path.join(shots,'ballot-'+width+'.png')});
  }
  await adminPage.locator('#vote-next-midnight').click();
  await adminPage.waitForFunction(()=>document.querySelector('#vote-today').hidden===false);
  await memberPage.locator('#vote-refresh').click();
  await memberPage.locator('#vote-today').waitFor({state:'visible'});
  assert.equal(await memberPage.locator('#vote-today-title').textContent(),poll(await get(anna),'2026-10-19').options[2].title);
  assert(await memberPage.locator('#vote-waiting').isVisible());
  await adminPage.locator('#vote-open-next').click();await memberPage.locator('#vote-refresh').click();
  await memberPage.locator('#vote-ballot').waitFor({state:'visible'});
  assert.match(await memberPage.locator('#vote-target').textContent(),/tisdag 20 oktober/);
  assert.equal(await memberPage.locator('input[name="workout-vote"]:enabled').count(),4);
  await memberPage.locator('#vote-preview').screenshot({path:path.join(shots,'winner-1440.png')});
  await adminPage.screenshot({path:path.join(shots,'admin-full-1440.png'),fullPage:true});
  // A previously open tab must not retain the previous participant's ballot.
  await memberPage.evaluate(()=>{localStorage.removeItem('sb-127-auth-token');location.reload();});
  await memberPage.locator('#entry-gate').waitFor({state:'visible'});
  // Finish the week, including the switch to Swedish winter time.
  const finished=await control('clock','2026-10-26T00:00:00+01:00');
  assert.equal(finished.days.filter(day=>day.result).length,7);
  assert.deepEqual(errors,[]);
  console.log('PASS: real local Auth/RPC/browser; opening 21:00; one immutable vote incl. concurrent requests; permissions; midnight cutoff; one/zero voters; persistent tie lottery; next-day voting; unchanged points; 320/390/768/1280/1440px; retry; open roulette transition; screenshots '+shots);
 }finally{
  await browser?.close();
  if(admin){await control('reset');await control('clock',initial.clock||'2026-10-18T21:00:00+02:00');if(!initial.clock)await control('real_time');}
  for(const user of users)await localRequest(stack.api+'/auth/v1/admin/users/'+user.id,{method:'DELETE',headers:service}).catch(()=>{});
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
