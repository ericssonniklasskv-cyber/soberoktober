/* Isolated local demo. Its own storage namespace never reads an account or the real game save. */
(() => {
  'use strict';
  const G = window.SoberAdventure, A = window.AdventurePersonalPawns, card = window.AdventureIcecreamTrap;
  const $ = id => document.getElementById(id), picker = $('preview-pawn');
  const PREFIX = 'soberoktober:tile-thirty-three-preview:v1:', date = '2026-10-27';
  let state, message = '';
  const requested = new URLSearchParams(location.search).get('pawn');
  for (const p of A.PROFILES) picker.add(new Option(p.username,p.id));
  picker.add(new Option('Utan personlig pjäs','guest'));
  picker.value = A.forId(requested) || requested === 'guest' ? requested : 'nillebae';
  const key = () => PREFIX + picker.value;
  function seed() {
    let s = G.createState();
    while (G.progress(s).position < 33) {
      const p = G.progress(s);
      if (p.pendingBoss) s = G.resolveBoss(s,p.pendingBoss.id,p.pendingBoss.choices[0].id,date);
      else if(p.position === 21 && !s.shortcutChoice) s = G.chooseShortcut(s,'keep',date);
      else if(p.position === 28 && !s.rideChoice) s = G.chooseRide(s,'keep',date);
      else s = G.record(s,'squats',date);
    }
    return s;
  }
  function read() { try { const raw = localStorage.getItem(key()); return raw ? G.restore(raw) : null; } catch { return null; } }
  function persist(next) {
    // Fail safely: never apply an unpersisted penalty in this preview.
    localStorage.setItem(key(),JSON.stringify(next)); state = next;
  }
  function paintPawn(target) {
    const p = A.forId(picker.value); target.replaceChildren();
    if(p) { const img = new Image(); img.src=p.mount.image; img.alt=p.username+' på '+p.mount.name; img.width=360;img.height=270;target.append(img); }
    else target.innerHTML=window.AdventureSprites.riderSVG('fox','#db783b','Din pjäs på Kopparräven',300);
  }
  function render() {
    const p = G.progress(state).position;
    document.querySelectorAll('.track-pawn').forEach(node => node.remove());
    document.querySelectorAll('.track-tile').forEach(tile => {
      const own = Number(tile.dataset.tile) === p; tile.dataset.current=String(own);
      if(own) { const node=document.createElement('span');node.className='track-pawn';node.setAttribute('aria-hidden','true');paintPawn(node);tile.append(node); }
    });
    $('preview-step').disabled = !state.icecreamChoice || p >= 35;
    $('preview-open').disabled = !!state.icecreamChoice;
    $('preview-status').textContent = message || (state.icecreamChoice ? (state.icecreamChoice === 'take' ? 'Glassen är avslöjad. Du står på ruta '+p+'. Fyndet kommer inte tillbaka.' : 'Phew! Du avstod och står på ruta '+p+'. Fyndet kommer inte tillbaka.') : 'Din pjäs står på ruta 33. En glass väntar.');
  }
  function show() {
    if(state.icecreamChoice || G.progress(state).position !== 33) return;
    card.show({label:A.forId(picker.value)?.username || 'Din pjäs',renderPawn:paintPawn,
      onChoose(choice) {
        const latest = read();
        if(latest?.icecreamChoice) { state=latest;render();return {choice:latest.icecreamChoice}; }
        if(latest) state=latest;
        try { persist(G.chooseIcecream(state,choice,date)); }
        catch(error) { if(error.name==='SecurityError'||error.name==='QuotaExceededError') throw new Error('Testvalet kunde inte sparas i webbläsaren. Inget baksteg har registrerats.'); throw error; }
        message='';render();return {choice:state.icecreamChoice};
      },onClose:() => { render();$('preview-step').disabled ? $('preview-open').focus({preventScroll:true}) : $('preview-step').focus({preventScroll:true}); }
    });
  }
  function load() { state=read() || seed();message='';render();show(); }
  $('preview-open').onclick=show;
  $('preview-step').onclick=() => {
    if(!state.icecreamChoice || G.progress(state).position >= 35) return;
    try {
      persist(G.record(state,'squats',date));
      message=G.progress(state).position === 33 ? 'Tillbaka på ruta 33. Glassen dyker inte upp igen – fortsätt framåt!' : 'Ruta '+G.progress(state).position+'. Ett teststeg framåt, 0 poäng.';
    } catch { message='Teststeget kunde inte sparas. Inget steg ändrades.'; }
    render();
  };
  $('preview-reset').onclick=() => { try { localStorage.removeItem(key()); } catch { message='Testet kunde inte återställas.';render();return; } load(); };
  picker.onchange=() => {const url=new URL(location.href);url.searchParams.set('pawn',picker.value);history.replaceState(null,'',url);load();};
  window.addEventListener('storage',event => {if(event.key !== key()) return;const latest=read();if(latest){state=latest;message='Testet uppdaterades från en annan flik.';render();if(latest.icecreamChoice && card.isOpen() && !card.isSaving()) card.close();}});
  load();
})();
