(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AdventureSalutes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const greetings=Object.freeze([
  {tile:55,id:'troll',title:'Var hälsad, {{master}}.',intro:'Vid slottsvägens första krök står en välbekant, orimligt attraktiv öl-orc. Den här gången lyfter han bägaren åt sidan och gör honnör.',lines:[
   '”Jag minns din kullerbytta. Mina ögon har fortfarande inte riktigt hittat tillbaka.”',
   '”Du tog dig förbi både mig och hela Beer o’ forest. Bara några rutor kvar nu, {{master}}. Visa baronen vad det där pannbenet går för!”'
  ],button:'Med pannbenet först →',tint:'#8e9e6b'},
  {tile:56,id:'witch',title:'Min uppochnervända favorit.',intro:'Ur en tunn strimma vindimma kliver Sexiga vin-gnomen fram. Hon känner igen dig direkt och drar undan dimman som en ridå.',lines:[
   '”Nämen, se vem som fortfarande står stadigt. Jag trodde aldrig att du skulle ta dig genom min dimma på det där viset.”',
   '”Var hälsad, {{master}}. Jag har klarat sikten åt dig den här gången. Slottet är nära, och du har varit alldeles för briljant för att vända nu.”'
  ],button:'Klart sikte. Mot slottet →',tint:'#a48692'},
  {tile:57,id:'dragon',title:'Det luktar final, {{master}}.',intro:'Ett varmt vinddrag sveper över vägen. Shotsdraken landar bredvid dig, viker ihop vingarna och nickar med oväntad respekt.',lines:[
   '”Där är du ju, morgonvandraren! Du var ute och tog dagen innan jag ens hade fått fyr på andedräkten.”',
   '”Jag har vaktat den här ravinen i hundra år. Tro mig: det där slottet skrämmer ingen som redan har tagit sig förbi mig. Framåt nu!”'
  ],button:'Håll glöden. Vidare →',tint:'#c99263'},
  {tile:58,id:'sphinx',title:'Älskling. Du är nästan framme.',intro:'Gyllene bubblor svävar över vägkanten. Proseccohäxan sitter på en sten och applåderar när din pjäs kommer runt kröken.',lines:[
   '”Tio kickar och inte en enda bubbla i glaset. Jag hatar att erkänna det, men du gjorde det med stil.”',
   '”Var hälsad, {{master}}. Bergen ligger bakom dig och baronen väntar där framme. Sträck på dig, älskling. Gör entrén lika snygg som resan.”'
  ],button:'Dags för en snygg entré →',tint:'#b7ae7c'},
  {tile:59,id:'kraken',title:'Vår dyrbara… soktoberian.',intro:'Precis före slottsporten sitter Nattklubbsgollum på en mur. Han slutar fingra på sin flaska och pekar ivrigt mot slottet.',lines:[
   '”Där är du, jaaa… flaskvändaren. Vi minns din bottle flip. Så vacker. Nästan lika vacker som vår dyrbara.”',
   '”Fem frestelser har du besegrat. Bara baronen kvar nu, {{master}}. Gå och avsluta det här. Vi… vi håller faktiskt på dig.”'
  ],button:'En sista boss. Nu kör vi →',tint:'#9a91a3'}
 ].map(g=>Object.freeze({...g,lines:Object.freeze(g.lines)})));
 const scenery='<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="700" fill="#e5e6cd"/><circle cx="600" cy="85" r="100" fill="#f7edcc"/><path d="M0 265 140 48 290 245 422 88 600 290 790 66 1000 250V700H0Z" fill="#b7c09a" opacity=".55"/><path d="M0 340Q200 235 430 320T1000 240V700H0Z" fill="#d0d4b1"/><path d="M0 450Q200 310 480 460T1000 350V700H0Z" fill="#bec99f" opacity=".7"/><path d="M0 660Q260 540 560 650t440-20v70H0Z" fill="#adbc8e" opacity=".5"/><g fill="#738b63" opacity=".65"><path d="m40 353 40-111 43 111H99l29 43H22l30-43Zm814-140 35-101 39 101h-20l26 36h-90l27-36ZM948 574l40-130 47 130h-24l30 42h-111l32-42ZM10 591l30-88 35 88H55l25 36H-6l25-36Z"/></g><g fill="#83956b" opacity=".6"><path d="m130 168 25-70 29 70h-16l21 29h-67l20-29Zm607 160 28-73 29 73h-18l21 28h-64l20-28Z"/></g><g fill="#f9eed1"><circle cx="115" cy="472" r="3"/><circle cx="880" cy="605" r="3"/><circle cx="655" cy="285" r="3"/><circle cx="687" cy="300" r="2"/></g><g fill="#d09b55"><path d="m905 350 3-7 3 7-3 7Zm-810 263 3-6 3 6-3 6Z"/></g></svg>';
 const forTile=tile=>greetings.find(g=>g.tile===tile)||null;
 const personalized=(text,name)=>String(text).replaceAll('{{master}}','Mästare '+String(name||'Äventyraren'));
 function eligible(state,seen=[]){
  const G=typeof window!=='undefined'?window.SoberAdventure:require('./adventure-logic.js');
  const p=G.progress(state),g=forTile(p.position);
  return g&&!p.pendingBoss&&greetings.every(item=>p.completedBossIds.includes(item.id))&&!seen.includes(g.tile)?g.tile:null;
 }
 let dialog,options,opener;
 const $=id=>document.getElementById(id);
 function close(){if(!dialog?.open)return;const callback=options?.onClose;dialog.close();if(opener?.isConnected&&!opener.disabled)opener.focus({preventScroll:true});callback?.();}
 function init(){if(dialog)return;dialog=$('greeting-dialog');if(!dialog){const t=document.createElement('template');t.innerHTML=`<dialog id="greeting-dialog" aria-labelledby="greeting-title" aria-describedby="greeting-intro">
<button type="button" class="close" id="greeting-close" aria-label="Stäng hälsningen">×</button>
<div class="greeting-scene" id="greeting-scene">
<div class="scene-landscape" id="scene-landscape" aria-hidden="true"></div>
<span class="scene-badge" id="scene-badge">EN GAMMAL MOTSTÅNDARE · RUTA 55</span>
<div class="scene-pawn" id="scene-pawn" aria-hidden="true"></div>
<span class="scene-spark" aria-hidden="true">✦</span>
<div class="scene-boss" id="scene-boss" aria-hidden="true"></div>
<span class="scene-friendship" aria-hidden="true">FRÅN MOTSTÅNDARE TILL HEJARKLACK</span>
</div>
<div class="greeting-copy">
<p class="eyebrow" id="greeting-name"></p>
<h2 id="greeting-title" tabindex="-1"></h2>
<p class="greeting-intro" id="greeting-intro"></p>
<blockquote id="greeting-speech"></blockquote>
<div class="greeting-footer"><span class="salute-seal" aria-hidden="true">✓</span><p>Du har redan besegrat den här frestelsen.<br><strong>Nu är det bara framåt som gäller.</strong></p></div>
<button type="button" class="primary" id="greeting-continue">Mot slottet →</button>
<p class="greeting-count" id="greeting-count"></p>
</div>
</dialog>`;document.body.append(t.content);dialog=$('greeting-dialog');}
  $('greeting-close').onclick=$('greeting-continue').onclick=close;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 }
 function show(next){const g=forTile(next?.tile);if(!g)return false;init();if(dialog.open||document.querySelector('dialog[open]'))return false;
  options=next;opener=document.activeElement;const boss=window.SoberAdventure.BOSSES.find(b=>b.id===g.id);
  $('greeting-name').textContent=boss.name+' · BESEGRAD';$('greeting-title').textContent=personalized(g.title,next.name);$('greeting-intro').textContent=personalized(g.intro,next.name);
  $('scene-badge').textContent='ETT ÅTERSEENDE · RUTA '+g.tile;
  $('greeting-speech').replaceChildren(...g.lines.map(line=>{const p=document.createElement('p');p.textContent=personalized(line,next.name);return p;}));
  $('scene-boss').innerHTML=window.AdventureBosses.bossSVG(g.id,'',300);$('scene-pawn').replaceChildren();next.renderPawn?.($('scene-pawn'));
  $('scene-landscape').innerHTML=scenery;$('greeting-scene').setAttribute('role','img');$('greeting-scene').setAttribute('aria-label',String(next.name||'Din pjäs')+' får en hälsning av '+boss.name+' på väg till slottet.');
  $('greeting-continue').textContent=g.button;$('greeting-count').textContent='HÄLSNING '+(g.tile-54)+' AV 5 · '+(60-g.tile)+' RUTOR TILL SLOTTET';
  dialog.dataset.boss=g.id;dialog.showModal();$('greeting-title').focus({preventScroll:true});dialog.scrollTop=0;return true;
 }
 return Object.freeze({items:greetings,scenery,forTile,personalized,eligible,show,close,isOpen:()=>!!dialog?.open});
});
