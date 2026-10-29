/* Isolated design preview. No backend, audio, localStorage or production-state changes. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),G=window.SoberAdventure,A=window.AdventurePersonalPawns,B=window.AdventureBosses,S=window.AdventureSprites;
 const greetings=window.AdventureSalutes.items;
 // Use the same boss IDs, names and miniatures as the actual shared board.
 const bosses=new Map(G.BOSSES.map(b=>[b.id,b]));
 const stops=[{tile:54,x:13,y:81},...greetings.map((g,i)=>({...g,...[{x:38,y:81},{x:74,y:81},{x:87,y:48},{x:53,y:48},{x:23,y:48}][i]})),{tile:60,x:48,y:17}];
 const castle='<svg viewBox="0 0 180 150" xmlns="http://www.w3.org/2000/svg"><ellipse cx="90" cy="141" rx="77" ry="7" fill="#485c4130"/><g stroke="#6d7356" stroke-width="2.5" stroke-linejoin="round"><path d="M22 137V65h31v20h17V36h43v49h17V65h29v72Z" fill="#b9b79a"/><path d="M18 67 37 32l21 35M64 38 91 3l27 35m6 30 21-35 19 35" fill="#5c7654"/><path d="M74 137v-27q17-23 34 0v27" fill="#59654b"/><path d="M40 77v13m49-39v13m51 15v13" fill="none" stroke="#6f775a" stroke-width="6"/><path d="M92 4v-19l29 8-29 8" fill="#e89b54"/><path d="M18 137h145" stroke="#8d9571" stroke-width="8"/><path d="m25 107 20-2m80 12h23M69 75h16m26 20h17" fill="none" stroke="#d8d0ae"/></g></svg>';
 const landscape=window.AdventureSalutes.scenery;
 const dialog=$('greeting-dialog'),picker=$('pawn-picker');let position=55,active=null,opener=null,openerTile=null;const seen=new Set();
 for(const p of A.PROFILES)picker.add(new Option(p.username,p.id));picker.add(new Option('Utan personlig pjäs','guest'));
 const params=new URLSearchParams(location.search),requested=params.get('pawn');picker.value=A.forId(requested)||requested==='guest'?requested:'nillebae';
 function pawn(node){const p=A.forId(picker.value);node.replaceChildren();if(p){const img=new Image();img.src=p.mount.image;img.alt='';img.width=360;img.height=270;node.append(img);}else node.innerHTML=S.riderSVG('fox','#db783b','',300);}
 $('map-landscape').innerHTML=landscape;$('scene-landscape').innerHTML=landscape;
 function render(){
  const nodes=stops.map(stop=>{
   const b=document.createElement('button');b.type='button';b.className='stop'+(stop.tile===60?' castle':stop.tile===54?' start':'');b.style.setProperty('--x',stop.x+'%');b.style.setProperty('--y',stop.y+'%');b.dataset.tile=stop.tile;b.dataset.current=String(position===stop.tile);b.dataset.seen=String(seen.has(stop.tile));b.setAttribute('aria-current',position===stop.tile?'step':'false');
   const boss=stop.id?bosses.get(stop.id):null;b.setAttribute('aria-label',boss?'Ruta '+stop.tile+': läs hälsningen från '+boss.name:stop.tile===60?'Ruta 60: Bakrusbaronens slott':'Ruta 54: början på sista sträckan');
   if(boss){const fig=document.createElement('span');fig.className='stop-figure';fig.setAttribute('aria-hidden','true');fig.innerHTML=B.bossSVG(boss.id,'',130);b.append(fig);const check=document.createElement('span');check.className='stop-check';check.setAttribute('aria-hidden','true');check.textContent='✓';b.append(check);}
   if(stop.tile===60){const fig=document.createElement('span');fig.className='stop-figure';fig.setAttribute('aria-hidden','true');fig.innerHTML=castle;b.append(fig);}
   const base=document.createElement('span');base.className='stop-base';base.textContent=stop.tile;b.append(base);
   const label=document.createElement('span');label.className='stop-name';label.textContent=boss?boss.name:stop.tile===60?'Bakrusbaronen':'Sista sträckan';b.append(label);
   if(position===stop.tile){const own=document.createElement('span');own.className='stop-pawn';own.setAttribute('aria-hidden','true');pawn(own);b.append(own);}
   b.addEventListener('click',()=>{if(boss)openGreeting(stop.tile,b);else if(stop.tile===54){position=54;render();}else{$('journey-status').textContent='Bakrusbaronen väntar på ruta 60. Hans befintliga finaluppdrag ändras inte i denna preview.';}});return b;
  });$('map-stops').replaceChildren(...nodes);
  $('position-pill').textContent='RUTA '+position+' / 60';$('journey-status').textContent=position===60?'Vid slottsporten. Fem hälsningar i ryggen. En sista boss kvar.':position===54?'Din testpjäs står på ruta 54. Ta ett steg för att möta orcen.':'Ruta '+position+'. '+seen.size+' av 5 hälsningar lästa. Bakrusbaronen väntar på ruta 60.';
  $('next-step').disabled=position>=60;$('next-step').textContent=position>=60?'Framme vid Bakrusbaronen':'Testa nästa ruta · '+(position+1)+' →';
  $('progress-dots').replaceChildren(...greetings.map(g=>{const dot=document.createElement('i');dot.dataset.read=String(seen.has(g.tile));dot.setAttribute('aria-hidden','true');return dot;}));$('progress-dots').setAttribute('aria-label',seen.size+' av 5 hälsningar lästa');
 }
 function personalized(text){return text.replaceAll('{{master}}','Mästare '+(A.forId(picker.value)?.username||'Äventyraren'));}
 function renderGreeting(){const g=greetings.find(g=>g.tile===active),boss=bosses.get(g.id);$('greeting-name').textContent=boss.name+' · BESEGRAD';$('greeting-title').textContent=personalized(g.title);$('greeting-intro').textContent=personalized(g.intro);$('scene-badge').textContent='ETT ÅTERSEENDE · RUTA '+g.tile;$('greeting-speech').replaceChildren(...g.lines.map(line=>{const p=document.createElement('p');p.textContent=personalized(line);return p;}));$('scene-boss').innerHTML=B.bossSVG(g.id,'',300);pawn($('scene-pawn'));$('greeting-scene').style.setProperty('--boss-tint',g.tint);$('greeting-scene').setAttribute('role','img');$('greeting-scene').setAttribute('aria-label',(A.forId(picker.value)?.username||'Din testpjäs')+' får en hälsning av '+boss.name+' på väg till slottet.');$('greeting-continue').textContent=g.button;$('greeting-count').textContent='HÄLSNING '+(g.tile-54)+' AV 5 · '+(60-g.tile)+' RUTOR TILL SLOTTET';dialog.dataset.boss=g.id;dialog.scrollTop=0;}
 function openGreeting(tile,trigger){if(!greetings.some(g=>g.tile===tile))return;active=tile;opener=trigger||$('next-step');openerTile=trigger?.dataset.tile||null;seen.add(tile);render();renderGreeting();if(!dialog.open)dialog.showModal();$('greeting-title').focus({preventScroll:true});dialog.scrollTop=0;}
 function close(){if(!dialog.open)return;dialog.close();const fallback=$('next-step').disabled?$('replay'):$('next-step'),mapOpener=openerTile?document.querySelector('.stop[data-tile="'+openerTile+'"]'):null;(mapOpener||(opener?.isConnected&&!opener.disabled?opener:fallback)).focus({preventScroll:true});}
 $('greeting-close').onclick=$('greeting-continue').onclick=close;
 // Restore focus now, rather than from a delayed close event that could steal a later click.
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 $('next-step').onclick=()=>{if(dialog.open||position>=60)return;position++;render();if(position<60)openGreeting(position,$('next-step'));};
 $('replay').onclick=()=>{if(dialog.open)dialog.close();seen.clear();active=null;position=54;render();$('next-step').focus();};
 picker.onchange=()=>{const url=new URL(location.href);url.searchParams.set('pawn',picker.value);history.replaceState(null,'',url);render();if(dialog.open)renderGreeting();};
 window.FinalApproachPreview=Object.freeze({snapshot:()=>Object.freeze({position,active,seen:Object.freeze([...seen]),pawn:picker.value})});
 render();openGreeting(55,$('next-step'));
})();
