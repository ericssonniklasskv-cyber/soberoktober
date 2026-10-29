/* Permanent returning-stranger card. The caller owns all saved state and commands. */
(() => {
 'use strict';
 const template=document.createElement('template');
 template.innerHTML=`<dialog class="shortcut-dialog ride-dialog return-ride-dialog" id="return-ride-dialog" aria-labelledby="return-title" aria-describedby="return-description">
<button type="button" class="shortcut-close" id="return-close" aria-label="Stäng mötet">×</button>
<div class="shortcut-scene" id="return-scene" role="img" aria-label="Din pjäs möter samma gubbe och varelse som på ruta 28">
<div class="ride-landscape" id="return-landscape" aria-hidden="true"></div>
<div class="return-forest" id="return-forest" hidden aria-hidden="true"><svg viewBox="0 0 680 330" preserveAspectRatio="xMidYMax slice"><rect width="680" height="330" fill="#c7cfad"/><circle cx="335" cy="94" r="78" fill="#f2ebc9"/><path d="M0 228q163-100 338-33t342-25v160H0Z" fill="#9aae89"/><path d="M0 300q209-74 380-17t300-2v49H0Z" fill="#bec391"/><path d="m373 330-21-52 85-34-22-25 30-31-3 39 31 22-79 44 50 37Z" fill="#e6d6ad"/><g stroke="#405a44" stroke-width="5" stroke-linejoin="round"><path d="M40-20 34 330h23L70-20Z" fill="#6e7253"/><path d="M69 21 99-10m-61 123-32-23m53 75 37-25" fill="none"/><path d="M598-20 624 330h24L624-20Z" fill="#6e7253"/><path d="m609 62-46-44m74 151 44-24" fill="none"/></g><g fill="#637f5b"><path d="m-20 170 91-193 72 193h-49l54 63H-38l58-63Zm524-21L560 2l63 147h-33l39 52H487l42-52Z"/><path d="m130 128 41-110 47 110h-27l31 42H108l37-42Zm490-32 42-125 56 125h-29l30 39H596l40-39Z"/></g><g fill="#e7cf91"><ellipse cx="94" cy="309" rx="18" ry="5"/><ellipse cx="570" cy="298" rx="13" ry="4"/></g></svg></div>
<span class="discovery-badge"><span aria-hidden="true">✦</span> ETT ÅTERSEENDE <span class="badge-divider">/</span> RUTA 44</span>
<div class="ride-strangers" id="return-strangers" aria-hidden="true"></div><div class="shortcut-pawn" id="return-pawn" aria-hidden="true"></div>
<span class="scene-whisper return-whisper" id="return-whisper" aria-hidden="true">Hoppa upp igen, herrn!</span>
<span class="return-scene-label" id="return-scene-label" hidden aria-hidden="true">DET HÄR VAR INGEN GENVÄG.</span>
<span class="bonus-stamp return-setback" id="return-setback" hidden aria-hidden="true"><b>−1</b> RUTA</span>
</div>
<div class="shortcut-copy">
<p class="eyebrow" id="return-kicker">ETT VÄLDIGT BEKANT ERBJUDANDE</p>
<h2 id="return-title" tabindex="-1">Men se där.<br><em>En gammal bekant!</em></h2>
<p class="shortcut-description" id="return-description">Du rollade högt på ruta 44 och får träffa gubben som erbjuder skjuts igen. Samma krokiga hatt, samma lustiga varelse och samma breda leende.</p>
<div class="shortcut-choices" id="return-choices"><button type="button" class="primary-choice" id="return-take"><span>Ta skjuts</span><span aria-hidden="true">↗</span></button><button type="button" class="secondary-choice" id="return-decline"><span>Fortsätt utan skjuts</span><span aria-hidden="true">→</span></button></div>
<div class="return-mission" id="return-mission" hidden><div class="return-mission-top"><span class="return-mission-icon" id="return-mission-icon" aria-hidden="true"></span><div><p class="eyebrow">DITT FLYKTUPPDRAG</p><h3>15 squats.<br>Sen är du fri.</h3></div><span class="return-mission-tag">EXTRA<br>UPPDRAG</span></div><p>Gör 15 extra squats för att ta dig loss. Efter fighten är du så trött att du hamnar på <strong>ruta 43</strong>. Uppdraget ger inga poäng.</p><button type="button" class="primary-choice return-escape" id="return-escape"><span>Jag har gjort 15 squats – ta mig härifrån!</span><span aria-hidden="true">↗</span></button></div>
<div class="shortcut-result" id="return-result" hidden><div class="route-reward return-loss" id="return-loss" hidden><span class="from-tile">44</span><span class="route-arrow" aria-hidden="true">⟶</span><span class="to-tile">43</span><strong>Slut i låren.<br>En ruta tillbaka.</strong></div><div class="route-reward return-safe" id="return-safe" hidden><span class="to-tile">44</span><strong>Du står kvar på ruta 44.<br>Ingen fight. Inga extrasquats.</strong></div><p class="return-once">Mötet är avklarat. Gubben får inte lura dig igen när du passerar ruta 44.</p><button type="button" class="primary-choice" id="return-done"><span>Tillbaka till äventyret</span><span aria-hidden="true">→</span></button></div>
<p class="return-error" id="return-error" role="alert" hidden></p></div></dialog>`;
 const dialog=template.content.firstElementChild;document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id);
 const initial={title:$('return-title').innerHTML,description:$('return-description').textContent,kicker:$('return-kicker').textContent};
 $('return-landscape').innerHTML=window.AdventureRideArt.sceneSVG;
 $('return-strangers').innerHTML=window.AdventureRideArt.charactersSVG;
 $('return-mission-icon').innerHTML=window.AdventureSprites.iconSVG('squats');
 let options={},previousFocus,stage='choice',saving=false,lockedChoice=null;
 function paintPawn(node){node.replaceChildren();options.renderPawn?.(node);}
 function renderCard(){
  dialog.dataset.state=stage;
  const trapped=stage==='ambush',escaped=stage==='escaped';
  $('return-choices').hidden=stage!=='choice';$('return-mission').hidden=!trapped;
  $('return-result').hidden=!escaped&&stage!=='kept';$('return-loss').hidden=!escaped;$('return-safe').hidden=stage!=='kept';
  $('return-forest').hidden=!trapped&&!escaped;$('return-whisper').hidden=stage!=='choice';$('return-scene-label').hidden=!trapped;
  $('return-setback').hidden=!escaped;
  if(stage==='choice'){$('return-title').innerHTML=initial.title;$('return-description').textContent=initial.description;$('return-kicker').textContent=initial.kicker;}
  else if(trapped){$('return-title').innerHTML='Åh nej.<br><em>Inte den gubben igen.</em>';$('return-description').textContent='Mannen vann ditt förtroende förra gången. Nu lurade han dig rejält och drar in dig i skogen. Du måste göra 15 squats för att ta dig därifrån.';$('return-kicker').textContent='FÖRTROENDE ÄR BRA. PANNBEN ÄR BÄTTRE.';}
  else if(escaped){$('return-title').innerHTML='Ute ur skogen.<br><em>Slut i låren.</em>';$('return-description').textContent='Du kämpade dig loss med 15 squats. Efter fighten är du så trött att du hamnar en ruta bakåt, på ruta 43. Gubben får behålla sin skjuts. Du behåller åtminstone värdigheten. Nästan.';$('return-kicker').textContent='FRIHETEN KOSTADE 15 SQUATS OCH EN RUTA';}
  else if(stage==='kept'){$('return-title').innerHTML='Snyggt läst.<br><em>Inte en gång till.</em>';$('return-description').textContent='Den där mannen hade något lurt gömt i fickan. Hoppas inga andra är dumma nog att gå på det.';$('return-kicker').textContent='ETT NEJ SOM SPARADE BÅDE LÅR OCH RUTOR';}
  const name=options.label||'Din pjäs';
  $('return-scene').setAttribute('aria-label',name+(trapped?' har blivit lurad in i skogen av gubben och behöver klara ett flyktuppdrag.':escaped?' är ute ur skogen efter 15 extra squats och backar till ruta 43.':stage==='kept'?' tackar nej till samma gubbe och varelse som på ruta 28.':' möter samma gubbe och varelse som på ruta 28.'));
  paintPawn($('return-pawn'));
 }

 function focusStage(){dialog.scrollTop=0;$('return-title').focus({preventScroll:true});}
 function lock(){
  $('return-take').disabled=saving||!!lockedChoice&&lockedChoice!=='take';
  $('return-decline').disabled=saving||!!lockedChoice&&lockedChoice!=='keep';
  $('return-escape').disabled=saving;$('return-close').disabled=saving;
  dialog.setAttribute('aria-busy',String(saving));
 }
 function adopt(saved){
  if(!saved||!['take','keep'].includes(saved.choice)||typeof saved.escaped!=='boolean'||saved.escaped&&saved.choice!=='take')throw new Error('Registreringen kunde inte bekräftas. Klicka på samma knapp igen för att kontrollera den.');
  stage=saved.choice==='keep'?'kept':saved.escaped?'escaped':'ambush';
  renderCard();$('return-error').hidden=true;focusStage();
 }
 async function command(action,choice){
  if(saving||action==='choose'&&(stage!=='choice'||lockedChoice&&lockedChoice!==choice)||action==='escape'&&stage!=='ambush')return;
  if(action==='choose')lockedChoice=choice;
  saving=true;lock();$('return-error').hidden=true;
  try{adopt(await(action==='choose'?options.onChoose?.(choice):options.onEscape?.()));}
  catch(error){$('return-error').textContent=error.message||'Kunde inte spara. Försök igen.';$('return-error').hidden=false;}
  finally{saving=false;lock();}
 }
 $('return-take').onclick=()=>command('choose','take');$('return-decline').onclick=()=>command('choose','keep');$('return-escape').onclick=()=>command('escape');
 $('return-close').onclick=$('return-done').onclick=()=>{if(!saving)dialog.close();};
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 dialog.addEventListener('close',()=>{if(dialog.open)return;const callback=options.onClose;options={};if(previousFocus?.isConnected&&!previousFocus.disabled&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});callback?.();});
 window.AdventureReturnRide=Object.freeze({show(next={}){
  if(document.querySelector('dialog[open]'))return false;
  options=next;saving=false;lockedChoice=next.lockedChoice||null;
  stage=next.choice==='take'?(next.escaped?'escaped':'ambush'):next.choice==='keep'?'kept':'choice';
  $('return-error').hidden=true;renderCard();lock();previousFocus=document.activeElement;dialog.showModal();focusStage();return true;
 },isOpen:()=>dialog.open,isSaving:()=>saving,close(){if(!saving)dialog.close();}});
})();
