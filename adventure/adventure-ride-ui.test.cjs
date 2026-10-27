/* Actual connected adapter + real page assets, isolated RPC fixtures; no service writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{browserOptions}=require('../qa/browser.cjs');
const root=path.resolve(__dirname,'..'),published=process.argv.includes('--published'),assetBase=process.env.ADVENTURE_ASSET_BASE||'https://www.soberoktober.se';
const stub=`(()=>{
 const G=window.SoberAdventure,o=new URLSearchParams(location.search),storeKey='ride-test-state';
 let saved=localStorage.getItem(storeKey),state;
 if(saved)state=G.restore(saved);else{state=G.createState();while(G.progress(state).position<Number(o.get('position')||27)){const b=G.progress(state).pendingBoss;state=b?G.resolveBoss(state,b.id,b.choices[0].id,'2026-10-26'):G.progress(state).position===21&&!state.shortcutChoice?G.chooseShortcut(state,'take','2026-10-26'):G.record(state,'squats','2026-10-26');}}
 let revision=10,lost=false,calls=[],writes=0;
 const data=()=>({state,revision,today:'2026-10-26',active:true,enabled:true,profile:{id:'10000000-0000-4000-8000-000000000001',name:'Testaren',pawn_id:o.get('pawn')||'nillebae',mount_index:0,status:'active',welcome_seen:true,icecream_seen:true},players:[{id:'10000000-0000-4000-8000-000000000001',name:'Testaren',pawn_id:o.get('pawn')||'nillebae',mount_index:0,position:G.progress(state).position}],standings:[],activity:[],previous_activity:[],bonus:null});
 const requests=new Map();
 window.rideQA={calls,get writes(){return writes},get state(){return state},externalChoice(choice){state=G.chooseRide(state,choice,'2026-10-26');revision++;localStorage.setItem(storeKey,JSON.stringify(state));}};
 const client={auth:{async getSession(){return{data:{session:{user:{id:data().profile.id}}}}},onAuthStateChange(){}},from(){return{select(){return{eq(){return{async maybeSingle(){return{data:{id:data().profile.id,display_name:'Testaren'}}}}}}}}},rpc(name,args){return{async abortSignal(){
  if(name!=='my_adventure')throw Error('Unexpected RPC');const a=args.p_action,p=args.p_payload;calls.push({a,...p});
  if(p.shortcut_version!==1||p.ride_version!==1)throw Error('Missing client shortcut version');
  if(a==='get')return{data:data()};
  if(requests.has(p.request_id))return{data:data()};
  if(Number(p.expected_revision)!==revision)return{error:{code:'40001',message:'Din resa har ändrats i en annan flik.'}};
  if(a==='ride'){
   if(o.get('slow'))await new Promise(r=>setTimeout(r,350));
   state=G.chooseRide(state,p.choice,'2026-10-26');writes++;
  }else if(a==='exercise'){if(G.progress(state).position===28&&!state.rideChoice)throw Error('Must choose path first');state=G.record(state,p.exercise_id,'2026-10-26');}
  else if(a==='undo')state=G.undo(state);else throw Error('Unexpected mutation '+a);
  revision++;requests.set(p.request_id,true);localStorage.setItem(storeKey,JSON.stringify(state));
  if(a==='ride'&&o.get('lost')&&!lost){lost=true;throw Error('Tappat svar efter sparat val');}
  return{data:data()};
 }}}};window.supabase={createClient:()=>client};})();`;
(async()=>{const browser=await chromium.launch({headless:true,...browserOptions()});try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],cache=new Map();if(process.env.ADVENTURE_PREVIEW_SHARE){const access=await page.request.get(process.env.ADVENTURE_PREVIEW_SHARE);assert(access.ok(),'Access to staged build');}page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());assert.equal(u.hostname,'ride-fixture.invalid');assert.equal(route.request().method(),'GET');
  if(u.pathname==='/api/config')return route.fulfill({json:{adventureEnabled:true,supabaseUrl:'https://fixture.invalid',supabasePublishableKey:'fixture'}});
  if(u.pathname.startsWith('/vendor/'))return route.fulfill({contentType:'text/javascript',body:stub});
  if(u.pathname==='/favicon.ico')return route.fulfill({status:204});
  const file=u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname;
  if(published){if(!cache.has(file)){const r=await route.fetch({url:assetBase+file});assert(r.ok(),file);const body=await r.body();assert.deepEqual(body,fs.readFileSync(path.join(root,file)));cache.set(file,{body,contentType:r.headers()['content-type']});}return route.fulfill(cache.get(file));}
  return route.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/webp'});
 });
 const reset=async(query='')=>{await page.goto('https://ride-fixture.invalid/adventure/?live=1'+query);await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('.map-tile').first().waitFor();};
 for(const width of [320,390,768,1440])for(const choice of ['take','keep']){
  await page.setViewportSize({width,height:900});await reset('&slow=1');assert(!await page.locator('#ride-dialog').isVisible());await page.locator('[data-exercise=squats]').click();await page.locator('#ride-dialog').waitFor({state:'visible'});
  assert(await page.locator('[data-exercise=squats]').isDisabled());assert(!await page.locator('#home-admin').isVisible());assert(await page.locator('#topplista').isVisible());
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await page.locator('#ride-dialog').screenshot({path:'/private/tmp/ride-live-choice-'+width+'.png'});
  await page.locator(choice==='take'?'#accept-ride':'#decline-ride').click();assert(await page.locator('#accept-ride').isDisabled());assert(await page.locator('#decline-ride').isDisabled());await page.keyboard.press('Escape');assert(await page.locator('#ride-dialog').isVisible());
  await page.locator('#ride-dialog').filter({has:page.locator(choice==='take'?'#ride-reward:visible':'#ride-kept-reward:visible')}).waitFor();
  assert.equal(await page.evaluate(()=>rideQA.writes),1);assert.equal(await page.evaluate(()=>SoberAdventure.progress(rideQA.state).position),choice==='take'?29:28);assert.equal(await page.evaluate(()=>SoberAdventure.scoreTotals(rideQA.state).points),0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('#ride-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);
  if(choice==='keep')assert.match(await page.locator('#ride-kept-reward').innerText(),/Du missade en gratis extraruta/);assert.equal(await page.locator('#ride-strangers svg').count(),1);await page.locator('#ride-dialog').screenshot({path:'/private/tmp/ride-live-'+choice+'-'+width+'.png'});await page.locator('#ride-done').click();await page.reload();await page.locator('.map-tile').first().waitFor();await page.waitForTimeout(200);assert(!await page.locator('#ride-dialog').isVisible());
  await page.locator('#undo-last').click();assert.equal(await page.evaluate(()=>rideQA.state.rideChoice),choice);await page.locator('[data-exercise=running]').click();await page.waitForTimeout(180);assert(!await page.locator('#ride-dialog').isVisible());assert.equal(await page.evaluate(()=>SoberAdventure.progress(rideQA.state).position),choice==='take'?29:28);assert.equal(await page.evaluate(()=>Object.values(rideQA.state.stepCredits).filter(n=>n===1).length),choice==='take'?2:1);
 }
 // Closing an unanswered popup lets the player return through the in-game gate.
 await reset('&position=28');await page.locator('#ride-dialog').waitFor();await page.keyboard.press('Escape');await page.waitForTimeout(200);assert(!await page.locator('#ride-dialog').isVisible());await page.locator('#open-ride').click();await page.locator('#decline-ride').click();await page.locator('#ride-kept-reward').waitFor();await page.locator('#ride-close').click();
 // A response lost after the write retries the exact request ID and cannot switch routes.
 await reset('&position=28&lost=1');await page.locator('#ride-dialog').waitFor();await page.locator('#accept-ride').click();await page.locator('#ride-error').waitFor();assert(await page.locator('#decline-ride').isDisabled());await page.locator('#accept-ride').click();await page.locator('#ride-reward').waitFor();assert.equal(await page.evaluate(()=>rideQA.writes),1);const ids=await page.evaluate(()=>rideQA.calls.filter(c=>c.a==='ride').map(c=>c.request_id));assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);await page.locator('#ride-close').click();
 // A choice made by a second device wins over this stale popup, with no second award.
 await reset('&position=28');await page.locator('#ride-dialog').waitFor();await page.evaluate(()=>rideQA.externalChoice('keep'));await page.locator('#accept-ride').click();await page.locator('#ride-kept-reward').waitFor();assert.equal(await page.evaluate(()=>rideQA.writes),0);assert.equal(await page.evaluate(()=>SoberAdventure.progress(rideQA.state).position),28);
 // Every personal pawn and the fallback appear correctly, without an API carrying image data.
 for(const pawn of ['mikeb','jerka','zellmani','elliott-da-bomb','nillebae','guest']){await page.locator('#ride-close').click();await reset('&position=28&pawn='+pawn);await page.locator('#ride-dialog').waitFor();if(pawn==='guest')assert.equal(await page.locator('#ride-pawn svg').count(),1);else assert.match(await page.locator('#ride-pawn img').getAttribute('src'),new RegExp(pawn+'\\.webp$'));}
 assert.deepEqual(errors,[]);console.log('PASS connected ride: both saved choices, 320/390/768/1440, reload/undo/independent bonus-credit caps, slow/double interactions, lost response idempotency, stale second-device decision, all pawns, gate reopening, zero points, real connected adapter. '+(published?'Published bytes match.':'Fixtures only.'));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
