/* Final approach preview: real asset rendering and sequential popups, never a real account. */
const assert=require('node:assert/strict'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const {chromium}=require('playwright'),{browserOptions}=require('../qa/browser.cjs');
(async()=>{let child,browser;try{
 const root=path.resolve(__dirname,'..'),probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 child=spawn(process.execPath,['scripts/dev-adventure.mjs'],{cwd:root,env:{...process.env,ADVENTURE_PORT:String(port)},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>{if(code)reject(Error('Preview server failed '+code));});});
 const origin='http://127.0.0.1:'+port,url=origin+'/adventure/final-approach-preview.html';
 browser=await chromium.launch({headless:true,...browserOptions()});const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[],responses=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());assert.equal(new URL(r.url()).origin,origin);assert.equal(r.method(),'GET');});page.on('response',r=>{if(r.status()>=400)responses.push(r.status()+' '+r.url());});
 const snapshot=()=>page.evaluate(()=>FinalApproachPreview.snapshot());
 async function layout(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page has no horizontal overflow');assert(await page.locator('#greeting-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth),'Dialog has no horizontal overflow');for(const button of await page.locator('#greeting-dialog button').all()){const box=await button.boundingBox();assert(box.width>=44&&box.height>=44,'Touch controls are at least 44px');}assert(await page.locator('#greeting-speech').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=17),'Speech is readable');assert(await page.locator('#greeting-dialog').evaluate(d=>d.offsetHeight<=innerHeight-18),'Dialog fits the viewport vertically');}
 const bosses=['troll','witch','dragon','sphinx','kraken'];
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto(url);await page.locator('#greeting-dialog').waitFor({state:'visible'});
  assert.deepEqual(await snapshot(),{position:55,active:55,seen:[55],pawn:'nillebae'});
  for(let i=0;i<5;i++){
   assert.equal(await page.locator('#greeting-dialog').getAttribute('data-boss'),bosses[i]);assert.equal(await page.locator('#scene-boss [data-boss-sprite]').getAttribute('data-boss-sprite'),bosses[i]);assert.equal(await page.locator('#greeting-speech p').count(),2);assert.match(await page.locator('#greeting-count').textContent(),new RegExp('HÄLSNING '+(i+1)+' AV 5'));assert.equal((await snapshot()).position,55+i);assert.match(await page.locator('.greeting-copy').textContent(),/Mästare Nillebae/);assert.doesNotMatch(await page.locator('.greeting-copy').textContent(),/utvalde|\{\{master\}\}/);await layout();await page.locator('#scene-pawn img').evaluate(img=>img.decode());
   if(width===390||width===1440)await page.locator('#greeting-dialog').screenshot({path:'/private/tmp/final-approach-'+bosses[i]+'-'+width+'.png'});
   await page.locator('#greeting-continue').click();assert(await page.locator('#greeting-dialog').isHidden());await page.locator('#next-step').click();
  }
  assert.equal((await snapshot()).position,60);assert.deepEqual((await snapshot()).seen,[55,56,57,58,59]);assert(await page.locator('#next-step').isDisabled());assert(await page.locator('#greeting-dialog').isHidden());assert.match(await page.locator('#journey-status').textContent(),/En sista boss kvar/);
  await page.screenshot({path:'/private/tmp/final-approach-map-'+width+'.png',fullPage:true});
  // Reading an old greeting is explicitly allowed without moving the test pawn.
  await page.locator('[data-tile="55"]').click();assert.equal((await snapshot()).position,60);assert.equal((await snapshot()).seen.length,5);await page.keyboard.press('Escape');assert(await page.locator('#greeting-dialog').isHidden());await page.waitForFunction(()=>document.activeElement?.matches('.stop[data-tile="55"]'));
  await page.locator('#replay').click();assert.deepEqual(await snapshot(),{position:54,active:null,seen:[],pawn:'nillebae'});await page.locator('#next-step').evaluate(b=>{b.click();b.click();});assert.equal((await snapshot()).position,55);assert.equal(await page.locator('dialog[open]').count(),1);await page.keyboard.press('Escape');
 }
 // Personal art and standard fallback can all be previewed and retain position.
 await page.setViewportSize({width:390,height:900});await page.goto(url);await page.locator('#greeting-close').click();
 for(const pawn of ['mikeb','jerka','zellmani','elliott-da-bomb','nillebae','guest']){
  await page.locator('#pawn-picker').selectOption(pawn);await page.locator('[data-tile="55"]').click();if(pawn==='guest')assert.equal(await page.locator('#scene-pawn svg').count(),1);else {assert.equal(await page.locator('#scene-pawn img').getAttribute('src'),'/adventure/assets/players/'+pawn+'.webp');await page.locator('#scene-pawn img').evaluate(img=>img.decode());}assert.equal((await snapshot()).position,55);const name=pawn==='guest'?'Äventyraren':await page.locator('#pawn-picker option:checked').textContent();assert((await page.locator('#greeting-title').textContent()).includes('Mästare '+name));await page.locator('#greeting-close').click();
 }
 // Keyboard path, readable final salutation, replay and reload remain preview-only.
 await page.locator('[data-tile="59"]').focus();await page.keyboard.press('Enter');assert.match(await page.locator('#greeting-title').textContent(),/soktoberian/);await page.keyboard.press('Escape');await page.locator('#next-step').focus();await page.keyboard.press('Enter');assert.equal((await snapshot()).position,56);await page.keyboard.press('Escape');await page.reload();assert.equal((await snapshot()).position,55);assert.equal((await snapshot()).pawn,'guest');
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(requests.filter(u=>/\/api\/|supabase|\/audio\//.test(u)).length,0);assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);
 console.log('PASS final approach: five sequential greetings on 55–59, existing boss sprites, all 6 pawns, 320/390/768/1440, readable dialogue, 44px controls, no overflow, keyboard and focus return, manual rereading without movement, no double-step, castle stays at 60, reset/reload isolated, zero API/audio/storage writes.');
 }finally{if(browser)await browser.close();child?.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
