(() => {
  'use strict';
  const L=window.SoberVoteLogic;
  const $=id=>document.getElementById(id);
  let preview=false,voteRpc='my_workout_vote',client,session,state,epoch=0,busy=false,selection=null,selectionDate='',fingerprint='',timer,unsubscribe,celebrationTimer,readVersion=0,completionDate='';
  const element=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
  const clockText=iso=>new Intl.DateTimeFormat('sv-SE',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Stockholm'}).format(new Date(iso));
  const setMessage=text=>{$('vote-feedback').textContent=text;};
  const iconPaths={
    strength:['M3 8v8m4-11v14m10-14v14m4-11v8M7 12h10'],
    walk:['M14 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4','m10 21 2-7-3-4 3-3 3 4 4 1M9 10l-3 4m6 0 5 7'],
    run:['M16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4','m4 16 5-1 3-6 4 3 4-1M9 21l4-6 4 2 1 4M7 6l5 2'],
    mobility:['M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4','M12 7v8m-8-4 8-3 8 3M5 21l7-6 7 6'],
    swim:['M3 20q2-3 4 0t4 0 4 0 4 0','m5 14 6-7 6 7M11 7 7 4','M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4'],
    bike:['M6 21a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 21a4 4 0 1 0 0-8 4 4 0 0 0 0 8','m6 17 4-9 8 9M8 8h6m0-4h3l1 5'],
    racket:['M10 14c-3-2-3-6 0-9s6-3 8-1 2 6-1 9-5 3-7 1ZM10 14l-7 7M10 6l6 6M13 4l6 6M8 9l5 5M15 4l-6 9M18 6l-6 9'],
    activity:['m12 3 2.5 5.5L21 9l-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 9l6.5-.5Z']
  };
  function workoutIcon(title){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
    for(const d of iconPaths[L.iconKind(title)]){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}return svg;
  }
  function updateChoice(){
    const poll=state&&L.view(state).poll;if(!poll)return;
    const voted=poll.own_vote!==null,chosen=poll.options.find(option=>option.id===selection);
    $('vote-submit').disabled=busy||selection===null;
    $('vote-submit').textContent=busy?'Sparar din röst…':chosen?'Jag röstar på '+chosen.title+' →':'Lägg min röst →';
    $('vote-selection-copy').textContent=!voted&&chosen?'Bra val! Du kan byta favorit tills du lägger din röst.':'';
    document.querySelectorAll('.vote-option').forEach(label=>{
      const checked=label.querySelector('input').checked;label.dataset.chosen=String(checked);
      label.querySelector('.vote-option-pick').textContent=checked?(voted?'Din röst ✓':'Din favorit ✓'):'Välj pass';
    });
    const stage=voted?3:selection===null?1:2;
    document.querySelectorAll('[data-vote-stage]').forEach(item=>{const number=Number(item.dataset.voteStage);item.dataset.done=String(number<stage);if(number===stage)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
  }
  function celebrate(){
    const container=$('vote-celebration');clearTimeout(celebrationTimer);container.replaceChildren();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(let index=0;index<18;index++){const piece=element('span');piece.style.setProperty('--x',(12+index*4.4)+'%');piece.style.setProperty('--turn',(index%2?-1:1)*(70+index*17)+'deg');piece.style.setProperty('--delay',(index%5)*35+'ms');container.append(piece);}
    celebrationTimer=setTimeout(()=>container.replaceChildren(),1500);
  }

  function isLocal(config){try{const url=new URL(config.supabaseUrl);return ['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&location.protocol==='http:'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.port==='54321'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash;}catch{return false;}}
  function activate(active){
    const requested=new URLSearchParams(location.search).get('roulette-date');
    const keepRoulette=L.rouletteAvailable(state?.today||window.SoberOctoberCalendar?.stockholmDate?.()||'',requested);
    document.body.classList.toggle('vote-roulette-access',keepRoulette);
    if(active&&!keepRoulette&&document.querySelector('#roulette-dialog')?.open)document.querySelector('#close-roulette')?.click();
    document.body.classList.toggle('vote-preview-active',active);
    $('vote-preview').hidden=!active;
    const roulette=document.querySelector('#training-roulette'),panel=$('vote-preview');
    if(active&&keepRoulette&&roulette&&panel.nextElementSibling!==roulette)panel.after(roulette);
    $('vote-sunday-note').hidden=!active||state?.today!=='2026-10-18';
    const nav=document.querySelector('.main-nav a[href="#training-roulette"],.main-nav a[href="#vote-preview"],.main-nav a[href="#dagens-pass"],.main-nav a[href="#competition-bingo"]');
    if(nav){nav.href=active?'#vote-preview':'#training-roulette';nav.textContent=active?'Dagens val':'Spinn The Wheel';}
  }
  function render(){
    if(!state)return;
    const current=L.view(state),active=current.phase!=='before';activate(active);
    $('vote-admin-tools').hidden=!preview||!state.is_admin;
    $('vote-clock-label').textContent=(state.simulated?'Testklocka: ':'Svensk tid: ')+clockText(state.now);
    $('vote-clock-state').textContent=current.phase==='before'?'Röstningen öppnar söndag 18 oktober kl. 21.00.':state.simulated?'Tiden står still tills du flyttar testklockan.':'Testet använder verklig svensk tid.';
    const before=Date.parse(state.now)<L.OPEN;
    $('vote-open-sunday').hidden=!before;
    $('vote-open-next').hidden=before||Boolean(current.poll)||!current.next;
    $('vote-open-next').dataset.instant=current.next?.opens||'';
    document.querySelectorAll('[data-vote-admin]').forEach(button=>button.disabled=busy);
    const nextMidnight=Date.parse(state.now)<L.OPEN?'2026-10-19T00:00:00+02:00':current.poll?.closes;
    $('vote-next-midnight').disabled=busy||!nextMidnight;
    $('vote-next-midnight').dataset.instant=nextMidnight||'';
    if(!active)return;
    if(current.poll)$('vote-countdown').textContent=L.timeLeft(state.now,current.poll.closes);
    const signature=JSON.stringify([current.phase,current.poll?.date,current.next?.date,{...state,now:undefined},busy]);
    if(signature===fingerprint)return;
    fingerprint=signature;
    const today=current.today,showcase=$('vote-today');showcase.hidden=!today;
    if(today){
      const result=today.result,option=today.options.find(o=>o.id===result.option_id);
      $('vote-today-date').textContent=L.dateLabel(today.date);
      $('vote-today-title').textContent=option.title;
      $('vote-today-description').textContent=option.description;
      if(completionDate!==today.date){completionDate=today.date;$('vote-completion-feedback').textContent='';}
      const stepped=today.completion?.kind==='steps',completed=Boolean(today.completion)&&!stepped;$('vote-completion').dataset.completed=String(completed);
      $('vote-completion-summary').textContent=stepped?'✓ 10 000 steg är registrerade · 1 poäng. Klicka ur stegen nedan om du vill göra passet istället.':completed?'✓ Snyggt jobbat! 3 poäng är registrerade.':state.can_vote?'Kör dagens vinnande pass och hämta 3 poäng. Du behöver inte ha röstat för att vara med.':'Endast aktiva deltagare kan klarmarkera pass.';
      $('vote-complete').hidden=completed;$('vote-complete').disabled=busy||!state.can_vote||stepped;
      $('vote-complete').textContent=busy?'Sparar…':'Jag har klarat passet · 3 poäng';
      $('vote-undo-complete').hidden=!completed;$('vote-undo-complete').disabled=busy;
      $('vote-steps-choice').setAttribute('aria-pressed',String(stepped));$('vote-steps-choice').disabled=busy||completed||(!state.can_vote&&!stepped);
      $('vote-steps-hint').textContent=stepped?'Stegen är sparade. Klicka igen för att ångra.':completed?'Ångra klarmarkeringen ovan om du vill välja steg istället.':'Ett alternativ till passet. Du får antingen 1 stegpoäng eller 3 poäng för passet.';
      $('vote-winner-breakdown').replaceChildren(...today.options.map(item=>{const row=element('div',undefined,'vote-winner-row');row.dataset.winner=String(item.id===result.option_id);row.append(element('span',item.title+(item.id===result.option_id?' ✓':'')),element('strong',item.votes+' '+(item.votes===1?'röst':'röster')));return row;}));
      $('vote-today-outcome').textContent=!result.total_votes?'Inga röster kom in. Passet lottades bland de fyra alternativen.':result.tied_options>1?'Lottat mellan '+result.tied_options+' alternativ med lika många röster.':option.votes+' av '+result.total_votes+' röster. Flest röster vann!';
    }
    const poll=current.poll;
    const pollDate=poll?.date||'';if(selectionDate!==pollDate){selection=null;selectionDate=pollDate;setMessage('');}
    $('vote-waiting').hidden=!current.next||Boolean(poll);
    if(current.next&&!poll)$('vote-waiting-copy').textContent='Röstningen för '+L.dateLabel(current.next.date)+' öppnar '+clockText(current.next.opens)+'.';
    $('vote-title').textContent=poll?'Vad kör vi imorgon?':current.phase==='finished'?'Vilken vecka vi fick!':'Det här kör vi idag!';
    document.querySelector('.vote-lead').textContent=poll?'Du väljer din favorit. Vi gör det tillsammans.':current.phase==='finished'?'Sju dagar av gemensamma val. Här är passen vi röstade fram.':current.next?'Dagens vinnare är här. Dags att röra på sig!':'Veckans sista vinnare är här. Tack för alla röster!';
    $('vote-ballot').hidden=!poll;
    $('vote-week-finished').hidden=Boolean(poll)||Boolean(current.next);
    $('vote-week-finished').textContent=current.phase==='finished'?'Röstningsveckan är avslutad. Du kan se alla vinnare nedan.':'Det här är veckans sista framröstade pass. Tack för alla röster!';
    if(poll){
      const voted=poll.own_vote!==null,count=L.total(poll);
      $('vote-target').textContent=L.dateLabel(poll.date);
      $('vote-deadline').textContent='Rösta senast kl. 23.59 idag. Avgörs vid midnatt, svensk tid.';
      $('vote-total').textContent=count?count+' '+(count===1?'röst':'röster')+' i potten':'Bli först att rösta!';
      $('vote-ballot-intro').textContent=voted?'Så här ligger det till just nu. Vid midnatt vet vi vad vi kör!':'Fyra pass att välja på. Vilket vill du få med hela gänget på?';
      const focusedOption=document.activeElement?.matches('input[name="workout-vote"]')?document.activeElement.value:null;
      $('vote-options').replaceChildren(...poll.options.map(option=>{
        const label=element('label',undefined,'vote-option');label.dataset.tone=String(option.id%4);label.dataset.locked=String(voted||!state.can_vote);label.dataset.chosen=String(voted?poll.own_vote===option.id:selection===option.id);
        const input=element('input');input.type='radio';input.name='workout-vote';input.value=option.id;input.checked=voted?poll.own_vote===option.id:selection===option.id;input.disabled=busy||voted||!state.can_vote;
        const copy=element('span',undefined,'vote-option-copy');copy.append(element('strong',option.title),element('span',option.description));const icon=element('span',undefined,'vote-option-icon');icon.append(workoutIcon(option.title));
        const number=element('span','0'+(option.id+1),'vote-option-number');number.setAttribute('aria-hidden','true');
        const pick=element('span','Välj pass','vote-option-pick');pick.setAttribute('aria-hidden','true');label.append(input,icon,number,copy,pick);
        if(voted){const meta=element('span',option.votes+' '+(option.votes===1?'röst':'röster')+' · '+L.percentage(option.votes,count)+' %','vote-option-result');if(poll.own_vote===option.id)meta.append(element('b','Din röst','vote-own-mark'));const bar=element('span',undefined,'vote-bar');bar.style.setProperty('--vote-share',L.percentage(option.votes,count)+'%');label.append(meta,bar);}
        return label;
      }));
      $('vote-submit').hidden=voted||!state.can_vote;
      $('vote-receipt').hidden=!voted;$('vote-race').hidden=!voted;
      if(voted){$('vote-receipt-copy').textContent='Du har röstat på '+poll.options.find(option=>option.id===poll.own_vote).title+'. Nu håller vi tummarna!';const race=L.race(poll);$('vote-race-title').textContent=race.title;$('vote-race-copy').textContent=race.copy;}
      updateChoice();
      if(focusedOption!==null&&!busy){const input=[...$('vote-options').querySelectorAll('input')].find(node=>node.value===focusedOption);if(input&&!input.disabled)input.focus({preventScroll:true});}
      $('vote-once-note').textContent=voted?'Du kan rösta igen på nästa dags pass när den nya omröstningen öppnar.':!state.can_vote?'Endast aktiva deltagare kan rösta.':'Du har en röst per omröstning. När du skickat den kan den inte ändras.';
      $('vote-ballot').setAttribute('aria-busy',String(busy));
    }
    const history=state.days.filter(day=>day.result&&day.date!==today?.date);
    $('vote-history').replaceChildren(...history.map(day=>{const winner=day.options.find(o=>o.id===day.result.option_id);const item=element('li');item.append(element('span',L.dateLabel(day.date)),element('strong',winner.title),element('small',day.result.total_votes+' röster'+(day.result.tied_options>1?' · lottning':'')));return item;}));
    $('vote-history-section').hidden=!history.length;
  }
  async function refresh(){
    const token=epoch;if(!session||busy)return;const version=++readVersion;
    try{const {data,error}=await client.rpc(voteRpc);if(token!==epoch||version!==readVersion)return;if(error)throw error;state=data;render();if(!$('vote-retry').hidden)setMessage('');$('vote-retry').hidden=true;}
    catch(error){if(token!==epoch||version!==readVersion)return;if(!state){activate(true);$('vote-ballot').hidden=true;$('vote-waiting').hidden=true;$('vote-week-finished').hidden=true;}setMessage(error.message||'Röstningen kunde inte laddas.');$('vote-retry').hidden=false;}
  }
  async function submit(event){
    event.preventDefault();if(!state||busy||selection===null)return;
    const poll=L.view(state).poll;if(!poll)return;
    let saved=false;const token=epoch,chosen=selection;busy=true;readVersion++;render();setMessage('');
    try{const {data,error}=await client.rpc(voteRpc,{p_action:'vote',p_date:poll.date,p_option:chosen});if(token!==epoch)return;if(error)throw error;state=data;saved=true;setMessage('Din röst är sparad. Tack!');}
    catch(error){if(token!==epoch)return;setMessage(error.message||'Rösten kunde inte sparas. Försök igen.');}
    finally{if(token===epoch){busy=false;fingerprint='';render();await refresh();if(token!==epoch)return;if(saved){celebrate();$('vote-receipt-title').focus({preventScroll:false});}else $('vote-feedback').focus({preventScroll:true});}}
  }
  async function complete(done){
    const today=state&&L.view(state).today;if(!today||busy||!session)return;
    const token=epoch;busy=true;readVersion++;render();$('vote-completion-feedback').textContent='';
    try{
      const {data,error}=await client.rpc(voteRpc,{p_action:done?'complete':'uncomplete',p_date:today.date});
      if(token!==epoch)return;if(error)throw error;state=data;
      $('vote-completion-feedback').textContent=done?'Dagens pass är sparat. Du fick 3 poäng!':'Klarmarkeringen är ångrad och de 3 poängen är borttagna.';
      window.dispatchEvent(new CustomEvent('vote-result-changed'));
      if(done)celebrate();
    }catch(error){if(token===epoch)$('vote-completion-feedback').textContent=error.message||'Passet kunde inte sparas. Försök igen.';}
    finally{if(token===epoch){busy=false;fingerprint='';render();await refresh();if(token===epoch)$('vote-completion-feedback').focus({preventScroll:true});}}
  }
  async function steps(){
    const today=state&&L.view(state).today;if(!today||busy||!session)return;
    const checked=today.completion?.kind==='steps',token=epoch;busy=true;readVersion++;render();$('vote-completion-feedback').textContent='';
    try{
      const {data,error}=await client.rpc(voteRpc,{p_action:checked?'unsteps':'steps',p_date:today.date});
      if(token!==epoch)return;if(error)throw error;state=data;
      $('vote-completion-feedback').textContent=checked?'Stegen är avmarkerade och poängen borttagen. Nu kan du välja dagens pass.':'10 000 steg är sparade. Du fick 1 poäng!';
      window.dispatchEvent(new CustomEvent('vote-result-changed'));
    }catch(error){if(token===epoch)$('vote-completion-feedback').textContent=error.message||'Stegen kunde inte sparas. Försök igen.';}
    finally{if(token===epoch){busy=false;fingerprint='';render();await refresh();if(token===epoch)$('vote-completion-feedback').focus({preventScroll:true});}}
  }
  async function admin(action,instant){
    if(!preview||busy||!state?.is_admin)return;
    if(action==='reset'&&!confirm('Slumpa en ny testvecka och ta bort alla lokala teströster och vinnare? Testklockan börjar om före söndagens öppning. Även klarmarkeringar och deras testpoäng i röstningstestet tas bort. Övriga poäng och träningsdata bevaras.'))return;
    const token=epoch;busy=true;readVersion++;render();$('vote-admin-feedback').textContent='';
    try{const {data,error}=await client.rpc('local_workout_vote_admin',{p_action:action,p_now:instant||null});if(token!==epoch)return;if(error)throw error;state=data;selection=null;selectionDate='';setMessage('');$('vote-admin-feedback').textContent=action==='reset'?'Omröstningstestet är återställt.':'Testklockan är uppdaterad.';if(action==='reset')window.dispatchEvent(new CustomEvent('vote-result-changed'));}
    catch(error){if(token===epoch)$('vote-admin-feedback').textContent=error.message;}
    finally{if(token===epoch){busy=false;fingerprint='';render();}}
  }
  function renderGuest(){
    if(preview)return;
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm'}).format(new Date());
    state={now:new Date().toISOString(),today,days:[],is_admin:false,can_vote:false,simulated:false};
    render();$('vote-access').hidden=false;$('vote-week-finished').hidden=true;$('vote-refresh').hidden=true;
    $('vote-title').textContent='Dagens val';document.querySelector('.vote-lead').textContent='Logga in för att rösta och se dagens framröstade pass.';
  }
  async function changed(next){
    epoch++;clearTimeout(celebrationTimer);$('vote-celebration').replaceChildren();session=next;state=null;busy=false;fingerprint='';activate(false);selection=null;selectionDate='';setMessage('');$('vote-admin-tools').hidden=true;$('vote-admin-feedback').textContent='';$('vote-completion-feedback').textContent='';completionDate='';$('vote-today').hidden=true;$('vote-history-section').hidden=true;
    $('vote-access').hidden=true;$('vote-refresh').hidden=false;
    if(!session){renderGuest();return;}
    await refresh();
  }
  async function init(sharedClient,config){
    preview=config.votingPreview===true&&isLocal(config);
    if(!preview&&config.votingEnabled!==true)return;
    voteRpc=preview?'local_workout_vote':'my_workout_vote';
    client=sharedClient;document.body.classList.add('vote-preview-enabled');
    if(!preview)renderGuest();
    $('vote-login').addEventListener('click',()=>document.querySelector('#auth-trigger').click());
    $('vote-form').addEventListener('submit',submit);
    $('vote-options').addEventListener('change',event=>{if(event.target.name!=='workout-vote')return;selection=Number(event.target.value);updateChoice();});
    $('vote-steps-choice').addEventListener('click',steps);
    $('vote-complete').addEventListener('click',()=>complete(true));
    $('vote-undo-complete').addEventListener('click',()=>complete(false));
    $('vote-retry').addEventListener('click',refresh);
    $('vote-refresh').addEventListener('click',refresh);
    $('vote-open-sunday').addEventListener('click',()=>admin('clock','2026-10-18T21:00:00+02:00'));
    $('vote-open-next').addEventListener('click',()=>admin('clock',$('vote-open-next').dataset.instant));
    $('vote-next-midnight').addEventListener('click',()=>admin('clock',$('vote-next-midnight').dataset.instant));
    $('vote-reset').addEventListener('click',()=>admin('reset'));
    $('vote-real-time').addEventListener('click',()=>admin('real_time'));
    unsubscribe=client.auth.onAuthStateChange((event,next)=>{if(event!=='INITIAL_SESSION'&&event!=='TOKEN_REFRESHED')setTimeout(()=>changed(next),0);}).data?.subscription;
    const {data}=await client.auth.getSession();await changed(data.session);
    timer=setInterval(()=>{if(!document.hidden){if(!session)renderGuest();else void refresh();}},5000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
    window.addEventListener('pagehide',event=>{if(!event.persisted){clearInterval(timer);unsubscribe?.unsubscribe();}});
  }
  window.SoberVotePreview=Object.freeze({init});
})();
