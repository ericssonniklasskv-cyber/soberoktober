// Browser interaction fixtures only: does not modify local or production votes.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const {browserOptions}=require('../qa/browser.cjs');
const {serveFrontend}=require('../qa/frontend-server.cjs');
const options=[
 {id:0,title:'5 km promenad',description:'Ta en promenad på minst 5 km',votes:0},
 {id:1,title:'100 squats',description:'Gör 100 squats under en dag',votes:0},
 {id:2,title:'Kroppsvikt',description:'Kör ett 20-minuters kroppsviktspass',votes:0},
 {id:3,title:'Yoga / rörlighet',description:'Testa yoga eller rörlighet i 30 minuter',votes:0}
];
const monday={date:'2026-10-19',opens:'2026-10-18T21:00:00+02:00',closes:'2026-10-19T00:00:00+02:00',own_vote:null,options,result:null};
const initial={now:monday.opens,today:'2026-10-18',simulated:true,is_admin:false,can_vote:true,days:[monday,{...monday,options:structuredClone(options),date:'2026-10-20',opens:'2026-10-19T15:00:00+02:00',closes:'2026-10-20T00:00:00+02:00'}]};
(async()=>{
 const server=await serveFrontend();let browser;const errors=[],shots='/private/tmp/voting-v2';await fs.mkdir(shots,{recursive:true});
 try{
  browser=await chromium.launch({headless:true,...browserOptions()});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*.js*',route=>['/voting/vote.js','/voting/vote-logic.js'].includes(new URL(route.request().url()).pathname)?route.continue():route.fulfill({contentType:'text/javascript',body:''}));
  async function start(data=initial,enabled=true,live=false,loggedIn=true){
   await page.goto(server.origin);
   await page.evaluate(async({data,enabled,live,loggedIn})=>{
    document.querySelector('#entry-gate').hidden=true;document.body.classList.remove('entry-active');
    const app=document.querySelector('#app-shell');app.inert=false;app.setAttribute('aria-hidden','false');
    document.querySelector('#dagens-pass').hidden=true;
    window.fixtureState=structuredClone(data);window.rpcNames=[];window.voteCalls=[];window.failVote=false;window.delayVote=0;window.completeCalls=[];window.failComplete=false;window.stepCalls=[];
    const session={user:{id:'fixture-user'}};
    const client={auth:{getSession:async()=>({data:{session:loggedIn?session:null}}),onAuthStateChange:callback=>{window.voteAuthChange=callback;return {data:{subscription:{unsubscribe(){}}}};}},
      rpc:async(name,args={})=>{window.rpcNames.push(name);
       if(args.p_action==='vote'){
        window.voteCalls.push(args);if(window.delayVote)await new Promise(resolve=>setTimeout(resolve,window.delayVote));
        if(window.failVote)return {error:{message:'Rösten kunde inte sparas. Prova igen.'}};
        const day=window.fixtureState.days.find(day=>day.date===args.p_date);day.own_vote=args.p_option;day.options.find(o=>o.id===args.p_option).votes++;
       }
       if(['complete','uncomplete'].includes(args.p_action)){
        window.completeCalls.push(args);if(window.failComplete)return {error:{message:'Passet kunde inte sparas. Försök igen.'}};
        const day=window.fixtureState.days.find(day=>day.date===args.p_date);
        day.completion=args.p_action==='complete'?{points:3,completed_at:window.fixtureState.now}:null;
       }
       if(['steps','unsteps'].includes(args.p_action)){
        window.stepCalls.push(args);const day=window.fixtureState.days.find(day=>day.date===args.p_date);
        day.completion=args.p_action==='steps'?{kind:'steps',points:1,completed_at:window.fixtureState.now}:null;
       }
       return {data:structuredClone(window.fixtureState),error:null};
      }};
    await window.SoberVotePreview.init(client,live?{votingEnabled:enabled,supabaseUrl:'https://usbcwnirgkkfmluukria.supabase.co'}:{votingPreview:enabled,supabaseUrl:'http://127.0.0.1:54321'});
   },{data,enabled,live,loggedIn});
  }
  await start();
  assert.equal(await page.locator('.vote-option').count(),4);assert.match(await page.locator('#vote-countdown').textContent(),/3 tim kvar/);
  assert(await page.locator('#vote-submit').isDisabled());assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-vote-stage'),'1');
  const first=page.locator('input[name="workout-vote"]').first();await first.focus();await page.keyboard.press('Space');
  assert.match(await page.locator('#vote-submit').textContent(),/5 km promenad/);
  assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-vote-stage'),'2');
  assert.equal(await page.evaluate(()=>window.voteCalls.length),0,'Selection alone does not cast a vote');
  // Fresh counts must preserve a keyboard user's focused radio and selected favourite.
  await page.evaluate(()=>{window.fixtureState.days[0].options[1].votes=1;document.querySelector('#vote-refresh').click();});
  await page.waitForFunction(()=>document.querySelector('#vote-total').textContent.includes('1 röst'));
  assert.equal(await page.evaluate(()=>document.activeElement.value),'0');assert(await first.isChecked());
  await page.locator('.vote-option').nth(2).click();assert.match(await page.locator('#vote-selection-copy').textContent(),/Bra val/);
  for(const width of [320,390,768,1280,1440]){
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+width);
   await page.locator('#vote-preview').screenshot({path:shots+'/choose-'+width+'.png'});
  }
  await page.evaluate(()=>{window.delayVote=150;const form=document.querySelector('#vote-form');form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
  await page.locator('#vote-receipt').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.activeElement.id==='vote-receipt-title');
  assert.equal(await page.evaluate(()=>window.voteCalls.length),1,'Double submits are ignored');
  assert.match(await page.locator('#vote-receipt-copy').textContent(),/Kroppsvikt/);
  assert.match(await page.locator('#vote-race-title').textContent(),/Jämnt/);
  assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-vote-stage'),'3');
  assert.equal(await page.locator('input[name="workout-vote"]:disabled').count(),4);
  assert.equal(await page.locator('#vote-submit').isVisible(),false);
  assert.equal(await page.locator('#vote-celebration span').count(),18);
  await page.waitForFunction(()=>document.querySelector('#vote-celebration').childElementCount===0);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#vote-preview').screenshot({path:shots+'/voted-'+width+'.png'});}
  await page.evaluate(()=>{window.fixtureState.now='2026-10-19T00:00:00+02:00';window.fixtureState.today='2026-10-19';window.fixtureState.days[0].result={option_id:2,total_votes:2,tied_options:2};document.querySelector('#vote-refresh').click();});
  await page.locator('#vote-today').waitFor({state:'visible'});
  assert.match(await page.locator('#vote-today-outcome').textContent(),/Lottat mellan 2/);
  await page.locator('.vote-winner-details summary').click();assert.equal(await page.locator('.vote-winner-row:visible').count(),4);
  assert.equal(await page.locator('.vote-winner-row[data-winner=true]').count(),1);
  assert.equal(await page.locator('#vote-history-section').isVisible(),false,'Today is not duplicated in history');
  assert.equal(await page.locator('#vote-receipt').isVisible(),false,'New poll clears old receipt');assert.equal(await page.locator('#vote-feedback').textContent(),'','Old success message clears at midnight');
  assert(await page.locator('#vote-waiting').isVisible());assert.equal(await page.locator('#vote-ballot').isVisible(),false);assert.equal(await page.locator('#vote-week-finished').isVisible(),false);
  assert.match(await page.locator('#vote-waiting-copy').textContent(),/15[.:]00/);
  await page.locator('#vote-preview').screenshot({path:shots+'/winner-1440.png'});
  assert(await page.locator('#vote-complete').isEnabled(),'No vote needed to complete the winner');
  await page.locator('#vote-complete').click();await page.waitForFunction(()=>document.querySelector('#vote-completion').dataset.completed==='true');
  assert(await page.locator('#vote-steps-choice').isDisabled());
  assert.equal(await page.locator('#vote-complete').isVisible(),false);assert.match(await page.locator('#vote-completion-summary').textContent(),/3 poäng/);
  await page.locator('#vote-undo-complete').click();await page.waitForFunction(()=>document.querySelector('#vote-completion').dataset.completed==='false');
  assert.match(await page.locator('#vote-completion-feedback').textContent(),/borttagna/);
  await page.evaluate(()=>{const button=document.querySelector('#vote-steps-choice');button.click();button.click();});
  await page.waitForFunction(()=>document.querySelector('#vote-steps-choice').getAttribute('aria-pressed')==='true');
  assert.equal(await page.evaluate(()=>window.stepCalls.length),1);assert(await page.locator('#vote-complete').isDisabled());assert.match(await page.locator('#vote-completion-summary').textContent(),/1 poäng/);
  await page.locator('#vote-steps-choice').click();await page.waitForFunction(()=>document.querySelector('#vote-steps-choice').getAttribute('aria-pressed')==='false');assert(await page.locator('#vote-complete').isEnabled());
  await page.evaluate(()=>window.failComplete=true);await page.locator('#vote-complete').click();await page.waitForFunction(()=>document.querySelector('#vote-completion-feedback').textContent.includes('Försök igen'));
  assert(await page.locator('#vote-complete').isEnabled());assert.equal(await page.locator('#vote-undo-complete').isVisible(),false);
  // Same tab opens the next poll at 15:00 even when only the clock changes.
  await page.evaluate(()=>{window.fixtureState.now='2026-10-19T14:59:59+02:00';document.querySelector('#vote-refresh').click();});
  assert.equal(await page.locator('#vote-ballot').isVisible(),false);
  await page.evaluate(()=>{window.fixtureState.now='2026-10-19T15:00:00+02:00';document.querySelector('#vote-refresh').click();});
  await page.locator('#vote-ballot').waitFor({state:'visible'});assert.equal(await page.locator('#vote-waiting').isVisible(),false);assert(await page.locator('#vote-complete').isEnabled());
  // Failed requests retain the choice, offer a retry, and do not celebrate.
  await start();await page.locator('.vote-option').first().click();await page.evaluate(()=>window.failVote=true);await page.locator('#vote-submit').click();
  await page.waitForFunction(()=>document.querySelector('#vote-feedback').textContent.includes('Prova igen'));
  assert(await page.locator('#vote-submit').isEnabled());assert.equal(await page.locator('#vote-celebration span').count(),0);
  // Reduced motion keeps all functionality without decorative animation.
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.failVote=false);await page.locator('#vote-submit').click();
  await page.locator('#vote-receipt').waitFor({state:'visible'});assert.equal(await page.locator('#vote-celebration span').count(),0);
  assert.match(await page.locator('#vote-race-title').textContent(),/Din favorit leder/);
  // Incoming titles are text, including selected button copy and result receipts.
  const unsafe=structuredClone(initial);unsafe.days[0].options[0].title='<img src=x onerror=alert(1)>';
  await start(unsafe);await page.locator('.vote-option').first().click();assert.equal(await page.locator('#vote-preview img').count(),0);
  // A response arriving after sign-out cannot resurrect a receipt or celebration.
  await page.evaluate(()=>window.delayVote=200);await page.locator('#vote-submit').click();
  await page.evaluate(()=>window.voteAuthChange('SIGNED_OUT',null));await page.waitForTimeout(350);
  assert.equal(await page.locator('#vote-preview').isVisible(),false);assert.equal(await page.locator('#vote-celebration span').count(),0);
  await start({...structuredClone(initial),now:'2026-10-26T00:00:00+01:00',today:'2026-10-26'});
  assert.match(await page.locator('#vote-title').textContent(),/Vilken vecka/);assert.equal(await page.locator('#vote-ballot').isVisible(),false);
  await start(initial,false);assert.equal(await page.locator('#vote-preview').isVisible(),false);
  // Production launch: Sunday roulette and ballot coexist, even with an open wheel.
  await page.clock.setFixedTime(new Date('2026-10-18T21:00:00+02:00'));
  await start({...structuredClone(initial),is_admin:true},true,true);
  await page.evaluate(()=>{document.querySelector('#training-roulette').hidden=false;document.body.classList.add('roulette-live');document.querySelector('#roulette-dialog').showModal();document.querySelector('#close-roulette').addEventListener('click',()=>document.querySelector('#roulette-dialog').close());document.querySelector('#vote-refresh').click();});
  assert(await page.locator('#training-roulette').isVisible());assert(await page.locator('#roulette-dialog').isVisible());
  assert.equal(await page.locator('#vote-admin-tools').isVisible(),false,'Production admin cannot see clock/reset tools');
  await page.evaluate(()=>document.querySelector('#roulette-dialog').close());
  assert(await page.locator('#vote-ballot').isVisible());assert(await page.locator('#vote-sunday-note').isVisible());
  assert(await page.evaluate(()=>Boolean(document.querySelector('#vote-preview').compareDocumentPosition(document.querySelector('#training-roulette'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Ballot appears above Sunday roulette');
  assert.deepEqual(await page.evaluate(()=>[...new Set(window.rpcNames)]),['my_workout_vote']);
  await page.locator('.vote-option').first().click();await page.locator('#vote-submit').click();await page.locator('#vote-receipt').waitFor({state:'visible'});
  await page.locator('#vote-preview').screenshot({path:shots+'/production-sunday-1440.png'});
  await page.evaluate(()=>{window.fixtureState.now='2026-10-19T00:00:00+02:00';window.fixtureState.today='2026-10-19';window.fixtureState.days[0].result={option_id:0,total_votes:1,tied_options:1};document.querySelector('#vote-refresh').click();});
  await page.locator('#vote-today').waitFor({state:'visible'});
  assert.equal(await page.locator('#training-roulette').isVisible(),false);assert.equal(await page.locator('#dagens-pass').isVisible(),false);
  await page.clock.setFixedTime(new Date('2026-10-19T08:00:00+02:00'));
  await start(initial,true,true,false);assert(await page.locator('#vote-access').isVisible());assert.equal(await page.locator('#dagens-pass').isVisible(),false);assert.equal(await page.locator('#training-roulette').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: voting v2 cards/keyboard/focus, selection without casting, double-submit guard, receipt/confetti, live tie/leader, winner details, next-day reset, errors/retry, reduced motion, text safety, logout race, end-of-week and 320/390/768/1280/1440px. No database writes. Screenshots: '+shots);
 }finally{await browser?.close();await server.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
