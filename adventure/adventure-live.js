/* Connected mode is explicit; the isolated 3002 sketch never contacts an API. */
(() => {
 'use strict';
 const local = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 if (new URLSearchParams(location.search).get('live') !== '1') {
  if (!local) location.replace('/');
  return;
 }
 document.documentElement.classList.add('adventure-connected','adventure-loading');
 const $ = id => document.getElementById(id);
 const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.AdventureConnection = (async () => {
  const gate=document.createElement('section');gate.className='adventure-login';gate.setAttribute('role','status');
  gate.innerHTML='<p class="eyebrow">SOBER OKTOBER · FINALVECKAN</p><h1>Din resa väntar.</h1><p id="adventure-login-message">Hämtar din sparade resa…</p><button id="adventure-login-button" class="primary-button" hidden>Logga in med Google →</button><a href="/">Till startsidan</a>';
  document.body.append(gate);
  let client, data, apply, busy=false, pending=null, scope='month', expanded=false, api, lastRefresh=0;
  const request=async(action='get',payload={})=>{
   const result=await client.rpc('my_adventure',{p_action:action,p_payload:{...payload,board_size:window.SoberAdventure.BOARD_SIZE,shortcut_version:1,ride_version:1}}).abortSignal(AbortSignal.timeout(15000));
   if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.code});
   if(!result.data?.profile?.id || !window.SoberAdventure.restore(result.data.state))throw new Error('Den sparade resan kunde inte läsas. Inget har nollställts.');
   return result.data;
  };
  function redraw(){if(apply)apply(data);}
  function setBusy(value){busy=value;redraw();}
  async function refresh(){
   if(busy)return false;setBusy(true);
   try { const next=await request();data=next;lastRefresh=Date.now();redraw();$('storage-status').textContent='Din resa är synkad med ditt konto.';return true; }
   catch(error){$('storage-status').textContent='Kunde inte synka: '+error.message+' Din sparade resa finns kvar. Försök uppdatera igen.';return false;}
   finally{setBusy(false);}
  }
  async function commit(action,fields={}){
   if(busy)return false;
   const fingerprint=JSON.stringify({action,fields});
   if(pending && pending.fingerprint!==fingerprint){$('feedback').textContent='En tidigare registrering behöver kontrolleras. Klicka på Uppdatera resan först.';return false;}
   if(!pending)pending={fingerprint,action,payload:{...fields,expected_revision:data.revision,request_id:crypto.randomUUID()}};
   setBusy(true);$('storage-status').textContent='Sparar på ditt konto…';
   try{data=await request(pending.action,pending.payload);pending=null;redraw();$('storage-status').textContent='Sparat på ditt konto.';return true;}
   catch(error){
    if(/^[A-Z0-9]{5}$/.test(error.code||'')){pending=null;try{data=await request();redraw();}catch{}}
    $('feedback').textContent=error.message+(pending?' Klicka samma knapp igen för att kontrollera registreringen. Den räknas bara en gång.':'');return false;
   }finally{setBusy(false);}
  }
  async function markTreatSeen(){
   const actor=data.profile.id;
   try{const result=await request('treat_seen',{request_id:crypto.randomUUID()});if(data.profile.id===actor&&result.profile.id===actor)data.profile.icecream_seen=true;return true;}catch{return false;}
  }
  const R={get data(){return data;},get busy(){return busy;},get pendingRide(){return pending?.action==='ride'?pending.payload.choice:null;},get pendingShortcut(){return pending?.action==='shortcut'?pending.payload.choice:null;},commit,refresh,markTreatSeen,
   bind(callback){apply=callback;},
   welcome(profile,force,onClose){
    if(!profile||(!force&&data.profile.welcome_seen))return false;
    const shown=window.AdventureWelcome.show(profile,{force:true,onClose});
    if(shown&&!data.profile.welcome_seen)commit('seen');return shown;
   }
  };
  function mountFor(player){const profile=window.AdventurePersonalPawns.forId(player.pawn_id);return profile?.mount||api.snapshot().players.find(p=>p.id===player.id||p.own&&player.id===data.profile.id)?.mount;}
  function showRules(){const content=api.detail('Så tar du dig genom riket.','REGLER OCH POÄNG · FINALVECKAN');content.innerHTML+='<ol class="home-rules"><li><strong>Träna dig fram till slottet.</strong>15 squats, 10 armhävningar, 5 pull-ups eller 1 km löpning flyttar dig en ruta. Resan och bossarna ger inga poäng.</li><li><strong>Stå emot frestelserna.</strong>Gör bossens uppdrag, dela i gruppen och klarmarkera för att fortsätta.</li><li><strong>Nå ruta 60. Lås upp poängjakten.</strong>Därefter ger nya 15 squats, 10 armhävningar, 5 pull-ups eller 1 km löpning 1 poäng per registrering.</li><li><strong>Final den 31 oktober.</strong>Bakrusbaronen öppnar då. Poängjakten fortsätter till kl. 23.59.59 svensk tid, även efter segern.</li></ol><p>Dagens bonus räknas separat och styrs av admin. Din resa fortsätter mellan dagar och enheter.</p>';}
  function showAccount(){
   const content=api.detail(data.profile.name,'DITT KONTO');const own=api.snapshot().players.find(p=>p.own);
   content.innerHTML+=`<div class="home-account-pawn">${api.pawnMarkup(own.mount,'',160)}</div><div class="home-dialog-actions"><button type="button" id="home-account-pawn" class="primary-button">${data.profile.pawn_id?'Visa min pjäs igen ✦':'Byt min pjäs'}</button><button type="button" id="home-account-journey" class="text-button">Visa min resedagbok ↗</button><a href="/min-oktober/">Min oktober ↗</a><a href="/regler/">Alla tävlingsregler ↗</a><button type="button" id="home-sign-out" class="text-button">Logga ut</button></div>`;
   $('home-account-pawn').onclick=()=>{api.closeDialog('detail-dialog');api.showOwnPawn();};
   $('home-account-journey').onclick=()=>{api.closeDialog('detail-dialog');api.showJournal();};
   $('home-sign-out').onclick=async()=>{const {error}=await client.auth.signOut();if(error){$('feedback').textContent='Kunde inte logga ut. Försök igen.';return;}location.replace('/');};
  }
  function renderHome(){
   const snapshot=api.snapshot();$('home-username').textContent=data.profile.name;
   $('home-admin').hidden=!data.profile.is_admin;$('home-admin').disabled=!data.profile.is_admin;
   const bonus=data.bonus,done=!!bonus?.claimed;
   $('home-bonus-description').textContent=bonus?.description||'Dagens bonus kommer snart.';
   document.querySelector('.home-bonus summary strong').textContent=bonus?.points?'+'+bonus.points+' p':'';
   $('home-bonus-toggle').hidden=!bonus?.description||!bonus.points;
   $('home-bonus-toggle').disabled=busy||!data.active||data.profile.status!=='active';
   $('home-bonus-toggle').textContent=done?'✓ Bonusen är klar · ångra':'Jag har klarat bonusen · +'+bonus?.points+' poäng';
   $('home-bonus-toggle').setAttribute('aria-pressed',String(done));$('home-bonus-label').textContent=done?'Dagens bonus är klar':'Dagens bonus';
   const players=new Map(data.players.map(p=>[p.id,p]));
   const rows=data.standings.map(row=>({...row,player:players.get(row.id),score:Number(scope==='month'?row.points:row.final_points)})).filter(r=>r.player).sort((a,b)=>b.score-a.score||(scope==='month'?b.days-a.days:0)||a.player.name.localeCompare(b.player.name,'sv'));
   let rank=0,previous;
   $('home-leaderboard-list').innerHTML=rows.map((row,i)=>{const days=scope==='month'?row.days:0;if(!previous||row.score!==previous.score||days!==previous.days)rank=i+1;previous={score:row.score,days};return `<li class="home-rank-row" data-own="${row.id===data.profile.id}" data-participant="${row.id}" data-points="${row.score}"><span class="home-rank-number">${rank===1&&row.score>0?'♛':rank}</span>${api.pawnMarkup(mountFor(row.player),'',60)}<div class="home-rank-person"><strong>${esc(row.player.name)}${row.id===data.profile.id?'<span class="home-you">DU</span>':''}${row.eliminated?' · Utslagen':''}</strong><small>${row.final_points} poäng under finalveckan</small></div><strong class="home-rank-points">${row.score.toLocaleString('sv-SE')}<small>poäng</small></strong></li>`;}).join('');
   $('home-ranking-note').textContent=scope==='month'?'Alla teman och bonusar räknas. Genomförda dagar avgör vid lika.':'Endast poängjakten och bonusar 26–31 oktober. Resan och bossarna ger 0 poäng.';
   document.querySelectorAll('[data-home-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.homeScope===scope)));
   const entries=[...data.activity,...(data.previous_activity||[]).map(e=>({...e,legacy:true,at:e.event_at,date:e.result_date}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,expanded?50:6);
   $('home-activity-list').innerHTML=entries.map(entry=>{if(entry.legacy){return `<li class="home-activity-row"><div class="home-activity-avatar" aria-hidden="true">SO</div><div><strong>${esc(window.ActivityLogic.sentence(entry))}</strong><small>${esc(entry.date)}</small></div></li>`;}const player=players.get(entry.user_id);if(!player)return '';const exercise=window.SoberAdventure.EXERCISES.find(e=>e.id===entry.exercise_id);const amount=exercise?(exercise.reps?exercise.reps+' '+exercise.label.toLowerCase():'1 km löpning'):'';const boss=window.SoberAdventure.BOSSES.find(b=>b.id===entry.boss_id);const title=entry.kind==='bonus'?player.name+' klarade dagens bonus':entry.kind==='boss'?player.name+' besegrade '+boss?.name:entry.kind==='score'?player.name+' samlade 1 poäng':player.name+' gick fram en ruta';return `<li class="home-activity-row"><div class="home-activity-avatar">${api.pawnMarkup(mountFor(player),'',52)}<span aria-hidden="true">${entry.kind==='boss'?'✦':entry.kind==='score'||entry.kind==='bonus'?'+':'↗'}</span></div><div><strong>${esc(title)}</strong><p>${esc(amount)}${amount?' · ':''}${entry.kind==='bonus'?'+'+entry.points+' poäng':entry.kind==='score'?'Poängjakten':'0 poäng'}</p><small>${entry.date===data.today?'I dag':esc(entry.date)} · ${new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'}).format(new Date(entry.at))}</small></div></li>`;}).join('')||'<li>Äventyret väntar på sina första steg.</li>';
   $('home-more-activity').hidden=data.activity.length+(data.previous_activity?.length||0)<=6;$('home-more-activity').textContent=expanded?'Visa färre händelser ↑':'Visa fler händelser ↓';
  }
  R.home={init(options){api=options;
   $('home-account').onclick=showAccount;$('home-rules').onclick=showRules;
   $('home-admin').onclick=()=>{if(data.profile.is_admin)location.assign('/admin/');};
   document.querySelectorAll('[data-home-scope]').forEach(b=>b.onclick=()=>{scope=b.dataset.homeScope;renderHome();});
   $('home-more-activity').onclick=()=>{expanded=!expanded;renderHome();};
   $('home-bonus-toggle').onclick=()=>commit(data.bonus?.claimed?'unbonus':'bonus');
  },render:renderHome,resetParticipant(){}};
  try{
   const response=await fetch('/api/config',{cache:'no-store',redirect:'error'});if(!response.ok)throw new Error('Anslutningen kunde inte startas. Försök ladda om sidan.');const config=await response.json();
   if(!config.adventureEnabled)throw new Error('Frestelsernas rike är inte aktiverat ännu.');
   if(config.adventureLocalPreview && (!local||!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(config.supabaseUrl)))throw new Error('Testläget kräver lokal Supabase.');
   await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/supabase-2.116.0.js';script.onload=resolve;script.onerror=()=>reject(new Error('Inloggningen kunde inte laddas.'));document.head.append(script);});
   client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
   const {data:auth,error}=await client.auth.getSession();if(error)throw error;
   if(!auth.session){
    $('adventure-login-message').textContent='Logga in för att hämta din egen pjäs och din sparade resa.';$('adventure-login-button').hidden=false;
    $('adventure-login-button').onclick=async()=>{const result=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/',location.origin).href}});if(result.error)$('adventure-login-message').textContent=result.error.message;};
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN')location.reload();});return new Promise(()=>{});
   }
   let profileResponse=await client.from('profiles').select('id,display_name').eq('id',auth.session.user.id).maybeSingle();
   if(profileResponse.error)throw profileResponse.error;
   if(!profileResponse.data){
    const created=await client.from('profiles').insert({id:auth.session.user.id,email:auth.session.user.email});
    if(created.error&&created.error.code!=='23505')throw created.error;
    profileResponse=await client.from('profiles').select('id,display_name').eq('id',auth.session.user.id).maybeSingle();if(profileResponse.error)throw profileResponse.error;
   }
   if(!profileResponse.data?.display_name){
    $('adventure-login-message').textContent='Vad ska vi kalla dig på kartan?';
    const form=document.createElement('form');form.className='adventure-name-form';form.innerHTML='<label for="adventure-display-name">Ditt deltagarnamn</label><input id="adventure-display-name" name="name" autocomplete="nickname" minlength="2" maxlength="32" required><button class="primary-button" type="submit">Till äventyret →</button><p id="adventure-name-status" role="status"></p>';
    gate.append(form);form.onsubmit=async event=>{event.preventDefault();const name=$('adventure-display-name').value.trim().replace(/\s+/g,' ');if(name.length<2)return;const button=form.querySelector('button');button.disabled=true;try{const saved=await client.from('profiles').update({display_name:name}).eq('id',auth.session.user.id).select('id');if(saved.error)throw saved.error;if(saved.data?.length!==1)throw new Error('Namnet kunde inte sparas.');location.reload();}catch(error){$('adventure-name-status').textContent=error.message;button.disabled=false;}};
    return new Promise(()=>{});
   }
   data=await request();
   client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||session&&session.user.id!==data.profile.id){document.querySelector('.page').inert=true;location.replace('/');}});
   if(config.adventureLocalPreview){const note=document.querySelector('.home-demo-note');note.innerHTML='<span>LOKALT DB-TEST</span><p>Riktig lokal inloggning och databas. Inga production-poäng ändras.</p>';}
   else document.querySelector('.home-demo-note').hidden=true;
   document.querySelectorAll('.test-tools,.home-demo-badge').forEach(n=>n.hidden=true);
   $('home-leaderboard-list').setAttribute('aria-label','Deltagarnas poäng');$('home-activity-list').setAttribute('aria-label','Senaste aktivitet');$('score-summary').setAttribute('aria-label','Dina poäng från poängjakten');
   const sync=document.createElement('button');sync.type='button';sync.id='adventure-refresh';sync.className='text-button';sync.textContent='Uppdatera resan ↻';sync.onclick=async()=>{if(pending){const fields=JSON.parse(pending.fingerprint).fields;await commit(pending.action,fields);}else await refresh();};$('storage-status').after(sync);
   document.documentElement.classList.remove('adventure-loading');gate.remove();
   const refreshVisible=()=>{if(!document.hidden&&Date.now()-lastRefresh>10000)refresh();};
   setInterval(refreshVisible,15000);window.addEventListener('focus',refreshVisible);document.addEventListener('visibilitychange',refreshVisible);
   return R;
  }catch(error){$('adventure-login-message').textContent=error.message;const retry=document.createElement('button');retry.className='primary-button';retry.textContent='Försök igen';retry.onclick=()=>location.reload();gate.append(retry);return new Promise(()=>{});}
 })();
})();
