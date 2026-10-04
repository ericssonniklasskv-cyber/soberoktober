const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.env.SOBER_TEST_ROOT || path.resolve(__dirname, '..');
const fixture=`
const challenge={challenge_date:'2026-10-01',title:'Testpass',description:'15 squats',base_amount:15,unit:'squats',completion_mode:'or',second_description:'10 000 steg',second_base_amount:10000,second_unit:'steg',bonus_description:'Gör bonusuppgiften',bonus_points:2};
window.fixture={results:[],bonus:[],calls:[],error:null,restored:false,mode:'or'};
const session={user:{id:'fixture-user'}};
const client={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:()=>{}},
from(table){const q={select(){return q},eq(){return q},gte(){return q},lte(){return q},order(){return q},maybeSingle:async()=>({data:{display_name:'Testare'}}),then(resolve,reject){const f=window.fixture;return Promise.resolve({data:table==='daily_results'?f.results:table==='daily_bonus_claims'?f.bonus:table==='daily_challenges'?Array.from({length:4},(_,i)=>({...challenge,challenge_date:'2026-10-0'+(i+1)})):[],error:null}).then(resolve,reject)}};return q},
async rpc(name,args){const f=window.fixture;f.calls.push({name,args});if(name!=='self_daily_result')return {data:[],error:null};if(f.error)return {data:null,error:{message:f.error}};
let result=f.results.find(x=>x.result_date===args.p_date);let bonus=f.bonus.find(x=>x.challenge_date===args.p_date);
if(args.p_action==='save'){const p=args.p_payload;if(p.multiplier){result={result_date:args.p_date,multiplier:p.multiplier,points:[0,1,1.5,2][p.multiplier],completed_parts:p.completed_parts,updated_at:'fixture-time'};f.results=f.results.filter(x=>x.result_date!==args.p_date).concat(result)}if(p.unclaim_bonus){f.bonus=f.bonus.filter(x=>x.challenge_date!==args.p_date);bonus=null}if(p.claim_bonus&&!bonus){bonus={challenge_date:args.p_date,points:2};f.bonus.push(bonus)}}
return {data:{result:result?{multiplier:result.multiplier,points:result.points,completed_parts:result.completed_parts,updated_at:result.updated_at}:null,bonus_points:bonus?.points??null,challenge:{...challenge,completion_mode:f.mode},restored:f.restored},error:null}}
};window.supabase={createClient:()=>client};`;
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.SOBER_BROWSER_PATH ? {executablePath:process.env.SOBER_BROWSER_PATH} : {})});
try {
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.clock.install({time:new Date('2026-10-04T12:00:00+02:00')});
await page.route('**/*',r=>{const u=new URL(r.request().url());
if(u.hostname==='cdn.jsdelivr.net')return r.fulfill({contentType:'application/javascript',body:fixture});
if(u.pathname==='/api/config')return r.fulfill({contentType:'application/json',body:JSON.stringify({supabaseUrl:'https://fixture.invalid',supabasePublishableKey:'fixture'})});
if(u.pathname==='/elimination.js')return r.fulfill({contentType:'application/javascript',body:'window.SoberOctoberEliminations={refresh:async()=>({status:"active"})}'});
const f=path.join(root,u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);
return r.fulfill({contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript',body:fs.existsSync(f)?fs.readFileSync(f,'utf8'):''});});
for(const width of [320,390,768,1440]){
await page.setViewportSize({width,height:900});await page.goto('https://fixture.invalid/min-oktober/');await page.locator('#history-state').waitFor({state:'visible'});
assert.equal(await page.locator('#history-calendar button').count(),4);
await page.locator('#history-calendar button').first().click();await page.locator('#day-edit-fields').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#day-edit-fields').disabled);
assert((await page.locator('#detail-description').textContent()).includes('10 000 steg'));
await page.locator('#day-edit-bonus').check();await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#day-edit-status').textContent.includes('Sparat!'));
assert.equal(await page.locator('#detail-level').textContent(),'Inte registrerat');
await page.locator('#day-edit-level').selectOption('2');await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#detail-level').textContent==='2×');
assert.equal(await page.locator('#detail-points').textContent(),'1,5 poäng');assert.equal(await page.locator('#total-points').textContent(),'3,5');
await page.locator('#day-edit-level').selectOption('3');await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#detail-level').textContent==='3×');
assert.equal(await page.locator('#total-points').textContent(),'4');assert.equal(await page.evaluate(()=>fixture.results.length),1);assert.equal(await page.evaluate(()=>fixture.bonus.length),1);
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
assert(await page.locator('#day-detail').evaluate(e=>e.scrollWidth<=e.clientWidth),'dialog overflow '+width);
if(process.env.SOBER_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.SOBER_SCREENSHOT_DIR,'correction-'+width+'.png'),fullPage:true});
await page.locator('#detail-close').click();await page.locator('#history-calendar button').first().click();await page.waitForFunction(()=>!document.querySelector('#day-edit-fields').disabled);
assert.equal(await page.locator('#day-edit-level').inputValue(),'3');
await page.locator('#day-edit-bonus').uncheck();await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#total-points').textContent==='2');
assert.equal(await page.locator('#detail-level').textContent(),'3×');assert.equal(await page.locator('#detail-bonus').isVisible(),false);
await page.locator('#day-edit-bonus').check();await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#total-points').textContent==='4');
assert.equal(await page.evaluate(()=>fixture.bonus.length),1);
await page.evaluate(()=>fixture.error='Resultatet har ändrats. Öppna dagen igen innan du sparar.');await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#day-edit-status').textContent.includes('Resultatet har ändrats'));
assert.equal(await page.locator('#day-edit-save').isDisabled(),false);
console.log('PASS '+width+'px: bonus before result, missing day, upgrade, total refresh, reopen, conflict, overflow');
}
await page.locator('#detail-close').click();await page.evaluate(()=>{fixture.error=null;fixture.mode='and';fixture.restored=true});await page.locator('#history-calendar button').nth(1).click();await page.waitForFunction(()=>!document.querySelector('#day-edit-fields').disabled);
await page.locator('#day-edit-level').selectOption('1');await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#day-edit-status').textContent.includes('aktiv i tävlingen igen'));
assert.deepEqual(await page.evaluate(()=>fixture.calls.filter(x=>x.args?.p_action==='save').at(-1).args.p_payload.completed_parts),['first','second']);
assert.deepEqual(errors,[]);console.log('PASS and-parts, restoration feedback, no JavaScript errors. Fixtures only.');
} finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
