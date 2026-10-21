const { chromium } = require('playwright');
const { browserOptions } = require('./browser.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixture = `
const session={user:{id:'history-vote-user'}};
window.fixture={...JSON.parse(sessionStorage.getItem('history-vote-fixture')||'{"completions":{},"bonus":[]}'),calls:[],fail:false,failBonus:false,delay:0};
const persist=()=>sessionStorage.setItem('history-vote-fixture',JSON.stringify({completions:fixture.completions,bonus:fixture.bonus}));
const challenge=date=>({challenge_date:date,title:'Dagens val',description:null,base_amount:null,unit:null,completion_mode:'single',bonus_description:'Gör bonusuppgiften',bonus_points:2});
const state=()=>({today:'2026-10-21',now:'2026-10-21T12:00:00+02:00',can_vote:true,days:Array.from({length:7},(_,i)=>{
 const date='2026-10-'+(19+i);return {date,options:[{id:0,title:'3 × 15 squats',description:'3 set med 15 squats',votes:1}],result:i<3?{option_id:0}:null,completion:fixture.completions[date]||null};
})});
const client={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:cb=>{window.fixtureAuth=cb;}},
 from(table){const q={select(){return q},eq(){return q},gte(){return q},lte(){return q},order(){return q},maybeSingle:async()=>({data:{display_name:'Testare'}}),then(resolve,reject){return Promise.resolve({data:table==='daily_bonus_claims'?fixture.bonus:table==='daily_challenges'?[challenge('2026-10-20')]:[],error:null}).then(resolve,reject)}};return q;},
 async rpc(name,args={}){fixture.calls.push({name,args});
  if(name==='my_competition_bingo')return {data:{enabled:false,completed_cells:{},repeat_dates:[]},error:null};
  if(name==='my_workout_vote'){
   if(!args.p_action&&fixture.blockRead){await new Promise(resolve=>window.releaseHistoryRead=resolve);fixture.finishedRead=true;}
   if(args.p_action==='save_result'){
    if(fixture.delay)await new Promise(resolve=>setTimeout(resolve,fixture.delay));
    if(fixture.fail)return {error:{message:'Resultatet kunde inte sparas.'}};
    if(args.p_date>'2026-10-21')return {error:{message:'Framtida dag.'}};
    const kind={1:'workout',2:'steps'}[args.p_option];
    if(!kind)delete fixture.completions[args.p_date];
    else if(fixture.completions[args.p_date]?.kind!==kind)fixture.completions[args.p_date]={kind,points:kind==='steps'?1:3,completed_at:'fixture-stable-time'};
    persist();
   }return {data:state(),error:null};
  }
  if(name==='self_daily_result'){
   if(args.p_date!=='2026-10-20')return {error:{code:'22023',message:'Datumet saknar ett publicerat pass.'}};
   if(args.p_action==='save'){
    if(fixture.failBonus)return {error:{message:'Bonusen har ändrats i en annan vy.'}};
    if(args.p_payload.claim_bonus&&!fixture.bonus.length)fixture.bonus.push({challenge_date:args.p_date,points:2});
    if(args.p_payload.unclaim_bonus)fixture.bonus=[];persist();
   }
   return {data:{result:null,bonus_points:fixture.bonus[0]?.points??null,challenge:challenge(args.p_date)},error:null};
  }
  return {data:[],error:null};
 }
};window.supabase={createClient:()=>client};`;
(async () => {
  const browser = await chromium.launch({ headless:true, ...browserOptions() });
  try {
    const page = await browser.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-10-21T12:00:00+02:00')});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:fixture});
      if(url.pathname==='/api/config')return route.fulfill({json:{supabaseUrl:'https://fixture.invalid',supabasePublishableKey:'fixture',votingEnabled:true}});
      if(url.pathname==='/elimination.js')return route.fulfill({body:'window.SoberOctoberEliminations={refresh:async()=>({status:"active"})}'});
      const file=path.join(root,url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname);
      return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript',body:fs.existsSync(file)?fs.readFileSync(file,'utf8'):''});
    });
    const open = async day => {
      await page.locator('#history-calendar button').filter({has:page.locator('.day-number',{hasText:new RegExp('^'+day+'$')})}).click();
      await page.waitForFunction(()=>!document.querySelector('#day-edit-fields').disabled);
    };
    const save = async points => {
      await page.locator('#day-edit-save').click();
      await page.waitForFunction(()=>document.querySelector('#day-edit-status').textContent.startsWith('Sparat!'));
      await page.waitForFunction(points=>document.querySelector('#total-points').textContent===points,points);
    };
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      await page.goto('https://fixture.invalid/min-oktober/');
      await page.locator('#history-state').waitFor({state:'visible'});
      await open(20);
      assert.deepEqual(await page.locator('#day-edit-level option').allTextContents(),['Inte registrerat','Dagens pass · 3 poäng','10 000 steg · 1 poäng']);
      await page.locator('#day-edit-level').selectOption('steps');await save('1');
      assert.equal(await page.locator('#detail-points').textContent(),'1 poäng');assert.equal(await page.locator('#completed-days').textContent(),'1');
      await page.locator('#day-edit-bonus').check();await save('3');
      assert.equal(await page.locator('#detail-bonus').textContent(),'Bonuspoäng: 2');
      await page.reload();await page.locator('#history-state').waitFor({state:'visible'});await open(20);
      assert.equal(await page.locator('#day-edit-level').inputValue(),'steps');assert(await page.locator('#day-edit-bonus').isChecked());
      await page.locator('#day-edit-level').selectOption('workout');await save('5');
      assert.equal(await page.locator('#completed-days').textContent(),'1');
      assert.equal(await page.evaluate(()=>Object.keys(fixture.completions).length),1);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.locator('#day-detail').evaluate(el=>el.scrollWidth<=el.clientWidth));
      await page.locator('#day-edit-level').selectOption('');await save('2');
      assert.equal(await page.locator('#completed-days').textContent(),'0');
      await page.locator('#day-edit-bonus').uncheck();await save('0');
      await page.locator('#detail-close').click();
      await open(19);assert.equal(await page.locator('#day-edit-bonus-wrap').isVisible(),false);
      await page.locator('#day-edit-level').selectOption('steps');await save('1');
      assert.equal(await page.locator('#detail-points').textContent(),'1 poäng');
      assert.equal(await page.locator('#history-calendar > button').filter({has:page.locator('.day-number',{hasText:'22'})}).count(),0);
      await page.evaluate(()=>sessionStorage.clear());
    }
    await page.reload();await page.locator('#history-state').waitFor({state:'visible'});await open(20);
    await page.locator('#day-edit-level').selectOption('workout');
    await page.evaluate(()=>fixture.fail=true);await page.locator('#day-edit-save').click();
    await page.waitForFunction(()=>document.querySelector('#day-edit-status').textContent.includes('kunde inte sparas'));
    assert.equal(await page.locator('#total-points').textContent(),'0');assert(await page.locator('#day-edit-save').isEnabled());
    await page.evaluate(()=>{fixture.fail=false;fixture.failBonus=true;});await page.locator('#day-edit-bonus').check();
    await page.locator('#day-edit-save').click();await page.waitForFunction(()=>document.querySelector('#day-edit-status').textContent.includes('Passresultatet är sparat, men bonusen'));
    assert.equal(await page.locator('#total-points').textContent(),'3');
    await page.evaluate(()=>{fixture.failBonus=false;});await page.locator('#day-edit-bonus').check();await save('5');
    await page.evaluate(()=>fixture.delay=2000);await page.locator('#day-edit-level').selectOption('steps');
    const calls=await page.evaluate(()=>fixture.calls.filter(c=>c.args.p_action==='save_result').length);
    await page.evaluate(()=>{document.querySelector('#day-edit-save').click();document.querySelector('#day-edit-save').click();});
    await page.keyboard.press('Escape');assert(await page.locator('#day-detail').evaluate(el=>el.open));assert(await page.locator('#detail-close').isDisabled());
    await page.clock.fastForward(2100);await page.waitForFunction(()=>document.querySelector('#day-edit-status').textContent.startsWith('Sparat!'));
    assert.equal(await page.evaluate(()=>fixture.calls.filter(c=>c.args.p_action==='save_result').length),calls+1);
    assert.equal(await page.locator('#total-points').textContent(),'3');
    await page.locator('#detail-close').click();await open(20);assert.equal(await page.locator('#day-edit-level').inputValue(),'steps');
    await page.locator('#detail-close').click();await page.evaluate(()=>fixture.blockRead=true);
    await page.locator('#history-calendar button').filter({has:page.locator('.day-number',{hasText:/^19$/})}).click();
    await page.waitForFunction(()=>Boolean(window.releaseHistoryRead));
    assert(await page.locator('#day-edit-fields').evaluate(el=>el.disabled));
    assert(await page.locator('#day-edit-level').isDisabled());
    await page.evaluate(()=>window.fixtureAuth('SIGNED_OUT',null));
    await page.locator('#signed-out-state').waitFor({state:'visible'});assert.equal(await page.locator('#day-detail').evaluate(el=>el.open),false);
    await page.evaluate(()=>window.releaseHistoryRead());await page.waitForFunction(()=>fixture.finishedRead);
    assert.equal(await page.locator('#day-detail').evaluate(el=>el.open),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: yesterday/historical vote steps/workout, bonus, atomic-choice request, undo, reload, no bonus row, future dates, failed saves, partial bonus error, double click, Escape lock, logout; 320/390/768/1440. Fixtures only.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
