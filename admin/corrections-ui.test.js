const { browserOptions } = require('../qa/browser.cjs');
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
const server=http.createServer(async(req,res)=>{try{let file=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(file.endsWith('/'))file+='index.html';const full=path.resolve(root,'.'+file);if(!full.startsWith(root+path.sep))throw Error('Path');const data=await fs.readFile(full);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,...browserOptions()});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let calls=0,forceStale=false;
 let fixture={display_name:'QA deltagare',status:'active',result:null,history:[],bonus_points:0,challenge:{title:'Testpass',description:'15 squats',completion_mode:'or',second_description:'10 000 steg'}};
 await page.exposeFunction('correctionFixtureRPC',async(name,args)=>{
  assert.equal(name,'admin_daily_result');
  if(args.p_action==='save'){
    calls++;
    if(forceStale)return {data:null,error:{code:'40001',message:'Resultatet har ändrats. Ladda om innan du sparar.'}};
    assert.deepEqual(args.p_payload.expected,fixture.result);
    const old=fixture.result;
    fixture.result={multiplier:args.p_payload.multiplier,points:args.p_payload.multiplier===1?1:args.p_payload.multiplier===2?1.5:2,completed_parts:args.p_payload.completed_parts,updated_at:new Date().toISOString()};
    fixture.history.unshift({created_at:new Date().toISOString(),reason:args.p_payload.reason,before_multiplier:old?.multiplier,after_multiplier:fixture.result.multiplier,admin_name:'QA admin'});
  }
  return {data:JSON.parse(JSON.stringify(fixture)),error:null};
 });
 await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({body:''}));
 await page.route('**/elimination.js',route=>route.fulfill({body:''}));
 await page.route('**/admin/admin.js*',route=>route.fulfill({body:
  "document.getElementById('loading-state').hidden=true;document.getElementById('admin-state').hidden=false;window.SoberOctoberAdminCorrections.mount({rpc:window.correctionFixtureRPC},[{participant_id:'qa-user',display_name:'QA deltagare'}]);"
 }));
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:950});await page.goto('http://127.0.0.1:'+server.address().port+'/admin/');
  await page.locator('#correction-user').selectOption('qa-user');
  await page.locator('#correction-details').waitFor({state:'visible'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
  await page.locator('#correction-form').screenshot({path:path.join(require('node:os').tmpdir(),'sober-correction-'+width+'.png')});
 }
 await page.locator('#correction-level').selectOption('2');
 await page.locator('#correction-parts').selectOption('second');
 await page.locator('#correction-reason').fill('Glömde registrera');
 await page.locator('#correction-save').click();await page.locator('#correction-confirmation').waitFor({state:'visible'});
 await page.locator('#correction-cancel').click();assert.equal(calls,0);
 await page.locator('#correction-save').click();await page.locator('#correction-confirm').dblclick();
 await page.waitForFunction(()=>document.getElementById('correction-status').textContent.includes('är sparad'));
 assert.equal(calls,1);assert.equal(fixture.result.points,1.5);assert.deepEqual(fixture.result.completed_parts,['second']);
 assert((await page.locator('#correction-current').textContent()).includes('1,5 poäng'));
 await page.locator('#correction-level').selectOption('3');await page.locator('#correction-reason').fill('Rätt nivå var 3x');
 await page.locator('#correction-save').click();await page.locator('#correction-confirm').click();
 await page.waitForFunction(()=>document.getElementById('correction-current').textContent.includes('3×'));
 assert.equal(fixture.result.points,2);assert.equal(await page.locator('#correction-history li').count(),2);
 forceStale=true;await page.locator('#correction-reason').fill('Ny rättning');
 await page.locator('#correction-save').click();await page.locator('#correction-confirm').click();
 await page.waitForFunction(()=>document.getElementById('correction-status').textContent.includes('ändrats'));
 assert.equal(await page.locator('#correction-save').isEnabled(),false);
 await page.locator('#correction-load').click();await page.locator('#correction-details').waitFor({state:'visible'});
 fixture.status='eliminated';await page.locator('#correction-load').click();
 await page.waitForFunction(()=>document.getElementById('correction-warning').textContent.includes('utslagen'));
 assert.deepEqual(errors,[]);
 console.log('PASS: 320/390/768/1440px, load/create/update, parts, confirmation/cancel, double-click guard, history, stale errors, eliminated warning; no console errors. Fixtures only.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
