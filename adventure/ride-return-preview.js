/* Isolated tile-44 design preview: no API, Auth, storage or real game changes. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),A=window.AdventurePersonalPawns,dialog=$('return-ride-dialog'),picker=$('preview-pawn');
 const initial={title:$('return-title').innerHTML,description:$('return-description').textContent,kicker:$('return-kicker').textContent};
 $('return-landscape').innerHTML=window.AdventureRideArt.sceneSVG;
 // Reuse the exact approved tile-28 figure artwork, rather than regenerate it.
 $('return-strangers').innerHTML=window.AdventureRideArt.charactersSVG;
 $('return-mission-icon').innerHTML=window.AdventureSprites.iconSVG('squats');
 let stage='choice',position=44,choice=null,extraSquats=0,previousFocus;
 for(const profile of A.PROFILES)picker.add(new Option(profile.username,profile.id));
 picker.add(new Option('Utan personlig pjäs','guest'));
 const requested=new URLSearchParams(location.search).get('pawn');picker.value=A.forId(requested)||requested==='guest'?requested:'nillebae';
 function paintPawn(node){
  const profile=A.forId(picker.value);node.replaceChildren();
  if(profile){const img=new Image();img.src=profile.mount.image;img.alt=profile.username+' på '+profile.mount.name;img.width=360;img.height=270;node.append(img);}
  else node.innerHTML=window.AdventureSprites.riderSVG('fox','#db783b','Din pjäs på Kopparräven',300);
 }
 function renderTrack(){
  document.querySelectorAll('.track-pawn').forEach(n=>n.remove());
  document.querySelectorAll('.track-tile').forEach(tile=>{const own=Number(tile.dataset.tile)===position;tile.dataset.current=String(own);if(own){const pawn=document.createElement('span');pawn.className='track-pawn';pawn.setAttribute('aria-hidden','true');paintPawn(pawn);tile.append(pawn);}});
  $('preview-view').disabled=stage==='continued';
  $('preview-view').textContent=stage==='ambush'?'Fortsätt flyktuppdraget ↗':choice?'Visa utfallet igen ↗':'Visa mötet ↗';
  $('preview-step').disabled=stage==='choice'||stage==='ambush'||position>=46;
  $('preview-step').textContent=stage==='ambush'?'Klara flyktuppdraget först':'Testa nästa träningssteg · +1 ruta';
  $('preview-open').disabled=!!choice&&stage!=='ambush';
  $('preview-status').textContent=stage==='choice'?'Ruta 44. Gubben väntar på ditt svar.':stage==='ambush'?'Fast i skogen. Gör 15 extra squats för att komma loss – sedan hamnar du på ruta 43.':stage==='escaped'?'15 extrasquats senare: du är fri, men står på ruta 43.':stage==='kept'?'Snyggt läst. Du står kvar på ruta 44 utan extra uppdrag.':position===44?'Tillbaka på ruta 44. Ingen ny popup, inget nytt bakslag.':'Ruta '+position+'. Testresan fortsätter utan ett nytt möte.';
 }
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
  const name=A.forId(picker.value)?.username||'Din pjäs';
  $('return-scene').setAttribute('aria-label',name+(trapped?' har blivit lurad in i skogen av gubben och behöver klara ett flyktuppdrag.':escaped?' är ute ur skogen efter 15 extra squats och backar till ruta 43.':stage==='kept'?' tackar nej till samma gubbe och varelse som på ruta 28.':' möter samma gubbe och varelse som på ruta 28.'));
  paintPawn($('return-pawn'));renderTrack();
 }
 function focusStage(){dialog.scrollTop=0;$('return-title').focus({preventScroll:true});}
 function open(){if(stage==='continued')return;renderCard();if(!dialog.open){previousFocus=document.activeElement;dialog.showModal();}focusStage();}
 function close(){dialog.close();}
 $('return-take').onclick=()=>{if(choice||stage!=='choice')return;choice='take';stage='ambush';renderCard();focusStage();};
 $('return-decline').onclick=()=>{if(choice||stage!=='choice')return;choice='keep';stage='kept';renderCard();focusStage();};
 $('return-escape').onclick=()=>{if(stage!=='ambush')return;extraSquats=15;position=43;stage='escaped';renderCard();focusStage();};
 $('return-close').onclick=$('return-done').onclick=close;
 dialog.addEventListener('close',()=>{if(dialog.open)return;renderTrack();const fallback=$('preview-step').disabled?$('preview-view'):$('preview-step');if(previousFocus?.isConnected&&!previousFocus.disabled&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});else fallback.focus({preventScroll:true});});
 $('preview-open').onclick=$('preview-view').onclick=open;
 $('preview-replay').onclick=()=>{stage='choice';position=44;choice=null;extraSquats=0;open();};
 $('preview-step').onclick=()=>{if(!choice||stage==='ambush'||position>=46)return;position++;stage='continued';renderTrack();};
 picker.onchange=()=>{const url=new URL(location.href);url.searchParams.set('pawn',picker.value);history.replaceState(null,'',url);if(dialog.open)renderCard();else renderTrack();};
 // Read-only state for preview inspection; no public mutation hooks or real game state.
 window.RideReturnPreview=Object.freeze({snapshot:()=>Object.freeze({stage,position,choice,extraSquats})});
 open();
})();
