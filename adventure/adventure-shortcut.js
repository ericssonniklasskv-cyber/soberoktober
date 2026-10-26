/* Shared tile-21 encounter. Saving and eligibility belong to the game adapter. */
(() => {
 'use strict';
 const template=document.createElement('template');
 template.innerHTML=`  <dialog id="shortcut-dialog" class="shortcut-dialog" aria-labelledby="shortcut-title" aria-describedby="shortcut-description">
    <button type="button" class="shortcut-close" id="shortcut-close" aria-label="Stäng vägskälet">×</button>
    <div class="shortcut-scene" role="img" aria-label="Din pjäs upptäcker en hemlig stig genom en solbelyst skog">
      <img class="shortcut-landscape" src="/adventure/assets/secret-shortcut.webp" alt="" width="1200" height="800">
      <span class="discovery-badge"><span aria-hidden="true">✦</span> ETT HEMLIGT FYND <span class="badge-divider">/</span> RUTA 21</span>
      <div class="shortcut-pawn" id="shortcut-pawn" aria-hidden="true"></div>
      <span class="scene-whisper" id="scene-whisper" aria-hidden="true">Psst… den här vägen?</span>
      <span class="bonus-stamp" id="bonus-stamp" hidden><b>+1</b> EXTRA RUTA</span>
    </div>
    <div class="shortcut-copy">
      <p class="eyebrow" id="shortcut-kicker">DIN INRE LATMASK VÄDRAR MORGONLUFT</p>
      <h2 id="shortcut-title">Vänta lite…<br><em>är det där en genväg?</em></h2>
      <p class="shortcut-description" id="shortcut-description">Bakom buskarna skymtar en liten stig. Den ser misstänkt lovande ut. Ingen ork i sikte, inga köer… bara din chans att smita lite snabbare fram.</p>
      <div class="shortcut-choices" id="shortcut-choices">
        <button type="button" class="primary-choice" id="take-shortcut"><span>Ta genvägen</span><span aria-hidden="true">↗</span></button>
        <button type="button" class="secondary-choice" id="keep-path">Fortsätt på samma väg <span aria-hidden="true">→</span></button>
      </div>
      <div class="shortcut-result" id="shortcut-result" hidden>
        <div class="route-reward" id="shortcut-reward" aria-label="Du flyttas från ruta 21 till ruta 22, en extra ruta">
          <span class="from-tile">21</span><span class="route-arrow" aria-hidden="true">⟶</span><span class="to-tile">22</span>
          <strong>En extra ruta.<br>Helt utan squats.</strong>
        </div>
        <div class="route-reward kept-reward" id="kept-reward" hidden>
          <span class="from-tile">21</span><strong>15 squats<br>för att flytta en ruta till.</strong>
        </div>
        <button type="button" class="primary-choice" id="shortcut-done"><span>Tillbaka till äventyret</span><span aria-hidden="true">→</span></button>
      </div>
      <p id="shortcut-error" class="shortcut-error" role="alert" hidden></p>
    </div>
  </dialog>`;
 const dialog=template.content.firstElementChild;document.body.append(dialog);
 const $=id=>document.getElementById(id);
 const titleHTML=$('shortcut-title').innerHTML,description=$('shortcut-description').textContent,kicker=$('shortcut-kicker').textContent;
 let previousFocus,options={},stage='choice',saving=false,lockedChoice=null;
 function result(choice){
  stage=choice==='take'?'won':'kept';dialog.dataset.state=stage;
  $('shortcut-kicker').textContent=choice==='take'?'IBLAND ÄR DEN ENKLA VÄGEN DEN RÄTTA':'INGEN GENVÄG DEN HÄR GÅNGEN';
  $('shortcut-title').textContent=choice==='take'?'En genväg är alltid en genväg, bra val':'Synd, ingen minns en fegis';
  $('shortcut-description').textContent=choice==='take'?'Du smiter mellan träden och kliver fram på ruta 22. Lite mindre omväg, precis lika mycket äventyr.':'En genväg är alltid en genväg. Nu får du göra 15 squats för att flytta en ruta till.';
  $('scene-whisper').hidden=true;$('bonus-stamp').hidden=choice!=='take';$('shortcut-choices').hidden=true;$('shortcut-result').hidden=false;
  $('shortcut-reward').hidden=choice!=='take';$('kept-reward').hidden=choice==='take';$('shortcut-error').hidden=true;
  $('shortcut-close').setAttribute('aria-label','Stäng och fortsätt från ruta '+(choice==='take'?22:21));
  dialog.scrollTop=0;$('shortcut-done').focus({preventScroll:true});
 }
 function lockButtons(){
  $('take-shortcut').disabled=saving||(lockedChoice&&lockedChoice!=='take');$('keep-path').disabled=saving||(lockedChoice&&lockedChoice!=='keep');$('shortcut-close').disabled=saving;
  dialog.setAttribute('aria-busy',String(saving));
 }
 async function choose(choice){
  if(stage!=='choice'||saving||(lockedChoice&&lockedChoice!==choice))return;
  saving=true;lockedChoice=choice;lockButtons();$('shortcut-error').hidden=true;
  try{
   const saved=await options.onChoose?.(choice);
   if(!saved||!['take','keep'].includes(saved.choice))throw new Error('Valet kunde inte bekräftas. Tryck på samma val igen för att kontrollera det. Det räknas bara en gång.');
   result(saved.choice);
  }catch(error){$('shortcut-error').textContent=error.message||'Kunde inte spara valet. Försök igen.';$('shortcut-error').hidden=false;}
  finally{saving=false;lockButtons();}
 }
 $('take-shortcut').onclick=()=>choose('take');$('keep-path').onclick=()=>choose('keep');
 $('shortcut-close').onclick=$('shortcut-done').onclick=()=>{if(!saving)dialog.close();};
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 dialog.addEventListener('close',()=>{const callback=options.onClose;options={};if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});callback?.();});
 window.AdventureShortcut=Object.freeze({show(next={}){
  if(document.querySelector('dialog[open]'))return false;options=next;stage='choice';saving=false;lockedChoice=next.lockedChoice||null;dialog.dataset.state='choice';
  $('shortcut-title').innerHTML=titleHTML;$('shortcut-description').textContent=description;$('shortcut-kicker').textContent=kicker;
  $('shortcut-choices').hidden=false;$('shortcut-result').hidden=true;$('shortcut-error').hidden=true;$('scene-whisper').hidden=false;$('bonus-stamp').hidden=true;
  $('shortcut-close').setAttribute('aria-label','Stäng vägskälet');
  const pawn=$('shortcut-pawn');pawn.replaceChildren();next.renderPawn?.(pawn);
  dialog.querySelector('.shortcut-scene').setAttribute('aria-label',(next.label||'Din pjäs')+' upptäcker en hemlig stig på ruta 21.');
  lockButtons();previousFocus=document.activeElement;dialog.showModal();dialog.scrollTop=0;$(lockedChoice==='keep'?'keep-path':'take-shortcut').focus({preventScroll:true});return true;
 },isOpen:()=>dialog.open,isSaving:()=>saving,close(){if(!saving)dialog.close();}});
})();
