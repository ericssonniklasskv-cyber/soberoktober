// Temporary local participant; original votes, winners, completions and clock are restored.
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');const {browserOptions}=require('./browser.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {localEnvironment,getLocalStack,localRequest,runLocalSql}=await import(pathToFileURL(path.join(root,'scripts/local-env.mjs')).href);
 const env=localEnvironment(),stack=getLocalStack(env,{start:false});
 const config=await fetch('http://127.0.0.1:3000/api/config').then(r=>r.json());assert.equal(config.votingPreview,true);assert.equal(config.supabaseUrl,stack.api);
 const headers={apikey:stack.publishable,'Content-Type':'application/json'},service={...headers,Authorization:'Bearer '+stack.serviceRole};
 const snapshot=()=>runLocalSql("select md5(jsonb_build_object('votes',(select jsonb_agg(v order by workout_date,user_id) from private.vote_preview_votes v),'winners',(select jsonb_agg(r order by workout_date) from private.vote_preview_results r),'clock',(select test_now from private.vote_preview_settings),'completions',(select jsonb_agg(c order by workout_date,user_id) from private.vote_preview_completions c))::text);",env);
 const before=snapshot();let user,browser,simulation;
 const rpc=(name,args={})=>localRequest(stack.api+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,Authorization:'Bearer '+user.session.access_token},body:JSON.stringify(args)});
 try{
  const email=`vote-completion-e2e-${Date.now()}@example.invalid`,password='Local-Completion-Test-2026!';
  user=await localRequest(stack.api+'/auth/v1/admin/users',{method:'POST',headers:service,body:JSON.stringify({email,password,email_confirm:true})});
  runLocalSql(`insert into public.profiles(id,email,display_name)values('${user.id}','${email}','Completion E2E');`,env);
  user.session=await localRequest(stack.api+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password})});
  let state=await rpc('local_workout_vote'),today=state.days.find(day=>day.date===state.today&&day.result);
  if(!today){
    const saved=JSON.parse(runLocalSql("select json_build_object('clock',(select test_now from private.vote_preview_settings),'winners',(select coalesce(json_agg(workout_date),'[]'::json) from private.vote_preview_results))::text;",env).split('\n').find(line=>line.trim().startsWith('{')));
    const date=state.days.find(day=>day.result)?.date||'2026-10-19',instant=date+'T12:00:00+02:00';
    simulation={...saved,date,instant};
    runLocalSql(`begin;update private.vote_preview_settings set test_now=timestamptz '${instant}' where singleton;select private.vote_preview_settle(date '${date}',timestamptz '${instant}');commit;`,env);
    state=await rpc('local_workout_vote');today=state.days.find(day=>day.date===state.today&&day.result);
  }
  assert(today,'Expected a saved winner for the simulated workout day.');
  assert.equal(today.own_vote,null);assert.equal(today.completion,null);
  const sdk=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js').then(r=>r.text());
  browser=await chromium.launch({headless:true,...browserOptions()});
  const context=await browser.newContext({reducedMotion:'reduce'});await context.route('**/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:sdk}));
  await context.addInitScript(({session,date})=>{session.expires_at=Date.parse('2026-10-30T00:00:00+01:00')/1000;localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.setItem('soberoktober-trump-quote-seen-date',date);localStorage.setItem('soberoktober:weekly-reports-seen:'+session.user.id,JSON.stringify(['oct_01_07','oct_08_14','oct_15_21','oct_22_28']));},{session:user.session,date:state.today});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date(state.today+'T12:00:00+02:00'));
  await page.addLocatorHandler(page.locator('#weekly-release-dialog[open]'),()=>page.locator('#weekly-release-close').click());
  await page.goto('http://127.0.0.1:3000/');await page.locator('#vote-complete').waitFor({state:'visible'});
  await page.locator('#vote-complete').click();await page.locator('#vote-undo-complete').waitFor({state:'visible'});
  const score=async()=>(await rpc('get_leaderboard')).find(row=>row.is_current_user);
  assert.equal(Number((await score()).total_points),3);assert.equal(Number((await score()).completed_days),1);
  await page.waitForFunction(()=>[...document.querySelectorAll('#leaderboard-list li')].some(row=>row.textContent.includes('Completion E2E')&&row.querySelector('.leaderboard-points')?.textContent==='3 p'));
  const repeat=await Promise.all([0,1].map(()=>rpc('local_workout_vote',{p_action:'complete',p_date:today.date})));
  assert(repeat.every(data=>data.days.find(day=>day.date===today.date).completion.points===3));assert.equal(Number((await score()).total_points),3);
  await page.reload();await page.locator('#vote-undo-complete').waitFor({state:'visible'});assert.equal(await page.locator('#vote-complete').isVisible(),false);
  const shots='/private/tmp/vote-completion-e2e';await fs.mkdir(shots,{recursive:true});
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await page.locator('#vote-today').screenshot({path:shots+'/completed-'+width+'.png'});}
  const history=await context.newPage();history.on('pageerror',e=>errors.push(e.message));await history.clock.setFixedTime(new Date(state.today+'T12:00:00+02:00'));
  await history.goto('http://127.0.0.1:3000/min-oktober/');await history.locator('#history-state').waitFor({state:'visible'});
  assert.equal(await history.locator('#total-points').textContent(),'3');assert.equal(await history.locator('#completed-days').textContent(),'1');
  const day=history.locator('.calendar-day').filter({has:history.locator('.day-number',{hasText:new RegExp('^'+Number(today.date.slice(-2))+'$')})});
  assert.match(await day.textContent(),/Dagens val/);await day.click();await history.locator('#day-detail').waitFor({state:'visible'});
  assert.equal(await history.locator('#detail-points').textContent(),'3 poäng');await history.waitForFunction(()=>!document.querySelector('#day-edit-fields').disabled);assert.equal(await history.locator('#day-edit-form').isVisible(),true);assert.equal(await history.locator('#day-edit-level').inputValue(),'workout');
  assert.equal(await history.locator('#detail-title').textContent(),today.options.find(option=>option.id===today.result.option_id).title);
  await history.close();
  await page.locator('#vote-undo-complete').click();await page.locator('#vote-complete').waitFor({state:'visible'});
  assert.equal(Number((await score()).total_points),0);assert.equal(Number((await score()).completed_days),0);
  await page.reload();await page.locator('#vote-complete').waitFor({state:'visible'});
  // A simultaneous workout/steps choice may save only one of the two alternatives.
  const race=await Promise.allSettled(['steps','complete'].map(p_action=>rpc('local_workout_vote',{p_action,p_date:today.date})));
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert([1,3].includes(Number((await score()).total_points)));
  for(const p_action of ['unsteps','uncomplete'])await rpc('local_workout_vote',{p_action,p_date:today.date});
  await page.reload();await page.locator('#vote-complete').waitFor({state:'visible'});
  await page.locator('#vote-steps-choice').click();await page.waitForFunction(()=>document.querySelector('#vote-steps-choice').getAttribute('aria-pressed')==='true');
  assert.equal(Number((await score()).total_points),1);assert.equal(Number((await score()).completed_days),1);assert(await page.locator('#vote-complete').isDisabled());
  await assert.rejects(()=>rpc('local_workout_vote',{p_action:'complete',p_date:today.date}),/Klicka ur/);
  await rpc('local_workout_vote',{p_action:'uncomplete',p_date:today.date});assert.equal(Number((await score()).total_points),1,'Stale workout undo cannot remove steps');
  await Promise.all([0,1].map(()=>rpc('local_workout_vote',{p_action:'steps',p_date:today.date})));assert.equal(Number((await score()).total_points),1);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#vote-steps-choice').getAttribute('aria-pressed')==='true');
  await page.setViewportSize({width:390,height:1000});await page.locator('#vote-today').screenshot({path:shots+'/steps-390.png'});
  const stepHistory=await context.newPage();stepHistory.on('pageerror',e=>errors.push(e.message));await stepHistory.clock.setFixedTime(new Date(state.today+'T12:00:00+02:00'));
  await stepHistory.goto('http://127.0.0.1:3000/min-oktober/');await stepHistory.locator('#history-state').waitFor({state:'visible'});
  assert.equal(await stepHistory.locator('#total-points').textContent(),'1');assert.equal(await stepHistory.locator('#completed-days').textContent(),'1');
  const stepDay=stepHistory.locator('.calendar-day').filter({has:stepHistory.locator('.day-number',{hasText:new RegExp('^'+Number(today.date.slice(-2))+'$')})});
  assert.match(await stepDay.textContent(),/10 000 steg/);await stepDay.click();await stepHistory.locator('#day-detail').waitFor({state:'visible'});
  assert.equal(await stepHistory.locator('#detail-title').textContent(),'10 000 steg');assert.equal(await stepHistory.locator('#detail-points').textContent(),'1 poäng');await stepHistory.close();
  await page.locator('#vote-steps-choice').click();await page.waitForFunction(()=>document.querySelector('#vote-steps-choice').getAttribute('aria-pressed')==='false');assert.equal(Number((await score()).total_points),0);
  await page.locator('#vote-complete').click();await page.locator('#vote-undo-complete').waitFor({state:'visible'});assert.equal(Number((await score()).total_points),3);assert(await page.locator('#vote-steps-choice').isDisabled());
  await assert.rejects(()=>rpc('local_workout_vote',{p_action:'steps',p_date:today.date}),/Ångra/);
  await page.locator('#vote-undo-complete').click();await page.locator('#vote-complete').waitFor({state:'visible'});assert.equal(Number((await score()).total_points),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: actual local Auth → complete without voting → 3 points or 1 step point/one day → exclusive concurrent choices → undo/switch → duplicate calls → reload → leaderboard and Min oktober → undo. Votes, winners and clock preserved. Screenshots '+shots);
 }finally{
  await browser?.close();if(user)await localRequest(stack.api+'/auth/v1/admin/users/'+user.id,{method:'DELETE',headers:service});
  if(simulation){
    const {date,instant,clock,winners}=simulation;
    const restoreClock=clock?"timestamptz '"+clock.replaceAll("'","''")+"'":'null';
    const removeWinner=winners.includes(date)?'':`delete from private.vote_preview_results r where r.workout_date=date '${date}' and not exists(select 1 from private.vote_preview_completions c where c.workout_date=r.workout_date) and exists(select 1 from private.vote_preview_settings where test_now=timestamptz '${instant}');`;
    runLocalSql(`begin;${removeWinner}update private.vote_preview_settings set test_now=${restoreClock} where singleton and test_now=timestamptz '${instant}';commit;`,env);
  }
  assert.equal(snapshot(),before,'Existing votes, winners, clock and completions must remain unchanged');
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
