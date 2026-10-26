/* Browser regression for sequential card previews; all account/game data is a fixture. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{browserOptions}=require('../qa/browser.cjs');
const root=path.resolve(__dirname,'..'),published=process.argv.includes('--published');
const fixture=`
const G=window.SoberAdventure;
let apply;
const data={state:G.createState(),today:'2026-10-25',active:false,profile:{id:'boss-card-fixture',name:'Testare',pawn_id:null,mount_index:0,status:'active',welcome_seen:true},players:[]};
const syncPlayers=()=>{data.players=[{id:data.profile.id,name:'Testare',position:G.progress(data.state).position,pawn_id:null,mount_index:0},{id:'other-fixture',name:'Annan deltagare',position:G.BOSSES[3].position,pawn_id:null,mount_index:1}];};
const redraw=()=>{syncPlayers();apply?.(data);};
const R={data,busy:false,bind:fn=>apply=fn,welcome:()=>false,home:{init(){},render(){},resetParticipant(){}},
async commit(action,p={}){if(action==='boss')data.state=G.resolveBoss(data.state,p.boss_id,p.choice_id,data.today);else if(action==='exercise')data.state=G.progress(data.state).pointsUnlocked?G.recordScore(data.state,p.exercise_id,data.today):G.record(data.state,p.exercise_id,data.today);else if(action==='undo')data.state=G.undo(data.state);redraw();return true;}};
syncPlayers();window.AdventureConnection=Promise.resolve(R);
window.bossQA={data,set(completed,atGate=false,day='2026-10-26'){
 let s=G.createState();for(let b=0;b<completed;b++){for(let n=0;n<(b<2?6:12);n++)s=G.record(s,'squats','2026-10-26');s=G.resolveBoss(s,G.BOSSES[b].id,G.BOSSES[b].choices[0].id,b===5?'2026-10-31':'2026-10-26');}
 if(atGate&&completed<6)for(let n=0;n<(completed<2?6:12);n++)s=G.record(s,'squats','2026-10-26');
 data.state=s;data.today=day;data.active=day>='2026-10-26'&&day<='2026-10-31';redraw();
}};`;
(async()=>{
 const browser=await chromium.launch({headless:true,...browserOptions(),args:['--mute-audio']});
 try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[],cache=new Map();
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());assert.equal(url.hostname,'boss-card-fixture.invalid');assert.equal(route.request().method(),'GET','The test never writes to a real service');
  if(url.pathname==='/adventure/adventure-live.js')return route.fulfill({contentType:'text/javascript',body:fixture});
  if(url.pathname==='/favicon.ico')return route.fulfill({status:204});
  const relative=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  if(published){
   const key=relative+url.search;
   if(!cache.has(key)){
    const response=await route.fetch({url:'https://www.soberoktober.se'+key});assert(response.ok(),'Published asset: '+key);
    const body=await response.body();assert.deepEqual(body,fs.readFileSync(path.join(root,relative)),'Published asset matches tested source: '+relative);
    cache.set(key,{contentType:response.headers()['content-type'],body});
   }
   return route.fulfill(cache.get(key));
  }
  const file=path.join(root,relative);assert(file.startsWith(root+path.sep));
  return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':'audio/mp4',body:fs.readFileSync(file)});
 });
 const ids=['troll','witch','dragon','sphinx','kraken','final'];
 const closeDetails=()=>page.locator('[data-close=detail-dialog]').click();
 const openTile=async id=>{await page.locator('.map-tile[data-boss='+id+']').press('Enter');return page.locator('[data-open-boss='+id+']');};
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('https://boss-card-fixture.invalid/adventure/?live=1');await page.waitForSelector('.map-tile');
  const before=await page.evaluate(()=>JSON.stringify(bossQA.data.state));
  for(let i=0;i<ids.length;i++){
   assert(await page.locator('.map-tile[data-boss='+ids[i]+']').evaluate(n=>!n.hidden&&getComputedStyle(n).backgroundImage!=='none'),'Boss portrait stays visible');
   const button=await openTile(ids[i]);assert.equal(await button.isDisabled(),i!==0,'Only Orc can be previewed before training starts');
   if(i===0){await button.click();assert.match(await page.locator('#boss-dialog-title').textContent(),/Öl-Orcen/);assert.equal(await page.locator('#defeat-boss').count(),0,'Preview cannot complete a boss before reaching it');await page.locator('[data-close=boss-dialog]').click();}
   else{await button.evaluate(n=>{n.disabled=false;n.click();});assert.equal(await page.locator('#boss-dialog').evaluate(n=>n.open),false,'Central guard rejects forced future card');}
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(bossQA.data.state)),before,'Previews do not change progress or points');
  await page.locator('.map-pawn[data-player=other-fixture]').click();assert(await page.locator('[data-open-boss=sphinx]').isDisabled(),'Another participant on a future boss cannot unlock it');await closeDetails();
  await page.locator('#show-chapters').click();assert.equal(await page.locator('.chapter-entry .boss-art').count(),6);await closeDetails();
  for(let completed=0;completed<6;completed++){
   await page.evaluate(k=>bossQA.set(k,true,k===5?'2026-10-31':'2026-10-26'),completed);
   for(let i=0;i<6;i++){const button=await openTile(ids[i]);assert.equal(await button.isDisabled(),i!==completed,'Only next unbeaten boss card is enabled');await closeDetails();}
   const button=await openTile(ids[completed]);await button.click();assert(await page.locator('#defeat-boss').isEnabled());await page.locator('#defeat-boss').click();
   assert.equal(await page.locator('#boss-dialog').getAttribute('data-mode'),completed===5?'finale':'victory','Card guard preserves victory flow after saving');await page.locator('[data-close=boss-dialog]').click();
   assert(await (await openTile(ids[completed])).isDisabled(),'Defeated card is closed');await closeDetails();
  }
  await page.evaluate(()=>bossQA.set(5,true,'2026-10-30'));
  let final=await openTile('final');assert(await final.isDisabled());assert.match(await final.textContent(),/31 oktober/);await closeDetails();
  assert(await page.locator('[data-exercise=squats]').isEnabled(),'Final date lock does not block existing scoring');
  await page.evaluate(()=>bossQA.set(5,true,'2026-10-31'));final=await openTile('final');assert(await final.isEnabled());await closeDetails();
  // A stale enabled button must not reveal a card after a synced undo from another device.
  await page.evaluate(()=>bossQA.set(1));await openTile('witch');await page.evaluate(()=>bossQA.set(0));await page.locator('[data-open-boss=witch]').click();assert.equal(await page.locator('#boss-dialog').evaluate(n=>n.open),false);
  await page.evaluate(()=>bossQA.set(1));await(await openTile('witch')).click();await page.evaluate(()=>bossQA.set(0));assert.equal(await page.locator('#boss-dialog').evaluate(n=>n.open),false,'Synced undo closes obsolete card');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
 }
 assert.deepEqual(errors,[]);console.log('PASS sequential boss cards: all six visible; next only; completed/future/forced/other-pawn/stale routes blocked; preview cannot complete; all six victories; final date/scoring preserved; synced undo; 320/390/768/1440. '+(published?'Published assets verified.':'Fixtures only.'));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
