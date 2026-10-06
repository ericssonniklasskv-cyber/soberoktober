const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const { localEnvironment, getLocalStack, runLocalSql, localRequest } = await import('/Users/niklasericsson/soberoktober/scripts/local-env.mjs');
  const env = localEnvironment(), stack = getLocalStack(env, { start: false });
  const sdk = await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js').then(r => { if (!r.ok) throw Error('SDK unavailable'); return r.text(); });
  const created = [], users = [], errors = [];
  let browser, server;
  const authHeaders = { apikey: stack.publishable, 'Content-Type': 'application/json' };
  const adminHeaders = { apikey: stack.publishable, Authorization: `Bearer ${stack.serviceRole}`, 'Content-Type': 'application/json' };
  const rpc = (token, name, body={}) => localRequest(`${stack.api}/rest/v1/rpc/${name}`, { method:'POST', headers:{...authHeaders, Authorization:`Bearer ${token}`}, body:JSON.stringify(body) });
  try {
    for (const name of ['Anna', 'Erik', 'Sara']) {
      const email = `kudos-e2e-${name.toLowerCase()}-${Date.now()}@example.invalid`;
      const password = `Local-Kudos-${Date.now()}!`;
      const user = await localRequest(`${stack.api}/auth/v1/admin/users`, {method:'POST', headers:adminHeaders, body:JSON.stringify({email,password,email_confirm:true})});
      assert.match(user.id,/^[a-f0-9-]{36}$/i);
      created.push(user.id);
      runLocalSql(`insert into public.profiles(id,email,display_name,auto_elimination_recheck_after) values ('${user.id}','${email}','Kudos E2E ${name}','2026-10-06');`,env);
      const session = await localRequest(`${stack.api}/auth/v1/token?grant_type=password`,{method:'POST',headers:authHeaders,body:JSON.stringify({email,password})});
      users.push({id:user.id,session,name});
    }
    const [anna,erik,sara] = users;
    runLocalSql(`insert into private.bingo_activity_events(user_id,activity_key,activity_type,cell_index,result_date,event_at) values
      ('${erik.id}','cell:1','bingo_cell',1,'2026-10-06',now()+interval '1 second'),
      ('${erik.id}','cell:7','bingo_cell',7,'2026-10-06',now()+interval '2 seconds'),
      ('${anna.id}','cell:0','bingo_cell',0,'2026-10-06',now()+interval '3 seconds');`,env);
    const events = await rpc(anna.session.access_token,'get_kudos_activity_feed',{p_limit:51,p_offset:0});
    const target = events.find(e=>e.display_name==='Kudos E2E Erik' && e.activity_label==='30 minuter löpning');
    assert.ok(target);
    assert.deepEqual(Object.keys(target).sort(),['display_name','multiplier','activity_type','event_at','result_date','activity_label','activity_key','is_own','kudos_sent'].sort());
    const anonymous = await rpc(stack.publishable,'get_activity_feed',{p_limit:4,p_offset:0});
    assert.equal(anonymous.length,4);
    assert.ok(!JSON.stringify(anonymous).includes(erik.id));
    await assert.rejects(()=>rpc(stack.publishable,'get_my_activity_kudos'));
    // Concurrent retries must create exactly one private notification.
    await Promise.all(Array.from({length:8},()=>rpc(sara.session.access_token,'send_activity_kudos',{p_activity_key:target.activity_key,p_message:null})));
    assert.equal(await rpc(erik.session.access_token,'get_my_kudos_unread_count'),1);
    assert.equal((await rpc(sara.session.access_token,'get_my_activity_kudos')).length,0);
    const received = await rpc(erik.session.access_token,'get_my_activity_kudos');
    assert.equal(await rpc(sara.session.access_token,'mark_activity_kudos_read',{p_kudos_keys:received.map(k=>k.kudos_key)}),0);
    assert.equal(await rpc(erik.session.access_token,'get_my_kudos_unread_count'),1);

    server = http.createServer(async(req,res)=>{
      try {
        const pathname = new URL(req.url,'http://localhost').pathname;
        res.setHeader('Cache-Control','no-store');
        if(pathname==='/api/config') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({supabaseUrl:stack.api,supabasePublishableKey:stack.publishable}));return;}
        const name = path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
        if(!name.startsWith(root+path.sep) || /\/(?:supabase|qa|\.git)\//.test(name)) throw Error('Denied');
        res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript');
        res.end(await fs.readFile(name));
      }catch{res.writeHead(404).end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
    const contextFor=async(session)=>{
      const context=await browser.newContext();
      await context.route('**/supabase.js',r=>r.fulfill({contentType:'text/javascript',body:sdk}));
      if(session)await context.addInitScript(({session})=>{
        localStorage.setItem('sb-127-auth-token',JSON.stringify(session));
        localStorage.setItem('soberoktober-trump-quote-seen-date',new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
      },{session});
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      return {page,context};
    };
    console.log('Local API/security checks passed.');
    const {page,context}=await contextFor(anna.session);
    await page.goto(origin+'/aktivitet/');
    const running=page.locator('.activity-item').filter({hasText:'Kudos E2E Erik klarade en bingoruta: 30 minuter löpning'});
    await running.locator('.kudos-button').waitFor();
    assert.equal(await page.locator('.activity-item').filter({hasText:'Kudos E2E Anna'}).locator('.kudos-button').count(),0);
    await running.locator('button').click();
    await page.getByLabel('En egen hälsning? (valfritt)').fill('  Bra kämpat! <script>alert(1)</script>  ');
    await page.getByRole('button',{name:'Skicka kudos 👏'}).click();
    await running.getByRole('button',{name:'Kudos skickat'}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    assert.equal(await rpc(erik.session.access_token,'get_my_kudos_unread_count'),2);
    await page.reload();
    await running.getByRole('button',{name:'Kudos skickat'}).waitFor();
    assert.equal(await running.locator('button').isDisabled(),true);

    console.log('Sender send/reload checks passed.');
    const recipient=await contextFor(erik.session);
    await recipient.page.goto(origin+'/aktivitet/');
    await recipient.page.getByRole('button',{name:'Dina kudos, 2 nya',exact:true}).waitFor();
    await recipient.page.locator('#kudos-inbox-button').click();
    await recipient.page.locator('.kudos-note-message').waitFor();
    assert.equal(await recipient.page.locator('.kudos-note-message').textContent(),'Bra kämpat! <script>alert(1)</script>');
    assert.equal(await recipient.page.locator('.kudos-note-message script').count(),0);
    await recipient.page.waitForFunction(()=>document.querySelector('#kudos-unread-count').textContent==='');
    assert.equal(await rpc(erik.session.access_token,'get_my_kudos_unread_count'),0);
    await recipient.page.getByRole('button',{name:'Stäng',exact:true}).click();
    // A second device uses database read status, not localStorage receipts.
    const secondDevice=await contextFor(erik.session);
    await secondDevice.page.goto(origin+'/aktivitet/');
    await secondDevice.page.getByRole('button',{name:'Dina kudos',exact:true}).waitFor();
    assert.equal(await secondDevice.page.locator('#kudos-unread-count').textContent(),'');

    console.log('Recipient and second-device read checks passed.');
    // Retry after a real network failure, with keyboard/backdrop dismissal.
    const cycling=page.locator('.activity-item').filter({hasText:'Kudos E2E Erik klarade en bingoruta: Cykla till jobbet'});
    await page.route('**/rpc/send_activity_kudos',r=>r.fulfill({status:503,json:{code:'503',message:'Fixture network failure'}}),{times:1});
    await cycling.locator('button').click();
    await page.getByRole('button',{name:'Skicka kudos 👏'}).click();
    await page.waitForFunction(()=>document.querySelector('.kudos-status').textContent.includes('kunde inte skickas'));
    assert.equal(await page.getByRole('button',{name:'Skicka kudos 👏'}).isEnabled(),true);
    await page.getByRole('button',{name:'Skicka kudos 👏'}).click();
    await cycling.getByRole('button',{name:'Kudos skickat'}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('dialog[open]'));

    const guest=await contextFor(null);
    await guest.page.goto(origin+'/aktivitet/');
    await guest.page.locator('.activity-message').first().waitFor();
    assert.equal(await guest.page.locator('.kudos-button').count(),0);
    assert.equal(await guest.page.locator('#kudos-inbox-button').isVisible(),false);

    // Actual home page and full feed at small phone, mobile, tablet, desktop.
    for(const width of [320,390,768,1440]) {
      console.log('Checking width '+width);
      await page.setViewportSize({width,height:1000});
      await page.goto(origin+'/');
      await page.waitForFunction(()=>document.querySelector('#app-shell').getAttribute('aria-hidden')!=='true');
      await page.locator('#activity-preview-list .activity-message').first().waitFor();
      assert.equal(await page.locator('#activity-preview-list .activity-item').count(),4);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Home overflow at ${width}`);
      await page.locator('#kudos-inbox-button').click();
      await page.locator('.kudos-empty').waitFor();
      assert.equal(await page.evaluate(()=>document.querySelector('dialog').getBoundingClientRect().right<=innerWidth),true);
      await page.keyboard.press('Escape');
      await page.locator('dialog').waitFor({state:'detached'});
      await page.goto(origin+'/aktivitet/');
      await page.locator('.activity-message').first().waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Activity overflow at ${width}`);
    }
    // Logging out removes private inbox and per-user controls without a reload.
    await page.evaluate(async()=>{ const c=await window.SoberActivity.createClient();await c.auth.signOut(); });
    await page.waitForFunction(()=>document.querySelector('#kudos-inbox-button').hidden && !document.querySelector('.kudos-button'));
    assert.deepEqual(errors,[],'No browser exceptions');
    console.log('PASS: real local Auth/RPC, concurrent duplicate sends, private messages, recipient-only read status, two devices, XSS, retry, logout, both feeds, 320/390/768/1440px.');
    await context.close();
  }finally {
    await browser?.close();
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const id of created) {
      await localRequest(`${stack.api}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:adminHeaders});
    }
  }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
