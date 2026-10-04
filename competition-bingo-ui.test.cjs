const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=__dirname;
const board=require('./qa/bingo-board.json');
const score=(cells)=>{const keys=Object.keys(cells).map(Number);const rows=[0,1,2,3,4].filter(r=>[0,1,2,3,4].every(c=>keys.includes(r*5+c)));const columns=[0,1,2,3,4].filter(c=>[0,1,2,3,4].every(r=>keys.includes(r*5+c)));const dates=[...new Set(Object.values(cells))];return {cell_points:keys.length,day_bonus_points:dates.length,line_points:rows.length+columns.length,full_board_points:keys.length===25?10:0,total_points:keys.length+dates.length+rows.length+columns.length+(keys.length===25?10:0),rows,columns};};
(async()=>{
 const server=http.createServer(async(req,res)=>{try{let file=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(file.endsWith('/'))file+='index.html';const target=path.resolve(root,'.'+file);if(!target.startsWith(root+path.sep))throw Error();const bytes=await fs.readFile(target);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'application/javascript; charset=utf-8');res.end(bytes);}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
 browser=await chromium.launch({headless:true,executablePath:process.env.BINGO_BROWSER_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({reducedMotion:'reduce'});
 const page=await context.newPage();let today='2026-10-05',enabled=true,signedIn=true,profileName='Testaren',cells={},repeat=[],queries=[];
 const state=()=>({enabled,board,completed_cells:cells,repeat_dates:repeat,activity_dates:[...new Set([...Object.values(cells),...repeat])].sort(),daily_scores:[...new Set(Object.values(cells))].map(result_date=>({result_date,points:Object.values(cells).filter(d=>d===result_date).length+1})),score:score(cells),today});
 const challenge={title:'Squats',description:'15 squats',base_amount:15,unit:'squats',completion_mode:'single',bonus_description:'Promenera',bonus_points:1};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.exposeFunction('fixtureSession',()=>({data:{session:signedIn?{user:{id:'own-fixture',email:'own@example.invalid'}}:null},error:null}));
 await page.exposeFunction('fixtureQuery',(table,args,single)=>{
  queries.push(table);
  if(table==='profiles'&&args.some(a=>a[0]==='update'))profileName=args.find(a=>a[0]==='update')[1].display_name;
  let data=table==='profiles'?{id:'own-fixture',display_name:profileName,is_admin:false,email:'own@example.invalid'}:table==='daily_challenges'?(single?challenge:['2026-10-01','2026-10-04','2026-10-05','2026-10-31'].map(challenge_date=>({...challenge,challenge_date}))):table==='daily_results'?[{result_date:'2026-10-04',multiplier:2,points:1.5}]:[];
  return {data,error:null};
 });
 await page.exposeFunction('fixtureRPC',(name,args={})=>{
  if(name==='get_activity_feed'){
   const events=[...Object.keys(cells).reverse().map(index=>({display_name:'Testaren',activity_type:'bingo_cell',activity_label:board[Number(index)].description,multiplier:null,event_at:'2026-10-05T10:00:00Z'})),{display_name:'En annan',activity_type:'bingo_full',multiplier:null,event_at:'2026-10-05T09:59:00Z'},{display_name:'En annan',activity_type:'bingo_row',multiplier:null,event_at:'2026-10-05T09:58:00Z'},{display_name:'Förra passet',activity_type:'completed',multiplier:2,event_at:'2026-10-04T12:00:00Z'},{display_name:'Lång aktivitet',activity_type:'bingo_cell',activity_label:board[23].description,multiplier:null,event_at:'2026-10-05T09:57:00Z'}];
   return{data:events.slice(args.p_offset||0,(args.p_offset||0)+(args.p_limit||4)),error:null};
  }
  if(name==='my_competition_bingo'){
   if(args.p_action==='complete')cells[String(args.p_cell)]||=args.p_date;
   if(args.p_action==='uncomplete')delete cells[String(args.p_cell)];
   if(args.p_action==='repeat'&&!repeat.includes(args.p_date))repeat.push(args.p_date);
   return {data:state(),error:null};
  }
  if(name==='get_bingo_directory')return{data:{enabled,board,participants:[{board_key:1,display_name:'Testaren',completed_cells:Object.keys(cells).map(Number),score:score(cells),is_current_user:signedIn,is_eliminated:false},{board_key:2,display_name:'En annan',completed_cells:[3,8],score:{total_points:3},is_current_user:false,is_eliminated:false}]},error:null};
  if(name==='sync_competition_status')return {data:{status:'active'},error:null};
  if(name==='get_registered_participants')return {data:[{display_name:'Testaren',is_eliminated:false}],error:null};
  if(name==='get_leaderboard')return {data:[{display_name:'Testaren',rank_position:1,total_points:1.5+score(cells).total_points,completed_days:1+Object.keys(cells).length,is_current_user:true,is_eliminated:false}],error:null};
  return {data:[],error:null};
 });
 await page.route('**/api/config',r=>r.fulfill({json:{supabaseUrl:'https://fixture.invalid',supabasePublishableKey:'fixture-only'}}));
 await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({auth:{getSession:()=>window.fixtureSession(),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:(table)=>{const args=[];let single=false;const q=new Proxy({}, {get:(_,name)=>name==='then'?((resolve,reject)=>window.fixtureQuery(table,args,single).then(resolve,reject)):((...a)=>{args.push([name,...a]);if(name==='maybeSingle'||name==='single')single=true;return q;})});return q;},rpc:(name,args)=>window.fixtureRPC(name,args)})};` }));
 await page.clock.install({time:new Date('2026-10-05T12:00:00+02:00')});
 await page.addInitScript(()=>{const d=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date());localStorage.setItem('soberoktober-trump-quote-seen',d);});
 page.on('dialog',dialog=>dialog.accept());
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:950});await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('#competition-bingo').waitFor({state:'visible'});
  await page.evaluate(()=>{const close=document.querySelector('#trump-quote-close');if(close)close.click();document.querySelector('#trump-quote-overlay')?.setAttribute('hidden','');});
  assert.equal(await page.locator('#dagens-pass').isVisible(),false);
  assert.equal(await page.locator('#competition-bingo .bingo-cell').count(),25);
  await page.waitForFunction(()=>document.querySelectorAll('#activity-preview-list .activity-item').length===4);
  assert.match(await page.locator('#activity-preview-list').innerText(),/hela bingobrickan/);
  assert.deepEqual(await page.locator('#competition-bingo .bingo-cell-copy').allTextContents(),board.map(t=>t.description));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Overflow '+width);
  assert.equal(await page.locator('#competition-bingo .bingo-cell').evaluateAll(els=>els.every(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44)),true);
  if(width===1440){const hero=await page.locator('.hero').boundingBox();assert(Math.abs(hero.x+hero.width/2-width/2)<3,'Hero centered');}
  if(width===390){const b=await page.locator('#competition-bingo').boundingBox(),a=await page.locator('.activity-preview').boundingBox();assert(a.y>=b.y+b.height,'Activity follows bingo');}
  await page.screenshot({path:path.join(root,'qa','bingo-main-'+width+'.png'),fullPage:true,animations:'disabled'});
 }
 await page.locator('#competition-bingo .bingo-cell').nth(0).click();await page.waitForFunction(()=>document.querySelector('#competition-bingo .bingo-stats').textContent.includes('2 poäng'));
 await page.waitForFunction(()=>document.querySelector('#activity-preview-list').textContent.includes('Testaren klarade en bingoruta: 30 minuter racketsport'));
 await page.locator('#competition-bingo .bingo-cell').nth(1).click();await page.waitForFunction(()=>document.querySelector('#competition-bingo .bingo-stats').textContent.includes('3 poäng'));
 await page.locator('#competition-bingo .bingo-cell').nth(1).click();await page.waitForFunction(()=>document.querySelector('#competition-bingo .bingo-stats').textContent.includes('2 poäng'));
 await page.waitForFunction(()=>!document.querySelector('#activity-preview-list').textContent.includes('Testaren klarade en bingoruta: 30 minuter löpning'));
 await page.goto('http://127.0.0.1:'+server.address().port+'/aktivitet/');await page.locator('#activity-list .activity-item').first().waitFor();
 assert.equal(await page.locator('#activity-list .activity-item').count(),5);
 assert.equal(await page.locator('#activity-list .activity-empty').count(),0,'Loading placeholder removed when activities arrive');
 assert.match(await page.locator('#activity-list').innerText(),/Testaren klarade en bingoruta: 30 minuter racketsport/);
 assert.match(await page.locator('#activity-list').innerText(),/En annan fick en hel bingorad!/);
 assert.match(await page.locator('#activity-list').innerText(),/Förra passet klarade dagens pass ×2/);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:950});await page.goto('http://127.0.0.1:'+server.address().port+'/bingobingo/');await page.locator('.bingo-person').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('.bingo-person').nth(1).click();await page.locator('#bingo-public-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#bingo-public-grid button').count(),0,'Other board read-only');
  assert.equal(await page.locator('#bingo-public-grid .is-done').count(),2);
  assert.deepEqual(await page.locator('#bingo-public-grid .bingo-cell-copy').allTextContents(),board.map(t=>t.description));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(root,'qa','bingobingo-'+width+'.png'),fullPage:true,animations:'disabled'});await page.locator('.bingo-dialog-close').click();
 }
 signedIn=false;await page.goto('http://127.0.0.1:'+server.address().port+'/bingobingo/');await page.locator('.bingo-person').first().waitFor();assert.equal(await page.locator('.bingo-person').count(),2);
 signedIn=true;today='2026-10-08';await page.clock.setFixedTime(new Date('2026-10-08T12:00:00+02:00'));await page.goto('http://127.0.0.1:'+server.address().port+'/min-oktober/');await page.locator('#history-state').waitFor({state:'visible'});
 await page.locator('#history-calendar .calendar-day').nth(4).click();await page.locator('#bingo-day-detail').waitFor({state:'visible'});assert.equal(await page.locator('#bingo-day-detail .bingo-cell').count(),25);await page.locator('#bingo-day-detail .bingo-cell').nth(2).click();await page.waitForFunction(()=>document.querySelector('#bingo-day-detail .bingo-stats').textContent.includes('3 poäng'));await page.locator('#bingo-day-detail .bingo-dialog-close').click();
 assert.equal(await page.locator('#history-calendar .day-result').nth(4).textContent(),'Bingo');
 await page.locator('.weekly-report-action').first().click();await page.locator('#weekly-bingo-report').waitFor({state:'visible'});assert.match(await page.locator('#weekly-bingo-report').innerText(),/2 rutor.*3 bingopoäng/s);await page.locator('#report-detail-close').click();
 today='2026-10-12';await page.clock.setFixedTime(new Date('2026-10-12T00:00:00+02:00'));await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#score-summary').waitFor({state:'visible'});assert.equal(await page.locator('#dagens-pass').isVisible(),true);assert.equal(await page.locator('#competition-bingo').isVisible(),false);
 today='2026-10-05';enabled=false;await page.clock.setFixedTime(new Date('2026-10-05T12:00:00+02:00'));await page.reload();await page.locator('#score-summary').waitFor({state:'visible'});assert.equal(await page.locator('#competition-bingo').isVisible(),false);
 enabled=true;profileName=null;await page.reload();await page.locator('#auth-onboarding').waitFor({state:'visible'});await page.locator('#display-name').fill('Ny deltagare');await page.locator('#name-form button[type=submit]').click();await page.locator('#competition-bingo').waitFor({state:'visible'});await page.locator('#auth-onboarding').waitFor({state:'hidden'});assert.equal(await page.locator('#dagens-pass').isVisible(),false,'Onboarding immediately activates own bingo');
 assert.deepEqual(errors,[],'Console/page errors');console.log('PASS: 320/390/768/1440 layouts, centered home, full task texts, own writes/uncheck, public read-only boards, history backfill/report, automatic return and disabled preparation.');
 } finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
