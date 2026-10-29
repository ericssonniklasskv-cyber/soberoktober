const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),requireProject=require('node:module').createRequire(root+'/package.json');
const {chromium}=requireProject('playwright');
(async()=>{
 const base='https://www.soberoktober.se';
 const config=await fetch(base+'/api/config',{cache:'no-store'}).then(r=>{assert(r.ok);return r.json();});
 assert.equal(config.supabaseUrl,'https://usbcwnirgkkfmluukria.supabase.co');assert.equal(config.adventureEnabled,true);assert.equal(config.adventureLocalPreview,undefined);assert(new Date(config.serverTime)>new Date('2026-10-25T00:00:00Z'));
 const paths=['/adventure/assets/','/adventure/assets/players/','/adventure/audio/'].flatMap(dir=>fs.readdirSync(root+dir).filter(n=>/\.(webp|m4a)$/.test(n)&&n!=='strange-traveller.webp').map(n=>dir+n));
 for(const url of paths){const r=await fetch(base+url);assert(r.ok,url);assert.match(r.headers.get('content-type'),url.endsWith('.webp')?/image\/webp/:/audio\/(mp4|x-m4a)/);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(root+url)).digest('hex'),url);}
 const range=await fetch(base+'/adventure/audio/beer-orc.m4a',{headers:{Range:'bytes=0-1'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,2);
 for(const hidden of ['/adventure/final-approach-preview.html','/adventure/final-approach-preview.js','/adventure/ride-return-preview.html','/adventure/ride-return-preview.js','/adventure/assets/strange-traveller.webp','/adventure/assets/enchanted-icecream.png','/adventure/icecream-trap-preview.html','/adventure/icecream-trap-preview.js','/adventure/ride-preview.html','/adventure/ride-preview.js','/qa/adventure-production-read-audit.json','/supabase/migrations/20261025202041_prepare_final_adventure.sql','/adventure/AGENTS.md','/.env.local'])assert.equal((await fetch(base+hidden)).status,404,hidden);
 const browser=await chromium.launch({headless:true,...require('./browser.cjs').browserOptions()});
 try{
  const errors=[];const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:950});await page.goto(base+'/');await page.waitForURL('**/adventure/?live=1');await page.locator('#adventure-login-button').waitFor({state:'visible'});assert.match(await page.locator('#adventure-login-message').textContent(),/Logga in/);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(require('node:os').tmpdir(),'adventure-live-login-'+width+'.png'),fullPage:true});}
  await page.setContent('<button id="play">Spela ljud</button><audio id="voice"></audio>');
  for(const url of paths.filter(x=>x.endsWith('.m4a'))){await page.evaluate(url=>{const a=document.querySelector('audio');a.src=url;document.querySelector('#play').onclick=()=>a.play();},base+url);await page.locator('#play').click();await page.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused&&a.currentTime>0.05&&a.duration>10;});await page.evaluate(()=>document.querySelector('audio').pause());}
  assert.deepEqual(errors,[]);console.log('PASS production: correct Supabase, enabled homepage now; root redirect + login at 320/390/768/1440; all runtime images and 7 audio files match release bytes; actual AAC playback of all 7; HTTP byte ranges; internal files excluded; no browser errors. No exercise data submitted.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
