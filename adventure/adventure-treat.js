/* Cosmetic route discovery, shared by the isolated preview and the live realm. */
(() => {
 'use strict';
 let dialog=document.getElementById('icecream-dialog');
 if(!dialog){const template=document.createElement('template');template.innerHTML=`  <dialog class="treat-dialog" id="icecream-dialog" aria-labelledby="treat-title" aria-describedby="treat-copy treat-invitation">
    <button type="button" class="treat-close" id="treat-close" aria-label="Stäng glassfyndet">×</button>
    <div class="treat-scene" role="img" aria-label="Din pjäs upptäcker en glass på vägen">
      <span class="treat-discovery">ETT GOTT FYND <b aria-hidden="true">✦</b> RUTA 18</span>
      <span class="treat-sun" aria-hidden="true"></span>
      <span class="treat-spark treat-spark-one" aria-hidden="true">✦</span><span class="treat-spark treat-spark-two" aria-hidden="true">✧</span><span class="treat-spark treat-spark-three" aria-hidden="true">✦</span>
      <div class="treat-rider" id="treat-rider" aria-hidden="true"></div>
      <div class="treat-cone" aria-hidden="true">
        <svg viewBox="0 0 180 250" fill="none"><defs><linearGradient id="cone-waffle" x1="55" y1="160" x2="120" y2="244" gradientUnits="userSpaceOnUse"><stop stop-color="#e8ba76"/><stop offset="1" stop-color="#c98c48"/></linearGradient><clipPath id="cone-cut"><path d="m43 150 49 89 44-89Z"/></clipPath></defs><ellipse cx="92" cy="237" rx="37" ry="7" fill="#69754d" opacity=".16"/><path d="m43 150 49 89 44-89Z" fill="url(#cone-waffle)" stroke="#83583c" stroke-width="4" stroke-linejoin="round"/><g clip-path="url(#cone-cut)" stroke="#ad733d" stroke-width="2.3" opacity=".65"><path d="m20 151 110 103M35 136l110 103M50 121l110 103M20 197l110-103M35 212l110-103M50 227l110-103M65 242l110-103"/></g><path d="M36 141q-6-32 18-46 29-17 57-2 30 12 30 43 10 7 4 17-6 9-18 3-12 13-25 2-12 13-26 1-17 12-25-2-23 2-15-16Z" fill="#f3b9a6" stroke="#83583c" stroke-width="4" stroke-linejoin="round"/><path d="M52 122q12-12 26-9m26 13q12-9 21 0" stroke="#dc927f" stroke-width="3" stroke-linecap="round"/><path d="M47 89q-6-31 16-43 26-15 48 1 25 15 19 42 10 9 0 18-10 7-20-1-13 11-24-1-16 10-24-2-16 5-18-5-1-5 3-9Z" fill="#fff1c9" stroke="#83583c" stroke-width="4" stroke-linejoin="round"/><path d="M64 72q4-12 16-14" stroke="#fffaf0" stroke-width="6" stroke-linecap="round"/><path d="m94 37 5-14q5-12 16-12" stroke="#52724b" stroke-width="4" stroke-linecap="round"/><circle cx="92" cy="38" r="13" fill="#b95245" stroke="#83583c" stroke-width="3"/><path d="m86 33 3-3" stroke="#e89c84" stroke-width="3" stroke-linecap="round"/><path d="m65 92 4-6m39-6 5 4m-34-2-1-6m13 14 4-3" stroke="#cd9065" stroke-width="3" stroke-linecap="round"/></svg>
      </div><div class="treat-ground" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>
    <div class="treat-copy"><p class="treat-kicker">EN SÖT LITEN BONUSPAUS</p><h2 id="treat-title"><em>Wow!</em> En glass!</h2><p id="treat-copy">Du hittade en riktigt god glass på vägen.</p><p class="treat-invitation" id="treat-invitation">Unna dig något sött under dagen.</p><button type="button" class="treat-continue" id="treat-continue">Det är jag värd! <span aria-hidden="true">🍦</span></button></div>
  </dialog>`;dialog=template.content.firstElementChild;document.body.append(dialog);}
 let previousFocus,afterClose;
 const close=()=>dialog.close();
 document.getElementById('treat-close').onclick=close;
 document.getElementById('treat-continue').onclick=close;
 dialog.addEventListener('close',()=>{const callback=afterClose;afterClose=null;if(previousFocus?.isConnected&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});callback?.();});
 window.AdventureTreat=Object.freeze({show({renderPawn,label='Din pjäs',onClose}={}){
  if(document.querySelector('dialog[open]'))return false;
  const rider=document.getElementById('treat-rider');rider.replaceChildren();renderPawn?.(rider);
  dialog.querySelector('.treat-scene').setAttribute('aria-label',label+' möter en glass på ruta 18.');
  previousFocus=document.activeElement;afterClose=onClose;dialog.showModal();dialog.scrollTop=0;document.getElementById('treat-continue').focus({preventScroll:true});return true;
 },close,isOpen:()=>dialog.open});
})();
