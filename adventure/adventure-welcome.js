(() => {
  'use strict';
  const dialog = document.getElementById('pawn-welcome-dialog');
  const keyFor = profile => 'soberoktober:adventure-pawn-welcome:2026-10-26:' + profile.id;
  const shownThisVisit = new Set();
  let afterClose = null;
  const lines = {
    mikeb: 'En grip, ett vinnarsmile och noll respekt för en öl-orc. Det här kan bara sluta storslaget.',
    jerka: 'Ett leende som öppnar portar. En bagge som öppnar resten. Frestelserna har blivit varnade.',
    zellmani: 'Enhörningen är sadlad och håret ligger rätt. Nu får frestelserna försöka hänga med.',
    'elliott-da-bomb': 'Stilpoängen är redan säkrade. Sköldpaddan lovar att ta dig hela vägen – i sin egen takt.',
    nillebae: 'Kungsgåsen är redo, rosetten sitter perfekt och frestelserna gör bäst i att flytta på sig.',
  };
  function seen(profile) {
    if (shownThisVisit.has(profile.id)) return true;
    try { return localStorage.getItem(keyFor(profile)) === 'seen'; } catch { return false; }
  }
  function show(profile, options = {}) {
    if (!profile || (!options.force && seen(profile)) || document.querySelector('dialog[open]')) return false;
    document.getElementById('pawn-welcome-title').textContent = profile.username + ', din hjälte är här!';
    document.getElementById('pawn-welcome-image').src = profile.mount.image;
    document.getElementById('pawn-welcome-image').alt = profile.username + ' på sin personliga pjäs';
    document.getElementById('pawn-welcome-story').textContent = lines[profile.id];
    document.getElementById('pawn-welcome-mount').textContent = profile.mount.name;
    afterClose = options.onClose || null;
    dialog.showModal(); dialog.scrollTop = 0;
    shownThisVisit.add(profile.id);
    try { localStorage.setItem(keyFor(profile), 'seen'); } catch { /* Once per visit still works without persistent storage. */ }
    return true;
  }
  function dismiss() { afterClose = null; if (dialog.open) dialog.close(); }
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    const callback = afterClose; afterClose = null; callback?.();
  });
  document.getElementById('pawn-welcome-go').addEventListener('click', () => dialog.close());
  window.AdventureWelcome = Object.freeze({ show, dismiss });
})();
