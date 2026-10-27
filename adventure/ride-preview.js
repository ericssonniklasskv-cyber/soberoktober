/* Isolated tile-28 concept. In-memory preview only: no Auth, API, storage or real rewards. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('shortcut-dialog');
  const picker = $('preview-pawn');
  const pawns = window.AdventurePersonalPawns;
  $('ride-landscape').innerHTML = window.AdventureRideArt.sceneSVG;
  $('ride-strangers').innerHTML = window.AdventureRideArt.charactersSVG;
  const titleHTML = $('shortcut-title').innerHTML;
  const description = $('shortcut-description').textContent;
  const kicker = $('shortcut-kicker').textContent;
  let position = 28;
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
    position = 28; state = 'choice';
    dialog.dataset.state = state;
    $('shortcut-title').innerHTML = titleHTML;
    $('shortcut-description').textContent = description;
    $('shortcut-kicker').textContent = kicker;
    $('shortcut-choices').hidden = false;
    $('shortcut-result').hidden = true;
    $('shortcut-reward').hidden = false;
    $('kept-reward').hidden = true;
    $('ride-chat').hidden = true;
    $('bonus-stamp').hidden = true;
    $('scene-whisper').hidden = false;
    $('preview-status').textContent = 'Din pjäs står på ruta 28.';
    $('shortcut-close').setAttribute('aria-label', 'Stäng mötet');
    const name = pawns.forId(picker.value)?.username || 'Din pjäs';
    dialog.querySelector('.shortcut-scene').setAttribute('aria-label', name + ' möter en skum gubbe och en lustig varelse på ruta 28.');
    renderTrack(); paintPawn($('shortcut-pawn'));
    if (!dialog.open) { previousFocus = document.activeElement; dialog.showModal(); }
    dialog.scrollTop = 0;
    $('accept-ride').focus({preventScroll:true});
  }
  $('accept-ride').onclick = () => {
    if (state !== 'choice') return;
    state = 'won'; position = 29;
    dialog.dataset.state = state;
    $('shortcut-kicker').textContent = 'EN RUTA RIKARE. EN BEKANTSKAP LIKASÅ.';
    $('shortcut-title').innerHTML = 'Vilken skjuts.<br><em>Vilket sällskap!</em>';
    $('shortcut-description').textContent = 'Ni får ett utomordentligt trevligt samtal om livet, ömma lår och konsten att undvika onödiga squats. Innan du vet ordet av är ni framme på ruta 29.';
    $('scene-whisper').hidden = true;
    $('bonus-stamp').hidden = false;
    $('shortcut-choices').hidden = true;
    $('shortcut-result').hidden = false;
    $('shortcut-reward').hidden = false;
    $('kept-reward').hidden = true;
    $('ride-chat').hidden = false;
    $('shortcut-close').setAttribute('aria-label', 'Stäng och fortsätt från ruta 29');
    $('preview-status').textContent = 'En trevlig skjuts tog dig till ruta 29. En extra ruta!';
    renderTrack();
    dialog.scrollTop = 0;
    $('shortcut-done').focus({preventScroll:true});
  };
  $('decline-ride').onclick = () => {
    if (state !== 'choice') return;
    state = 'kept';
    dialog.dataset.state = state;
    $('shortcut-kicker').textContent = 'GUBBEN HAR ETT SISTA LIVSRÅD';
    $('shortcut-title').innerHTML = 'Du tackar nej.<br><em>Gubben har synpunkter.</em>';
    $('shortcut-description').textContent = '”Man ska alltid lita på främlingar som erbjuder skjuts. Viktigt att lära sina barn det”, ropar gubben efter dig.';
    $('scene-whisper').hidden = true;
    $('bonus-stamp').hidden = true;
    $('shortcut-choices').hidden = true;
    $('shortcut-result').hidden = false;
    $('shortcut-reward').hidden = true;
    $('kept-reward').hidden = false;
    $('ride-chat').hidden = true;
    $('shortcut-close').setAttribute('aria-label', 'Stäng och fortsätt från ruta 28');
    $('preview-status').textContent = 'Du missade en gratis extraruta och står kvar på ruta 28.';
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
