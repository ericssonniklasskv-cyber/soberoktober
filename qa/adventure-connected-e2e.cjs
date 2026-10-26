/* Real local Auth -> PostgREST -> private game functions -> browser -> standings. */
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{spawn}=require('node:child_process');
const {chromium}=require('playwright'),{browserOptions}=require('./browser.cjs');
const G=require('../adventure/adventure-logic.js');
(async()=>{
 const {localEnvironment,getLocalStack,runLocalSql,localRequest}=await import('../scripts/local-env.mjs');
 const env=localEnvironment(),stack=getLocalStack(env),sql=q=>runLocalSql(q,env),headers={apikey:stack.serviceRole,Authorization:'Bearer '+stack.serviceRole,'Content-Type':'application/json'};
 const users=[];let browser,server;
 const prior=JSON.parse(sql("select json_build_object('clock',pg_get_functiondef('private.adventure_clock()'::regprocedure),'enabled',(select enabled from private.adventure_settings),'bonus',(select row_to_json(c)from public.daily_challenges c where challenge_date='2026-10-26'));").split('\n').find(s=>s.trim().startsWith('{')));
 const clock=date=>sql(`create or replace function private.adventure_clock()returns timestamptz language sql stable security invoker set search_path=''as $$select timestamptz '${date}';$$;`);
 const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
 const create=async(name,admin=false)=>{const email='adventure-'+randomUUID()+'@example.invalid',password='LocalAdventure-2026!';const u=await localRequest(stack.api+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true})});const user=u.user||u;users.push(user.id);sql(`insert into public.profiles(id,email,display_name,is_admin)values('${user.id}',${quote(email)},${quote(name)},${admin});`);return localRequest(stack.api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:stack.publishable,'Content-Type':'application/json'},body:JSON.stringify({email,password})});};
 const rpc=async(session,action='get',payload={})=>localRequest(stack.api+'/rest/v1/rpc/my_adventure',{method:'POST',headers:{apikey:stack.publishable,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:{...payload,board_size:60}})});
 const action=async(session,kind,fields={})=>{const state=await rpc(session);return rpc(session,kind,{...fields,request_id:randomUUID(),expected_revision:state.revision});};
 async function queuedMidnight(session){
  const state=await rpc(session),migration=require('node:fs').readFileSync('supabase/migrations/20261025202041_prepare_final_adventure.sql','utf8');
  const clockDefinition=migration.match(/create function private\.adventure_clock\(\)[\s\S]*?\$\$;/)[0];
  const offset=Number((Date.parse('2026-10-31T23:59:58+01:00')-Date.now())/1000).toFixed(3);
  const shifted=clockDefinition.replace('create function ','create or replace function ').replace('();$$;',()=>"() + interval '"+offset+" seconds';$$;");
  assert(shifted.includes('interval'));sql(shifted);
  const hold=spawn('docker',['exec','-i','supabase_db_soberoktober','psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{env,stdio:['pipe','pipe','pipe']});let held='',holdError='';hold.stderr.on('data',d=>holdError+=d);hold.stdin.end(`begin;select id from public.profiles where id='${session.user.id}'for update;\nselect pg_sleep(3);commit;\n`);
  await new Promise((resolve,reject)=>{hold.stdout.on('data',d=>{held+=d;if(held.includes(session.user.id))resolve();});hold.on('error',reject);hold.on('exit',code=>{if(!held.includes(session.user.id))reject(Error('Lock fixture failed: '+code+' '+holdError));});});
  assert.match(sql("select (private.adventure_clock()at time zone 'Europe/Stockholm')::date;"),/2026-10-31/,'The request must begin before the deadline');
  const started=Date.now();
  await assert.rejects(()=>rpc(session,'exercise',{exercise_id:'running',request_id:randomUUID(),expected_revision:state.revision}),/26–31/);
  assert(Date.now()-started>1500,'The write must actually have waited for the row lock');
  clock('2026-10-26 12:00:00+01');
 }
 try{
  {const fs=require('node:fs'),migration=fs.readFileSync('supabase/migrations/20261025202041_prepare_final_adventure.sql','utf8');const binding=migration.slice(migration.indexOf('-- Verified production account IDs'),migration.indexOf('create table private.adventure_games'));sql(fs.readFileSync('supabase/tests/adventure_personal_bindings.sql','utf8').replace(/-- BEGIN_ACTUAL_BINDING[\s\S]*?-- END_ACTUAL_BINDING/,()=>binding));}
  clock('2026-10-26 00:00:00+01');sql('update private.adventure_settings set enabled=true;');
  if(process.argv.includes('--deadline-only')){await queuedMidnight(await create('Adventure QA Deadline'));console.log('PASS: actual migration clock; request begins on October 31, waits on a row lock through midnight, then is rejected without a step.');return;}
  const anna=await create('Adventure QA Anna'),erik=await create('Adventure QA Erik',true),personal=await create('Adventure QA Personal');
  sql(`insert into private.adventure_personal_pawns values('${personal.user.id}','mikeb');`);
  let s=await rpc(anna);assert.equal(s.state.events.length,0);assert.equal(s.today,'2026-10-26');assert.equal(s.active,true);assert.equal(s.profile.is_admin,false);
  assert.equal((await rpc(erik)).profile.is_admin,true);
  assert.equal(G.progress(s.state).position,0);
  // Client dates/points and user IDs have no authority.
  s=await action(anna,'exercise',{exercise_id:'running',date:'2026-10-31',points:999,user_id:erik.user.id});
  assert.equal(s.state.events[0].date,'2026-10-26');assert.equal(s.state.events[0].distanceKm,1);assert.equal(s.state.events[0].type,'exercise');
  assert.equal((await rpc(erik)).state.events.length,0);
  assert.equal(Number(s.standings.find(r=>r.id===anna.user.id).points),0);
  const duplicate={exercise_id:'squats',request_id:randomUUID(),expected_revision:s.revision};
  const results=await Promise.all([rpc(anna,'exercise',duplicate),rpc(anna,'exercise',duplicate)]);assert.equal(results[1].state.events.length,2);
  await assert.rejects(()=>rpc(anna,'exercise',{...duplicate,exercise_id:'pullups'}),/redan/);
  const sameRevision=results[1].revision;
  const race=await Promise.allSettled(['pushups','pullups'].map(exercise_id=>rpc(anna,'exercise',{exercise_id,request_id:randomUUID(),expected_revision:sameRevision})));
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal((await rpc(anna)).state.events.length,3);
  for(let i=0;i<3;i++)s=await action(anna,'exercise',{exercise_id:'squats'});
  assert.equal(G.progress(s.state).pendingBoss.id,'troll');
  await assert.rejects(()=>action(anna,'exercise',{exercise_id:'pushups'}),/bossens/);
  await assert.rejects(()=>action(anna,'boss',{boss_id:'witch',choice_id:'handstand'}),/inte tillgänglig/);
  s=await action(anna,'boss',{boss_id:'troll',choice_id:'somersault'});assert.equal(G.progress(s.state).bossesDefeated,1);
  assert.equal(Number(s.standings.find(r=>r.id===anna.user.id).points),0);
  s=await action(anna,'undo',{event_id:s.state.events.at(-1).id});assert.equal(G.progress(s.state).pendingBoss.id,'troll');
  s=await action(anna,'boss',{boss_id:'troll',choice_id:'somersault'});
  for(let boss=1;boss<6;boss++){
   for(let i=0;i<G.BOSSES[boss].position-G.BOSSES[boss-1].position;i++)s=await action(anna,'exercise',{exercise_id:['squats','pushups','pullups','running'][i%4]});
   if(boss<5)s=await action(anna,'boss',{boss_id:G.BOSSES[boss].id,choice_id:G.BOSSES[boss].choices[0].id});
  }
  assert.equal(G.progress(s.state).position,60);assert.equal(G.progress(s.state).bossesDefeated,5);assert.equal(Number(s.standings.find(r=>r.id===anna.user.id).points),0);
  await assert.rejects(()=>action(anna,'boss',{boss_id:'final',choice_id:'victory-jump'}),/31 oktober/);
  s=await action(anna,'exercise',{exercise_id:'pullups'});assert.equal(G.scoreTotals(s.state).points,1);assert.equal(Number(s.standings.find(r=>r.id===anna.user.id).points),1);
  s=await action(anna,'undo',{event_id:s.state.events.at(-1).id});assert.equal(G.scoreTotals(s.state).points,0);
  s=await action(anna,'undo',{event_id:s.state.events.at(-1).id});assert.equal(G.progress(s.state).position,59);assert.equal(G.canScore(s.state,'2026-10-26'),false);
  s=await action(anna,'exercise',{exercise_id:'running'});
  clock('2026-10-31 23:59:59+01');s=await action(anna,'boss',{boss_id:'final',choice_id:'victory-jump'});assert.equal(G.progress(s.state).finished,true);
  s=await action(anna,'exercise',{exercise_id:'running'});assert.equal(G.scoreTotals(s.state).points,1);assert.equal(Number(s.standings.find(r=>r.id===anna.user.id).points),1);
  clock('2026-11-01 00:00:00+01');await assert.rejects(()=>action(anna,'exercise',{exercise_id:'squats'}),/26–31/);await assert.rejects(()=>action(anna,'undo',{event_id:s.state.events.at(-1).id}),/26–31/);assert.equal((await rpc(anna)).state.events.length,s.state.events.length);
  clock('2026-10-25 23:59:59+01');await assert.rejects(()=>action(erik,'exercise',{exercise_id:'running'}),/26–31/);
  // Anonymous API, direct table access, role forgery and personal-pawn reassignment.
  await assert.rejects(()=>localRequest(stack.api+'/rest/v1/rpc/my_adventure',{method:'POST',headers:{apikey:stack.publishable,'Content-Type':'application/json'},body:'{}'}),/permission|denied|Logga/);
  assert.match(sql("select has_table_privilege('authenticated','private.adventure_events','insert')::text,has_function_privilege('anon','public.my_adventure(text,jsonb)','execute')::text;"),/false\s*\|\s*false/);
  await assert.rejects(()=>action(personal,'mount',{index:2}),/tilldelad/);
  assert.equal((await rpc(personal)).profile.welcome_seen,false);await action(personal,'seen');assert.equal((await rpc(personal)).profile.welcome_seen,true);
  clock('2026-10-26 12:00:00+01');
  sql("insert into public.daily_challenges(challenge_date,title,bonus_description,bonus_points)values('2026-10-26','Frestelsernas rike','QA bonus',2)on conflict(challenge_date)do update set bonus_description='QA bonus',bonus_points=2;");
  s=await action(erik,'bonus');assert.equal(s.bonus.claimed,true);assert.equal(Number(s.standings.find(r=>r.id===erik.user.id).points),2);await action(erik,'bonus');assert.equal(Number((await rpc(erik)).standings.find(r=>r.id===erik.user.id).points),2);await action(erik,'unbonus');
  sql(`select private.apply_elimination('${erik.user.id}','Alkohol');`);await assert.rejects(()=>action(erik,'exercise',{exercise_id:'running'}),/utslagen/);assert((await fetch(stack.api+'/rest/v1/rpc/admin_restore_participant',{method:'POST',headers:{apikey:stack.publishable,Authorization:'Bearer '+erik.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_user_id:erik.user.id})})).ok);
  assert.match(sql("select private.find_missed_day_elimination(gen_random_uuid(),date '2026-10-30')is null;"),/t/);
  sql(`do $$begin begin insert into public.daily_results(user_id,result_date,multiplier)values('${erik.user.id}','2026-10-26',1);raise exception 'Legacy workout accepted';exception when insufficient_privilege then null;end;end $$;`);
  const before=sql(`select count(*)from private.adventure_events where user_id='${anna.user.id}';`);
  sql(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${erik.user.id}',true);select public.my_adventure('get','{"board_size":60}'::jsonb);rollback;`);assert.equal(sql(`select count(*)from private.adventure_events where user_id='${anna.user.id}';`),before);
  await queuedMidnight(erik);
  // Start the real local frontend, without a preview fixture for data requests.
  const port=3198,origin='http://127.0.0.1:'+port;
  server=spawn(process.execPath,['scripts/dev-adventure-connected.mjs','--date=2026-10-26'],{cwd:process.cwd(),env:{...env,ADVENTURE_CONNECTED_PORT:String(port)},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
  for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/config')).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));if(i===79)throw Error('Server failed: '+output);}
  browser=await chromium.launch({headless:true,...browserOptions()});const errors=[];
  const context=await browser.newContext();const authKey='sb-'+new URL(stack.api).hostname.split('.')[0]+'-auth-token';
  await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:authKey,session:erik});
  // The new homepage and personal welcome are available on Sunday; training is not.
  clock('2026-10-25 23:59:59+01');sql(`update private.adventure_games set welcome_seen=false where user_id='${personal.user.id}';`);
  const earlyContext=await browser.newContext({viewport:{width:390,height:950}});await earlyContext.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:authKey,session:personal});
  const early=await earlyContext.newPage();early.on('pageerror',e=>errors.push(e.message));await early.goto(origin+'/');await early.waitForURL('**/adventure/?live=1');await early.locator('#pawn-welcome-dialog').waitFor({state:'visible'});
  await early.waitForFunction(()=>document.querySelector('#storage-status').textContent==='Sparat på ditt konto.');await early.locator('#pawn-welcome-go').click();
  assert(await early.locator('#hero-rider img').isVisible());assert(await early.locator('#topplista').isVisible());assert(await early.locator('#senaste-aktivitet').isVisible());
  assert.match(await early.locator('#exercise-intro').textContent(),/26 oktober kl. 00.00 svensk tid/);assert(await early.locator('[data-exercise="running"]').isDisabled());assert(await early.locator('[data-quick-exercise="squats"]').isDisabled());
  for(const kind of ['exercise','boss','bonus','unbonus','undo'])await assert.rejects(()=>action(personal,kind,{exercise_id:'running',date:'2026-10-26'}),/26–31/);
  assert.equal((await rpc(personal)).state.events.length,0);assert.equal((await rpc(personal)).profile.welcome_seen,true);
  await early.screenshot({path:'/private/tmp/adventure-prelaunch-390.png',fullPage:true});assert(await early.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  clock('2026-10-26 00:00:00+01');await early.locator('#adventure-refresh').click();await early.waitForFunction(()=>!document.querySelector('[data-exercise="running"]').disabled);assert(!await early.locator('#pawn-welcome-dialog').isVisible());await earlyContext.close();
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/adventure/?live=1');
  await page.locator('[data-exercise="running"]').waitFor();await page.waitForFunction(()=>document.querySelector('#home-username').textContent==='Adventure QA Erik');
  assert(await page.locator('#home-admin').isVisible());assert(!await page.locator('.test-tools').isVisible());assert(!await page.locator('.home-demo-badge').first().isVisible());
  await page.locator('[data-exercise="running"]').click();await page.waitForFunction(()=>document.querySelector('#storage-status').textContent==='Sparat på ditt konto.');assert.equal(G.progress((await rpc(erik)).state).position,1);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#quick-status').textContent.includes('Ruta 1'));
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:950});await page.screenshot({path:'/private/tmp/adventure-connected-'+width+'.png',fullPage:true});const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,cls:e.className?.baseVal??e.className,right:e.getBoundingClientRect().right})).slice(0,8));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow at '+width+': '+JSON.stringify(overflow));}
  await page.locator('.home-bonus').evaluate(n=>n.open=true);await page.locator('#home-bonus-toggle').click();await page.waitForFunction(()=>document.querySelector('#home-bonus-toggle').getAttribute('aria-pressed')==='true');assert.equal(Number((await rpc(erik)).standings.find(r=>r.id===erik.user.id).points),2);
  await page.locator('#home-bonus-toggle').click();await page.waitForFunction(()=>document.querySelector('#home-bonus-toggle').getAttribute('aria-pressed')==='false');
  const other=await browser.newContext();await other.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:authKey,session:erik});const second=await other.newPage();await second.goto(origin+'/adventure/?live=1');await second.waitForFunction(()=>document.querySelector('#quick-status').textContent.includes('Ruta 1'));
  await page.locator('[data-exercise="squats"]').click();await page.waitForFunction(()=>document.querySelector('#quick-status').textContent.includes('Ruta 2'));await second.locator('#adventure-refresh').click();await second.waitForFunction(()=>document.querySelector('#quick-status').textContent.includes('Ruta 2'));
  // Lose the first response AFTER PostgreSQL committed, then retry the same request ID.
  let lost=false;await page.route('**/rest/v1/rpc/my_adventure',async route=>{const body=route.request().postDataJSON();if(!lost&&body.p_action==='exercise'){lost=true;await route.fetch();await route.abort('failed');}else await route.continue();});
  await page.locator('[data-exercise="pullups"]').click();await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Klicka samma knapp'));
  assert.equal(G.progress((await rpc(erik)).state).position,3);
  await page.locator('[data-exercise="pullups"]').click();await page.waitForFunction(()=>document.querySelector('#storage-status').textContent==='Sparat på ditt konto.');assert.equal(G.progress((await rpc(erik)).state).position,3,'A lost response cannot award an extra step on retry');
  await page.unroute('**/rest/v1/rpc/my_adventure');
  // Exercise the existing root callback in a fresh browser, with a real LOCAL Auth token.
  const callbackContext=await browser.newContext();const callback=await callbackContext.newPage();callback.on('pageerror',e=>errors.push(e.message));await callback.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:require('node:fs').readFileSync('vendor/supabase-2.116.0.js','utf8')}));await callback.goto(origin+'/adventure/');await callback.evaluate(session=>{const params=new URLSearchParams({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:'3600',token_type:'bearer',type:'signin'});location.replace('/#'+params.toString());},erik);await callback.waitForFunction(()=>document.querySelector('#home-username')?.textContent==='Adventure QA Erik');assert.equal(new URL(callback.url()).pathname,'/adventure/');assert.equal(new URL(callback.url()).hash,'','Auth tokens are consumed and removed from the callback URL');
  const pawn=await browser.newContext();await pawn.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:authKey,session:personal});const p=await pawn.newPage();await p.goto(origin+'/adventure/?live=1');await p.waitForFunction(()=>document.querySelector('#home-username').textContent==='Adventure QA Personal');assert(!await p.locator('#pawn-welcome-dialog').isVisible(),'Server seen flag survives a different browser');assert(!await p.locator('#choose-avatar').isVisible());assert(!await p.locator('#home-admin').isVisible());
  await p.locator('#home-account').click();await p.locator('#home-account-pawn').click();await p.locator('#pawn-welcome-dialog').waitFor({state:'visible'});await p.locator('#pawn-welcome-go').click();
  const loggedOut=await browser.newPage();await loggedOut.goto(origin+'/adventure/?live=1');await loggedOut.locator('#adventure-login-button').waitFor({state:'visible'});assert(!await loggedOut.locator('.page').isVisible());
  // Finish the real server-backed boss from the browser, then verify the October history.
  clock('2026-10-31 12:00:00+01');let end=await rpc(anna);end=await action(anna,'undo',{event_id:end.state.events.at(-1).id});end=await action(anna,'undo',{event_id:end.state.events.at(-1).id});
  const finaleContext=await browser.newContext({viewport:{width:390,height:950}});await finaleContext.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:authKey,session:anna});const finale=await finaleContext.newPage();finale.on('pageerror',e=>errors.push(e.message));await finale.goto(origin+'/adventure/?live=1');await finale.waitForFunction(()=>document.querySelector('#home-username').textContent==='Adventure QA Anna');assert.equal(G.progress((await rpc(anna)).state).pendingBoss?.id,'final');await finale.locator('#quick-gate').click();await finale.locator('#defeat-boss').click();await finale.waitForFunction(()=>document.querySelector('#boss-dialog').dataset.mode==='finale');assert(await finale.locator('#finale-confetti').isVisible());
  await finale.locator('#continue-journey').click();await finale.locator('[data-exercise="running"]').click();await finale.waitForFunction(()=>document.querySelector('#score-total').textContent==='1');
  const history=await finaleContext.newPage();await history.clock.setFixedTime(new Date('2026-10-31T12:00:00+01:00'));await history.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:require('node:fs').readFileSync('vendor/supabase-2.116.0.js','utf8')}));await history.goto(origin+'/min-oktober/');await history.locator('#history-state').waitFor({state:'visible'});assert.equal(await history.locator('#total-points').textContent(),'1');
  const day=history.locator('.calendar-day').filter({has:history.locator('.day-number',{hasText:/^31$/})});await day.click();await history.locator('#day-detail').waitFor({state:'visible'});assert.equal(await history.locator('#detail-title').textContent(),'Frestelsernas rike');assert.equal(await history.locator('#day-edit-form').isVisible(),false);
  // First-time OAuth-style account: the Auth user exists, but there is no profile yet.
  const newcomer=await create('Adventure QA Onboarding');sql(`delete from public.profiles where id='${newcomer.user.id}';`);const newbie=await browser.newContext({viewport:{width:320,height:950}});await newbie.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:authKey,session:newcomer});const fresh=await newbie.newPage();fresh.on('pageerror',e=>errors.push(e.message));await fresh.goto(origin+'/adventure/?live=1');await fresh.locator('#adventure-display-name').fill('Adventure QA New');await fresh.locator('.adventure-name-form button').click();await fresh.waitForFunction(()=>document.querySelector('#home-username').textContent==='Adventure QA New');assert(await fresh.locator('#choose-avatar').isVisible());assert(!await fresh.locator('#home-admin').isVisible());
  assert.deepEqual(errors,[]);console.log('PASS: local real Auth + RPC + browser; Sunday homepage/personal welcome and midnight training unlock; server dates/DST/start/end; 60 steps/6 bosses/castle scoring; zero journey points; idempotency; concurrent revisions; undo; private access; stable personal pawn; cross-browser welcome; bonus; elimination; legacy-workout block; reload/multidevice; 4 mobile/desktop widths.');
 }catch(error){console.error('Original test failure:',error.stack);throw error;}finally{
  await browser?.close();if(server){server.kill('SIGTERM');await new Promise(resolve=>{server.on('exit',resolve);setTimeout(resolve,3000);});}
  for(const id of users)await localRequest(stack.api+'/auth/v1/admin/users/'+id,{method:'DELETE',headers});
  sql(prior.clock);
  const b=prior.bonus;if(b)sql(`begin;set local session_replication_role=replica;update public.daily_challenges set updated_at=${quote(b.updated_at)},bonus_description=${b.bonus_description===null?'null':quote(b.bonus_description)},bonus_points=${b.bonus_points??'null'} where challenge_date='2026-10-26';commit;`);else sql("delete from public.daily_challenges where challenge_date='2026-10-26';");
  sql('update private.adventure_settings set enabled='+prior.enabled+';');
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
