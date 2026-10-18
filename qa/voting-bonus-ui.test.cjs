// Isolated browser fixtures; never writes to Supabase or real users.
const assert=require('node:assert/strict');
const{chromium}=require('playwright');const{browserOptions}=require('./browser.cjs');const{serveFrontend}=require('./frontend-server.cjs');
const board=require('./bingo-board.json');
(async()=>{
 const server=await serveFrontend();let browser;
 try{
  browser=await chromium.launch({headless:true,...browserOptions()});const page=await browser.newPage({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let today='2026-10-18',now='2026-10-18T20:59:55+02:00',completion=null,ownVote=null;const claims={};
  const challenges=new Map([
   ['2026-10-18',{title:'Dagens Spinn The Wheel!',bonus_description:'Söndagens bonus',bonus_points:1}],
   ['2026-10-19',{title:'Dagens val',bonus_description:'Måndagens bonus',bonus_points:2}],
   ['2026-10-20',{title:'Dagens val',bonus_description:null,bonus_points:null}]
  ]);
  const options=[{id:0,title:'3 × 15 squats',description:'Tre set med 15 squats',votes:1},{id:1,title:'5 km promenad',description:'Gå 5 km',votes:0},{id:2,title:'Simning',description:'Simma ett pass',votes:0},{id:3,title:'Yoga',description:'30 minuter yoga',votes:0}];
  const voteState=()=>({now,today,can_vote:true,is_admin:false,simulated:false,days:[{date:'2026-10-19',opens:'2026-10-18T21:00:00+02:00',closes:'2026-10-19T00:00:00+02:00',own_vote:ownVote,options,result:today>='2026-10-19'?{option_id:0,total_votes:1,tied_options:1}:null,completion:today==='2026-10-19'?completion:null},{date:'2026-10-20',opens:'2026-10-19T15:00:00+02:00',closes:'2026-10-20T00:00:00+02:00',own_vote:null,options,result:today==='2026-10-20'?{option_id:0,total_votes:0,tied_options:4}:null,completion:null}]});
  const score=()=>Object.values(claims).reduce((a,b)=>a+b,0)+(completion?.points||0);
  await page.exposeFunction('bonusFixtureSession',()=>({data:{session:{user:{id:'bonus-fixture',email:'fixture@example.invalid'}}}}));
  await page.exposeFunction('bonusFixtureQuery',(table,args,single)=>{
   const date=args.find(a=>a[0]==='eq'&&a[1]==='challenge_date')?.[2];let data=[];
   if(table==='profiles')data={id:'bonus-fixture',display_name:'Bonus test',email:'fixture@example.invalid',is_admin:false};
   if(table==='daily_challenges')data=single?challenges.get(date)||null:[...challenges].map(([challenge_date,c])=>({...c,challenge_date}));
   if(table==='daily_bonus_claims')data=Object.entries(claims).map(([challenge_date,points])=>({challenge_date,points}));
   return {data,error:null};
  });
  await page.exposeFunction('bonusFixtureRpc',(name,args={})=>{
   if(name==='my_workout_vote'){
    if(args.p_action==='vote')ownVote=args.p_option;
    if(args.p_action==='complete')completion={kind:'workout',points:3};if(args.p_action==='uncomplete')completion=null;
    if(args.p_action==='steps')completion={kind:'steps',points:1};if(args.p_action==='unsteps')completion=null;
    return {data:voteState(),error:null};
   }
   if(name==='self_daily_result'){
    if(args.p_action==='save'){
     assert.equal(args.p_payload.multiplier,null,'Bonus must not register an old workout');assert.equal(args.p_payload.expected_bonus_points,claims[args.p_date]??null);
     if(args.p_payload.claim_bonus)claims[args.p_date]=challenges.get(args.p_date).bonus_points;
     if(args.p_payload.unclaim_bonus)delete claims[args.p_date];
    }
    return {data:{result:null,bonus_points:claims[args.p_date]??null,challenge:challenges.get(args.p_date)},error:null};
   }
   if(name==='my_competition_bingo')return {data:{enabled:true,today,board,completed_cells:{},repeat_dates:[],daily_scores:[],score:{total_points:0}},error:null};
   if(name==='sync_competition_status')return {data:{status:'active'},error:null};
   if(name==='get_registered_participants')return {data:[{display_name:'Bonus test',is_eliminated:false}],error:null};
   if(name==='get_leaderboard')return {data:[{display_name:'Bonus test',rank_position:1,total_points:score(),completed_days:completion?1:0,is_current_user:true,is_eliminated:false}],error:null};
   return {data:[],error:null};
  });
  await page.route('**/api/config',r=>r.fulfill({json:{supabaseUrl:'https://fixture.invalid',supabasePublishableKey:'fixture',votingEnabled:true}}));
  await page.route('**/roulette/roulette.js',r=>r.fulfill({body:''}));
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:window.bonusFixtureSession,onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:table=>{const args=[];let single=false;const q=new Proxy({},{get:(_,name)=>name==='then'?((resolve,reject)=>window.bonusFixtureQuery(table,args,single).then(resolve,reject)):((...a)=>{args.push([name,...a]);if(name==='single'||name==='maybeSingle')single=true;return q;})});return q;},rpc:window.bonusFixtureRpc})};`}));
  await page.addInitScript(()=>{localStorage.setItem('soberoktober-trump-quote-seen-date',new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date()));localStorage.setItem('soberoktober:weekly-reports-seen:bonus-fixture',JSON.stringify(['oct_01_07','oct_08_14','oct_15_21','oct_22_31']));});
  await page.addLocatorHandler(page.locator('#weekly-release-dialog[open]'),()=>page.locator('#weekly-release-close').click());await page.addLocatorHandler(page.locator('#trump-quote-overlay:not([hidden])'),()=>page.locator('[data-trump-quote-close]').last().click());page.on('dialog',d=>d.accept());
  await page.clock.install({time:new Date(now)});await page.goto(server.origin+'/');
  await page.waitForFunction(()=>document.querySelector('#bonus-description').textContent==='Söndagens bonus');
  await page.locator('#bonus-button:not([disabled])').waitFor();await page.locator('#bonus-button').click();await page.waitForFunction(()=>document.querySelector('#bonus-button').getAttribute('aria-pressed')==='true');assert.equal(score(),1);
  await page.evaluate(()=>{document.querySelector('#training-roulette').hidden=false;document.body.classList.add('roulette-live');});
  now='2026-10-18T21:00:05+02:00';await page.clock.fastForward(10000);await page.locator('#vote-ballot').waitFor({state:'visible'});assert(await page.locator('#training-roulette').isVisible());assert(await page.locator('#bonus-challenge').isVisible());
  today='2026-10-19';now='2026-10-19T00:00:03+02:00';await page.clock.setSystemTime(new Date(now));await page.clock.fastForward(16000);
  await page.waitForFunction(()=>document.querySelector('#bonus-description').textContent==='Måndagens bonus'&&document.querySelector('#bonus-button').getAttribute('aria-pressed')==='false');
  assert(await page.locator('#bonus-challenge').isVisible());assert.equal(await page.locator('#dagens-pass').isVisible(),false);assert.equal(await page.locator('#training-roulette').isVisible(),false);assert.equal(claims['2026-10-18'],1);
  await page.locator('#bonus-button').click();await page.waitForFunction(()=>document.querySelector('#bonus-button').getAttribute('aria-pressed')==='true');assert.equal(score(),3);
  await page.locator('#vote-complete').click();await page.locator('#vote-undo-complete').waitFor({state:'visible'});assert.equal(score(),6);assert.equal(claims[today],2);
  await page.locator('#vote-undo-complete').click();await page.locator('#vote-complete').waitFor({state:'visible'});assert.equal(score(),3);
  await page.locator('#vote-steps-choice').click();await page.waitForFunction(()=>document.querySelector('#vote-steps-choice').getAttribute('aria-pressed')==='true');assert.equal(score(),4);assert.equal(claims[today],2);
  await page.locator('#bonus-button').click();await page.waitForFunction(()=>document.querySelector('#bonus-button').getAttribute('aria-pressed')==='false');assert.equal(score(),2);assert.equal(completion.kind,'steps');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#bonus-description').textContent==='Måndagens bonus');assert.equal(await page.locator('#bonus-button').getAttribute('aria-pressed'),'false');await page.waitForFunction(()=>document.querySelector('#vote-steps-choice').getAttribute('aria-pressed')==='true');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:950});try{await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,{},{timeout:3000});}catch(error){await page.screenshot({path:'/private/tmp/vote-bonus-overflow.png',fullPage:true});console.error(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,18)));throw error;}}
  today='2026-10-20';now='2026-10-20T00:00:03+02:00';await page.clock.setSystemTime(new Date(now));await page.clock.fastForward(16000);await page.waitForFunction(()=>document.querySelector('#bonus-description').textContent==='Dagens bonus kommer snart.');assert.equal(await page.locator('#bonus-button').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS actual home bonus + voting: Sunday 21 coexistence, open-tab midnight bonus rollover, no carried checkbox, bonus before training, 3/1 points + independent bonus/undo, reload, empty next day and responsive widths. Fixtures only.');
 }finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
