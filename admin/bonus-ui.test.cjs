const { chromium } = require('playwright'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path');
const { tmpdir } = require('node:os');
const { browserOptions } = require('../qa/browser.cjs');
const root = path.resolve(__dirname,'..');
(async()=>{
  const server=http.createServer(async(req,res)=>{try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(root+path.sep))throw Error('Denied');
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
  }catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true,...browserOptions()});
    const page=await browser.newPage();const errors=[],writes=[];let admin=true;
    const saved=new Map();
    await page.exposeFunction('adminFixtureRead',()=>({data:[...saved.values()],error:null}));
    await page.exposeFunction('adminFixtureProfile',()=>({data:{display_name:'QA admin',is_admin:admin},error:null}));
    await page.exposeFunction('adminFixtureSave',payload=>{writes.push(payload);saved.set(payload.challenge_date,payload);return {data:payload,error:null};});
    await page.route('**/api/config',route=>route.fulfill({json:{supabaseUrl:'http://127.0.0.1:54321',supabasePublishableKey:'fixture'}}));
    await page.route('**/elimination.js',route=>route.fulfill({body:''}));await page.route('**/admin/corrections.js',route=>route.fulfill({body:''}));
    await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'qa'}}}}),onAuthStateChange:()=>({}),signOut:async()=>({})},rpc:async()=>({data:[],error:null}),from:table=>({select:()=>table==='profiles'?{eq:()=>({single:window.adminFixtureProfile})}:{gte:()=>({lte:()=>({order:window.adminFixtureRead})})},upsert:payload=>({select:()=>({single:()=>window.adminFixtureSave(payload)})})})})};` }));
    page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-12T12:00:00+02:00'));
    const origin='http://127.0.0.1:'+server.address().port;await page.goto(origin+'/admin/');
    await page.locator('#admin-state').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#challenge-date').value==='2026-10-12');
    assert.equal(await page.locator('#challenge-title').isVisible(),false);
    assert.equal(await page.locator('#challenge-title').isDisabled(),true);
    assert.equal(await page.locator('#completion-mode').isVisible(),false);
    await page.locator('#bonus-description').fill('Dagens testbonus');
    await page.locator('#challenge-form [type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#form-status').textContent==='Bonusen är sparad.');
    assert.equal(writes.length,1);assert.equal(writes[0].bonus_points,1);assert.equal(writes[0].base_amount,null);
    assert.equal(await page.locator('#challenge-title').isDisabled(),true,'Workout stays disabled after save');
    await page.reload();await page.waitForFunction(()=>document.querySelector('#bonus-description').value==='Dagens testbonus');
    const dir=await fs.mkdtemp(path.join(tmpdir(),'admin-roulette-bonus-'));
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:950});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await page.locator('#challenge-editor').screenshot({path:path.join(dir,'bonus-'+width+'.png')});}
    await page.locator('[data-date="2026-10-18"]').click();assert.equal(await page.locator('#challenge-title').isVisible(),false);
    await page.locator('[data-date="2026-10-19"]').click();assert.equal(await page.locator('#challenge-title').isVisible(),false);assert.equal(await page.locator('#challenge-title').isDisabled(),true);
    assert.match(await page.locator('#existing-status').textContent(),/Röstvecka/);
    await page.locator('#bonus-description').fill('Måndagens röstbonus');await page.locator('#bonus-points').fill('2');await page.locator('#challenge-form [type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#form-status').textContent==='Bonusen är sparad.');
    assert.equal(writes.length,2);assert.equal(writes[1].title,'Dagens val');assert.equal(writes[1].base_amount,null);assert.equal(writes[1].bonus_points,2);
    await page.reload();await page.locator('#admin-state').waitFor({state:'visible'});await page.locator('[data-date="2026-10-19"]').click();assert.equal(await page.locator('#bonus-description').inputValue(),'Måndagens röstbonus');
    await page.locator('[data-date="2026-10-25"]').click();assert.equal(await page.locator('#challenge-title').isVisible(),false);
    await page.locator('[data-date="2026-10-26"]').click();assert.equal(await page.locator('#challenge-title').isVisible(),true);assert.equal(await page.locator('#challenge-title').isEnabled(),true);
    await page.locator('#challenge-form [type="submit"]').click();assert.equal(writes.length,2,'Normal workout still needs a title');
    await page.locator('[data-date="2026-10-11"]').click();assert.equal(await page.locator('#challenge-title').isVisible(),false,'Bingo retains bonus-only editing');
    admin=false;await page.reload();await page.locator('#denied-state').waitFor({state:'visible'});assert.equal(await page.locator('#challenge-form').isVisible(),false);
    assert.deepEqual(errors,[]);console.log('PASS: actual admin form saves/reloads bonus-only dates without a workout, keeps normal validation after the theme, admin access and responsive layouts. Screenshots: '+dir);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
