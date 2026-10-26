/* Isolated design preview: no Auth, APIs, game storage or scoring. */
(() => {
  'use strict';
  const picker = document.getElementById('preview-pawn');
  const profiles = window.AdventurePersonalPawns.PROFILES;
  for (const profile of profiles) picker.add(new Option(profile.username, profile.id));
  picker.add(new Option('Utan personlig pjäs', 'guest'));
  const requested = new URLSearchParams(location.search).get('pawn');
  picker.value = profiles.some(p => p.id === requested) || requested === 'guest' ? requested : 'nillebae';
  function paintPawn(target) {
    const profile = window.AdventurePersonalPawns.forId(picker.value);
    target.replaceChildren();
    if (profile) {
      const img = new Image(); img.src = profile.mount.image;
      img.alt = profile.username + ' på ' + profile.mount.name;
      img.width = 360; img.height = 270; target.append(img);
    } else target.innerHTML = window.AdventureSprites.riderSVG('fox', '#db783b', 'Din pjäs på Kopparräven', 300);
  }
  function show() {
    paintPawn(document.getElementById('preview-map-pawn'));
    window.AdventureTreat.show({renderPawn:paintPawn,label:window.AdventurePersonalPawns.forId(picker.value)?.username||'Din pjäs',onClose:()=>document.getElementById('preview-replay').focus({preventScroll:true})});
  }
  for (const id of ['preview-open', 'preview-replay']) document.getElementById(id).onclick = show;
  picker.onchange = () => { const url = new URL(location.href); url.searchParams.set('pawn', picker.value); history.replaceState(null, '', url); show(); };
  show();
})();
