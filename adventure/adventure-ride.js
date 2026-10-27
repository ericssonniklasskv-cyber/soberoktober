/* Live tile-28 encounter, with the approved native sprite design. */
(() => {
 'use strict';
 const template=document.createElement('template');
 template.innerHTML=`  <dialog id="ride-dialog" class="ride-dialog" aria-labelledby="ride-title" aria-describedby="ride-description">
    <button type="button" class="ride-close" id="ride-close" aria-label="Stäng mötet">×</button>
    <div class="ride-scene" role="img" aria-label="Din pjäs möter en skum gubbe med en lustig varelse vid ett solbelyst bergspass">
      <div class="ride-landscape" id="ride-landscape" aria-hidden="true"></div>
      <div class="ride-strangers" id="ride-strangers" aria-hidden="true"></div>
      <span class="discovery-badge"><span aria-hidden="true">✦</span> ETT MÖTE <span class="badge-divider">/</span> RUTA 28</span>
      <div class="ride-pawn" id="ride-pawn" aria-hidden="true"></div>
      <span class="scene-whisper" id="ride-whisper" aria-hidden="true">Hoppa upp, vetja!</span>
      <span class="bonus-stamp" id="ride-bonus-stamp" hidden><b>+1</b> EXTRA RUTA</span>
    </div>
    <div class="ride-copy">
      <p class="eyebrow" id="ride-kicker">ETT ERBJUDANDE FÖR TRÖTTA HJÄLTEBEN</p>
      <h2 id="ride-title">Vill herrn<br><em>ha skjuts?</em></h2>
      <p class="ride-description" id="ride-description">Vid vägkanten står en skum gubbe med en mycket lustig varelse. Han lyfter på hatten, ler lite för brett och klappar den lediga platsen på sadeln.</p>
      <div class="ride-choices" id="ride-choices">
        <button type="button" class="primary-choice" id="accept-ride"><span>Ja tack, gärna skjuts!</span><span aria-hidden="true">↗</span></button>
        <button type="button" class="secondary-choice" id="decline-ride">Nej tack, jag går vidare <span aria-hidden="true">→</span></button>
      </div>
      <div class="ride-result" id="ride-result" hidden>
        <div class="ride-chat" id="ride-chat" hidden aria-label="Ett utomordentligt trevligt samtal"><p><span>GUBBEN</span>”Visst är det trevligt att slippa gå?”</p><p><span>DU</span>”Utomordentligt trevligt.”</p></div>
        <div class="route-reward" id="ride-reward" aria-label="Du flyttas från ruta 28 till ruta 29, en extra ruta">
          <span class="from-tile">28</span><span class="route-arrow" aria-hidden="true">⟶</span><span class="to-tile">29</span>
          <strong>En extra ruta.<br>Och en ny bekantskap.</strong>
        </div>
        <div class="route-reward kept-reward" id="ride-kept-reward" hidden>
          <span class="from-tile">28</span><strong>Du missade en gratis extraruta.<br>Du står kvar på ruta 28.</strong>
        </div>
        <button type="button" class="primary-choice" id="ride-done"><span>Tillbaka till äventyret</span><span aria-hidden="true">→</span></button>
      </div>
      <p id="ride-error" class="ride-error" role="alert" hidden></p>
    </div>
  </dialog>`;
 const dialog=template.content.firstElementChild;document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id);
 $('ride-landscape').innerHTML=window.AdventureRideArt.sceneSVG;$('ride-strangers').innerHTML=window.AdventureRideArt.charactersSVG;
 const titleHTML=$('ride-title').innerHTML,description=$('ride-description').textContent,kicker=$('ride-kicker').textContent;
 let previousFocus,options={},stage='choice',saving=false,lockedChoice=null;
 function result(choice){
  stage=choice==='take'?'won':'kept';dialog.dataset.state=stage;
  $('ride-kicker').textContent=choice==='take'?'EN RUTA RIKARE. EN BEKANTSKAP LIKASÅ.':'GUBBEN HAR ETT SISTA LIVSRÅD';
  $('ride-title').innerHTML=choice==='take'?'Vilken skjuts.<br><em>Vilket sällskap!</em>':'Du tackar nej.<br><em>Gubben har synpunkter.</em>';
  $('ride-description').textContent=choice==='take'?'Ni får ett utomordentligt trevligt samtal om livet, ömma lår och konsten att undvika onödiga squats. Innan du vet ordet av är ni framme på ruta 29.':'”Man ska alltid lita på främlingar som erbjuder skjuts. Viktigt att lära sina barn det”, ropar gubben efter dig.';
  $('ride-whisper').hidden=true;$('ride-bonus-stamp').hidden=choice!=='take';$('ride-choices').hidden=true;$('ride-result').hidden=false;
  $('ride-reward').hidden=choice!=='take';$('ride-kept-reward').hidden=choice==='take';$('ride-chat').hidden=choice!=='take';$('ride-error').hidden=true;
  $('ride-close').setAttribute('aria-label','Stäng och fortsätt från ruta '+(choice==='take'?29:28));
  dialog.scrollTop=0;$('ride-done').focus({preventScroll:true});
 }
 function lockButtons(){
  $('accept-ride').disabled=saving||(lockedChoice&&lockedChoice!=='take');$('decline-ride').disabled=saving||(lockedChoice&&lockedChoice!=='keep');$('ride-close').disabled=saving;
  dialog.setAttribute('aria-busy',String(saving));
 }
 async function choose(choice){
  if(stage!=='choice'||saving||(lockedChoice&&lockedChoice!==choice))return;
  saving=true;lockedChoice=choice;lockButtons();$('ride-error').hidden=true;
  try{
   const saved=await options.onChoose?.(choice);
   if(!saved||!['take','keep'].includes(saved.choice))throw new Error('Valet kunde inte bekräftas. Tryck på samma val igen för att kontrollera det. Det räknas bara en gång.');
   result(saved.choice);
  }catch(error){$('ride-error').textContent=error.message||'Kunde inte spara valet. Försök igen.';$('ride-error').hidden=false;}
  finally{saving=false;lockButtons();}
 }
 $('accept-ride').onclick=()=>choose('take');$('decline-ride').onclick=()=>choose('keep');
 $('ride-close').onclick=$('ride-done').onclick=()=>{if(!saving)dialog.close();};
 dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
 dialog.addEventListener('close',()=>{const callback=options.onClose;options={};if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});callback?.();});
 window.AdventureRide=Object.freeze({show(next={}){
  if(document.querySelector('dialog[open]'))return false;options=next;stage='choice';saving=false;lockedChoice=next.lockedChoice||null;dialog.dataset.state='choice';
  $('ride-title').innerHTML=titleHTML;$('ride-description').textContent=description;$('ride-kicker').textContent=kicker;
  $('ride-choices').hidden=false;$('ride-result').hidden=true;$('ride-error').hidden=true;$('ride-whisper').hidden=false;$('ride-bonus-stamp').hidden=true;
  $('ride-close').setAttribute('aria-label','Stäng mötet');$('ride-chat').hidden=true;
  const pawn=$('ride-pawn');pawn.replaceChildren();next.renderPawn?.(pawn);
  dialog.querySelector('.ride-scene').setAttribute('aria-label',(next.label||'Din pjäs')+' möter en skum gubbe och en lustig varelse på ruta 28.');
  lockButtons();previousFocus=document.activeElement;dialog.showModal();dialog.scrollTop=0;$(lockedChoice==='keep'?'decline-ride':'accept-ride').focus({preventScroll:true});return true;
 },isOpen:()=>dialog.open,isSaving:()=>saving,close(){if(!saving)dialog.close();}});
})();
