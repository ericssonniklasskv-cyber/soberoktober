const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const fixtureBoard = [{"label":"Racketsport","description":"30 minuter racketsport","base_amount":30,"unit":"min racketsport"},{"label":"Löpning","description":"30 minuter löpning","base_amount":30,"unit":"min löpning"},{"label":"Utegym","description":"Ett pass på utegym","base_amount":1,"unit":"utegymspass"},{"label":"Långpromenad","description":"Långpromenad – minst 60 minuter","base_amount":60,"unit":"min långpromenad"},{"label":"Simning","description":"Ett simpass","base_amount":1,"unit":"simpass"},{"label":"Sprint","description":"Spring allt vad du kan i 20 meter – värm upp först","base_amount":20,"unit":"m sprint"},{"label":"Hopprep","description":"Hoppa hopprep 10 minuter totalt","base_amount":10,"unit":"min hopprep"},{"label":"Cykling","description":"Cykla minst 45 minuter","base_amount":45,"unit":"min cykling"},{"label":"15 000 steg","description":"Gå minst 15 000 steg på en dag","base_amount":15000,"unit":"steg"},{"label":"5 km promenad","description":"Ta en promenad på minst 5 km","base_amount":5,"unit":"km promenad"},{"label":"100 squats","description":"Gör 100 squats under en dag","base_amount":100,"unit":"squats"},{"label":"50 armhävningar","description":"Gör 50 armhävningar under en dag","base_amount":50,"unit":"armhävningar"},{"label":"10 pull-ups","description":"Gör totalt 10 pull-ups/chins – assisterade räknas","base_amount":10,"unit":"pull-ups/chins"},{"label":"Planka","description":"10 minuter planka totalt under dagen","base_amount":10,"unit":"min planka"},{"label":"100 utfall","description":"Gör 100 utfall totalt","base_amount":100,"unit":"utfall"},{"label":"Kroppsvikt","description":"Kör ett 20-minuters kroppsviktspass","base_amount":20,"unit":"min kroppsviktsträning"},{"label":"Trappträning","description":"Gå/jogga i trappor i 15 minuter","base_amount":15,"unit":"min trappträning"},{"label":"Yoga / rörlighet","description":"Testa yoga eller rörlighet i 30 minuter","base_amount":30,"unit":"min yoga/rörlighet"},{"label":"Dans","description":"Dansa i 30 minuter","base_amount":30,"unit":"min dans"},{"label":"Mobilfri promenad","description":"Ta en promenad utan mobil/podcast/musik i 45 minuter","base_amount":45,"unit":"min mobilfri promenad"},{"label":"Trotsa vädret","description":"Träna utomhus trots dåligt väder","base_amount":1,"unit":"pass i dåligt väder"},{"label":"Något nytt","description":"Testa en träningsform du aldrig gjort tidigare","base_amount":1,"unit":"ny träningsform"},{"label":"Träna ihop","description":"Gör en aktivitet tillsammans med någon annan","base_amount":1,"unit":"aktivitet med sällskap"},{"label":"Aktiv transport","description":"Ta dig någonstans till fots/cykel där du normalt hade tagit bil/buss","base_amount":1,"unit":"aktiv transport"},{"label":"Valfri aktivitet","description":"Välj valfri fysisk aktivitet och håll på i minst 60 minuter","base_amount":60,"unit":"min valfri aktivitet"}];
const root = path.resolve(__dirname, '../..');
(async () => {
 const server = http.createServer(async (req, res) => {
  try {
   let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(name.endsWith('/'))name+='index.html';
   const file=path.resolve(root,'.'+name);
   if(!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
   const content=await fs.readFile(file);
   const ext=path.extname(file);
   res.setHeader('Content-Type',ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':'application/javascript; charset=utf-8');
   res.end(content);
  } catch {res.writeHead(404);res.end('Not found');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try {
  browser=await chromium.launch({headless:true,...(process.env.BINGO_BROWSER_PATH ? {executablePath:process.env.BINGO_BROWSER_PATH} : {})});
  const context=await browser.newContext();
  let admin=true, signedIn=true;
  let state={board:fixtureBoard,completed_cells:{},activity_dates:[],simulated_date:'2026-10-05',elimination_date:null,elimination_reason:null,score:{cell_points:0,line_points:0,full_board_points:0,total_points:0,rows:[],columns:[]}};
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.route('**/api/config',route=>route.fulfill({json:{supabaseUrl:'https://isolated-ui-fixture.invalid',supabasePublishableKey:'ui-fixture-only'}}));
  await page.exposeFunction('uiFixtureProfile',()=>({data:admin?{is_admin:true,display_name:'Testadmin'}:{is_admin:false,display_name:'Deltagare'},error:null}));
  await page.exposeFunction('uiFixtureSession',()=>({data:{session:signedIn?{user:{id:'fixture-admin'}}:null},error:null}));
  await page.exposeFunction('uiFixtureRPC',(name,args)=>{
   assert.equal(name,'admin_bingo_test');
   if(!admin)return {data:null,error:{code:'42501',message:'Admin access required'}};
   if(args.p_action==='complete'){
    const key=String(args.p_payload.cell);
    state.new_completion=!Object.hasOwn(state.completed_cells,key);
    state.new_activity=!state.activity_dates.includes(state.simulated_date);
    if(state.new_completion)state.completed_cells[key]=state.simulated_date;
    if(state.new_activity)state.activity_dates.push(state.simulated_date);
    const count=Object.keys(state.completed_cells).length;
    state.score={cell_points:count,line_points:0,full_board_points:0,total_points:count,rows:[],columns:[]};
   } else if(args.p_action==='set_date')state.simulated_date=args.p_payload.date;
   else if(args.p_action==='reset'){
    state.completed_cells={};state.activity_dates=[];state.simulated_date='2026-10-05';
    state.score={cell_points:0,line_points:0,full_board_points:0,total_points:0,rows:[],columns:[]};
   } else if(args.p_action==='save_board')state.board=args.p_payload.board;
   return {data:JSON.parse(JSON.stringify(state)),error:null};
  });
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:
   "window.supabase={createClient:()=>({auth:{getSession:()=>window.uiFixtureSession(),onAuthStateChange:()=>({})},from:()=>({select:()=>({eq:()=>({maybeSingle:()=>window.uiFixtureProfile()})})}),rpc:(name,args)=>window.uiFixtureRPC(name,args)})};"
  }));
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:900});
   await page.goto(origin+'/admin/bingo/');
   await page.locator('#sandbox').waitFor({state:'visible'});
   assert.equal(await page.locator('.bingo-cell').count(),25);
   assert.equal(await page.locator('#task-list li').count(),25);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Overflow at '+width);
   assert.equal(await page.locator('.bingo-cell').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().width>=44&&n.getBoundingClientRect().height>=44)),true,'Touch targets at '+width);
   assert.equal(await page.locator('header.topbar').count(),1);
   await page.screenshot({path:path.join(root,'bingo-'+width+'.png'),fullPage:true});
   await page.locator('#bingo-board').screenshot({path:path.join(root,'board-'+width+'.png')});
  }
  await page.locator('[data-cell="0"]').click();
  await page.waitForFunction(()=>document.querySelector('#total-points').textContent==='1');
  await page.locator('[data-cell="0"]').click();
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('redan registrerade'));
  assert.equal(await page.locator('#total-points').textContent(),'1');
  await page.locator('#next-day').click();
  await page.waitForFunction(()=>document.querySelector('#test-date').value==='2026-10-06');
  await page.locator('[data-cell="0"]').click();
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent.includes('Rutan gav inga nya poäng'));
  assert.equal(await page.locator('#report-days').textContent(),'2 / 7');
  await page.locator('#reset-test').click();
  await page.locator('#confirm-dialog').waitFor({state:'visible'});
  await page.locator('#cancel-confirm').click();
  assert.equal(await page.locator('#total-points').textContent(),'1');
  await page.locator('#reset-test').click();
  await page.locator('#accept-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#total-points').textContent==='0');
  await page.locator('.board-editor summary').click();
  await page.locator('#task-0-label').fill('Min testuppgift');
  await page.locator('#save-board').click();
  await page.waitForFunction(()=>document.querySelector('[data-cell="0"]').textContent.includes('Min testuppgift'));
  admin=false;
  await page.reload();
  await page.locator('#denied-state').waitFor({state:'visible'});
  assert.equal(await page.locator('#sandbox').isVisible(),false);
  signedIn=false;
  await page.reload();
  await page.locator('#signed-out-state').waitFor({state:'visible'});
  assert.equal(await page.locator('#sandbox').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: 320/390/768/1440px, no overflow, 25 cells, 44px touch targets, click/repeat, date, reset confirmation, editor save, signed-out and non-admin gates; no console errors. API/auth fixtures only; DB tested separately.');
 } finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
