/* Isolated tile-21 concept. In-memory preview only: no Auth, API, storage or real rewards. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('shortcut-dialog');
  const picker = $('preview-pawn');
  const pawns = window.AdventurePersonalPawns;
  const titleHTML = $('shortcut-title').innerHTML;
  const description = $('shortcut-description').textContent;
  const kicker = $('shortcut-kicker').textContent;
  let position = 21;
  let state = 'choice';
  let previousFocus;
  for (const profile of pawns.PROFILES) picker.add(new Option(profile.username, profile.id));
  picker.add(new Option('Utan personlig pjäs', 'guest'));
  const requested = new URLSearchParams(location.search).get('pawn');
  picker.value = pawns.forId(requested) || requested === 'guest' ? requested : 'nillebae';

  function paintPawn(target) {
    const profile = pawns.forId(picker.value);
    target.replaceChildren();
    if (profile) {
      const image = new Image();
      image.src = profile.mount.image;
      image.alt = profile.username + ' på ' + profile.mount.name;
      image.width = 360; image.height = 270;
      target.append(image);
    } else {
      target.innerHTML = window.AdventureSprites.riderSVG('fox', '#db783b', 'Din pjäs på Kopparräven', 300);
    }
  }
  function renderTrack() {
    document.querySelectorAll('.track-pawn').forEach(el => el.remove());
    for (const tile of document.querySelectorAll('.track-tile')) {
      const own = Number(tile.dataset.tile) === position;
      tile.dataset.current = String(own);
      if (!own) continue;
      const pawn = document.createElement('span');
      pawn.className = 'track-pawn'; pawn.setAttribute('aria-hidden', 'true');
      paintPawn(pawn); tile.append(pawn);
    }
  }
  function showChoice() {
    position = 21; state = 'choice';
    dialog.dataset.state = state;
    $('shortcut-title').innerHTML = titleHTML;
    $('shortcut-description').textContent = description;
    $('shortcut-kicker').textContent = kicker;
    $('shortcut-choices').hidden = false;
    $('shortcut-result').hidden = true;
    $('shortcut-reward').hidden = false;
    $('kept-reward').hidden = true;
    $('bonus-stamp').hidden = true;
    $('scene-whisper').hidden = false;
    $('preview-status').textContent = 'Din pjäs står på ruta 21.';
    $('shortcut-close').setAttribute('aria-label', 'Stäng vägskälet');
    const name = pawns.forId(picker.value)?.username || 'Din pjäs';
    dialog.querySelector('.shortcut-scene').setAttribute('aria-label', name + ' upptäcker en hemlig stig genom en solbelyst skog.');
    renderTrack(); paintPawn($('shortcut-pawn'));
    if (!dialog.open) { previousFocus = document.activeElement; dialog.showModal(); }
    dialog.scrollTop = 0;
    $('take-shortcut').focus({preventScroll:true});
  }
  $('take-shortcut').onclick = () => {
    if (state !== 'choice') return;
    state = 'won'; position = 22;
    dialog.dataset.state = state;
    $('shortcut-kicker').textContent = 'IBLAND ÄR DEN ENKLA VÄGEN DEN RÄTTA';
    $('shortcut-title').textContent = 'En genväg är alltid en genväg, bra val';
    $('shortcut-description').textContent = 'Du smiter mellan träden och kliver fram på ruta 22. Lite mindre omväg, precis lika mycket äventyr.';
    $('scene-whisper').hidden = true;
    $('bonus-stamp').hidden = false;
    $('shortcut-choices').hidden = true;
    $('shortcut-result').hidden = false;
    $('shortcut-reward').hidden = false;
    $('kept-reward').hidden = true;
    $('shortcut-close').setAttribute('aria-label', 'Stäng och fortsätt från ruta 22');
    $('preview-status').textContent = 'Genvägen tog dig till ruta 22. En extra ruta!';
    renderTrack();
    dialog.scrollTop = 0;
    $('shortcut-done').focus({preventScroll:true});
  };
  $('keep-path').onclick = () => {
    if (state !== 'choice') return;
    state = 'kept';
    dialog.dataset.state = state;
    $('shortcut-kicker').textContent = 'INGEN GENVÄG DEN HÄR GÅNGEN';
    $('shortcut-title').textContent = 'Synd, ingen minns en fegis';
    $('shortcut-description').textContent = 'En genväg är alltid en genväg. Nu får du göra 15 squats för att flytta en ruta till.';
    $('scene-whisper').hidden = true;
    $('bonus-stamp').hidden = true;
    $('shortcut-choices').hidden = true;
    $('shortcut-result').hidden = false;
    $('shortcut-reward').hidden = true;
    $('kept-reward').hidden = false;
    $('shortcut-close').setAttribute('aria-label', 'Stäng och fortsätt från ruta 21');
    $('preview-status').textContent = 'Du följer den gamla stigen. Din pjäs står kvar på ruta 21.';
    dialog.scrollTop = 0;
    $('shortcut-done').focus({preventScroll:true});
  };
  for (const id of ['shortcut-close','shortcut-done']) $(id).onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({preventScroll:true});
    else $('preview-replay').focus({preventScroll:true});
  });
  for (const id of ['preview-open','preview-replay']) $(id).onclick = showChoice;
  picker.onchange = () => {
    const url = new URL(location.href); url.searchParams.set('pawn', picker.value); history.replaceState(null, '', url);
    showChoice();
  };
  showChoice();
})();
