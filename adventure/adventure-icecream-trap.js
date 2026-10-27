/* Tile-33 card. Persistence and authority belong to the caller, never the artwork. */
(() => {
  'use strict';
  const template = document.createElement('template');
  template.innerHTML = `<dialog id="icecream-trap-dialog" class="trap-dialog" aria-labelledby="trap-title" aria-describedby="trap-description">
    <button type="button" class="trap-close" id="trap-close" aria-label="Stäng glassfyndet">×</button>
    <div class="trap-scene" role="img" id="trap-scene" aria-label="Din pjäs hittar en lockande glass på ruta 33">
      <div class="trap-landscape" aria-hidden="true"><svg viewBox="0 0 680 320" preserveAspectRatio="xMidYMax slice"><rect width="680" height="320" fill="#f1e4bd"/><circle cx="462" cy="106" r="97" fill="#fff6da"/><path d="M0 218 112 80l106 138 86-172 168 197 91-130 117 91v116H0Z" fill="#c8cca4"/><path d="m0 260 168-130 129 135L445 88l169 178 66-68v122H0Z" fill="#b2be92"/><path d="M0 275q200-60 374-5 171 30 306-16v66H0Z" fill="#a9b78a"/><path d="M680 292q-130-28-274-9T0 313v7h680Z" fill="#e9d9b0"/><path d="m59 282 5-12 4 11m551-3 7-13 3 15" fill="none" stroke="#7f976e" stroke-width="3" stroke-linecap="round"/></svg></div>
      <span class="trap-badge">ETT SÖTT FYND <b aria-hidden="true">✦</b> RUTA 33</span>
      <div class="trap-pawn" id="trap-pawn" aria-hidden="true"></div>
      <div class="trap-bait" id="trap-bait" aria-hidden="true"><svg viewBox="0 0 180 250" fill="none"><defs><linearGradient id="cone-waffle" x1="55" y1="160" x2="120" y2="244" gradientUnits="userSpaceOnUse"><stop stop-color="#e8ba76"/><stop offset="1" stop-color="#c98c48"/></linearGradient><clipPath id="cone-cut"><path d="m43 150 49 89 44-89Z"/></clipPath></defs><ellipse cx="92" cy="237" rx="37" ry="7" fill="#69754d" opacity=".16"/><path d="m43 150 49 89 44-89Z" fill="url(#cone-waffle)" stroke="#83583c" stroke-width="4" stroke-linejoin="round"/><g clip-path="url(#cone-cut)" stroke="#ad733d" stroke-width="2.3" opacity=".65"><path d="m20 151 110 103M35 136l110 103M50 121l110 103M20 197l110-103M35 212l110-103M50 227l110-103M65 242l110-103"/></g><path d="M36 141q-6-32 18-46 29-17 57-2 30 12 30 43 10 7 4 17-6 9-18 3-12 13-25 2-12 13-26 1-17 12-25-2-23 2-15-16Z" fill="#f3b9a6" stroke="#83583c" stroke-width="4" stroke-linejoin="round"/><path d="M52 122q12-12 26-9m26 13q12-9 21 0" stroke="#dc927f" stroke-width="3" stroke-linecap="round"/><path d="M47 89q-6-31 16-43 26-15 48 1 25 15 19 42 10 9 0 18-10 7-20-1-13 11-24-1-16 10-24-2-16 5-18-5-1-5 3-9Z" fill="#fff1c9" stroke="#83583c" stroke-width="4" stroke-linejoin="round"/><path d="M64 72q4-12 16-14" stroke="#fffaf0" stroke-width="6" stroke-linecap="round"/><path d="m94 37 5-14q5-12 16-12" stroke="#52724b" stroke-width="4" stroke-linecap="round"/><circle cx="92" cy="38" r="13" fill="#b95245" stroke="#83583c" stroke-width="3"/><path d="m86 33 3-3" stroke="#e89c84" stroke-width="3" stroke-linecap="round"/><path d="m65 92 4-6m39-6 5 4m-34-2-1-6m13 14 4-3" stroke="#cd9065" stroke-width="3" stroke-linecap="round"/></svg></div>
      <div class="trap-reveal" id="trap-reveal" hidden aria-hidden="true"><span class="trap-magic"></span><img src="/adventure/assets/enchanted-icecream.webp" alt="" width="474" height="670"><i>✦</i><i>✧</i><i>✦</i></div>
      <span class="trap-thought" id="trap-thought" aria-hidden="true">En till? Vilken lyx.</span>
      <span class="trap-setback" id="trap-setback" hidden aria-hidden="true"><b>−1</b> RUTA</span>
    </div>
    <div class="trap-copy">
      <p class="trap-kicker" id="trap-kicker">EN LITEN PAUS I THE PROSECCO MOUNTAINS</p>
      <h2 id="trap-title">Nämen, titta.<br><em>En glass till!</em></h2>
      <p class="trap-description" id="trap-description">Där ligger den. En riktigt god glass, mitt på stigen. Nästan som om någon visste att just du skulle gå förbi. Ska herrn unna sig?</p>
      <div class="trap-choices" id="trap-choices">
        <button type="button" class="trap-primary" id="take-icecream"><span>Ta upp och njut av glassen</span><span aria-hidden="true">↗</span></button>
        <button type="button" class="trap-secondary" id="leave-icecream"><span>Strunta i den och fortsätt</span><span aria-hidden="true">→</span></button>
      </div>
      <div class="trap-result" id="trap-result" hidden>
        <div class="trap-route" id="trap-route"><span id="trap-from">33</span><i id="trap-arrow" aria-hidden="true">⟶</i><span id="trap-to">32</span><strong id="trap-consequence"></strong></div>
        <p class="trap-once" id="trap-once">Valet är gjort. Glassen dyker inte upp igen när du passerar ruta 33.</p>
        <button type="button" class="trap-primary" id="trap-done"><span>Tillbaka till äventyret</span><span aria-hidden="true">→</span></button>
      </div>
      <p class="trap-error" id="trap-error" role="alert" hidden></p>
    </div>
  </dialog>`;
  const dialog = template.content.firstElementChild;
  document.body.append(dialog);
  const $ = id => dialog.querySelector('#' + id);
  const original = {title:$('trap-title').innerHTML, description:$('trap-description').textContent, kicker:$('trap-kicker').textContent};
  let options = {}, previousFocus, saving = false, stage = 'choice', lockedChoice = null;
  function lock() {
    $('take-icecream').disabled = saving || !!lockedChoice && lockedChoice !== 'take';
    $('leave-icecream').disabled = saving || !!lockedChoice && lockedChoice !== 'keep';
    $('trap-close').disabled = saving;
    dialog.setAttribute('aria-busy', String(saving));
  }
  function showResult(choice) {
    const taken = choice === 'take';
    stage = taken ? 'taken' : 'left'; dialog.dataset.stage = stage;
    $('trap-kicker').textContent = taken ? 'DET DÄR VAR INTE JORDGUBB...' : 'DIN MAGKÄNSLA RÄDDADE DAGEN';
    $('trap-title').innerHTML = taken ? 'Nämen…<br><em>vad fan är DET?</em>' : 'Det var<br><em>förjävla tur!</em>';
    $('trap-description').textContent = taken
      ? 'Den goda glassen visade sig vara en förtrollad, avskuren penis. Aptiten försvann på en millisekund. Du mår så illa att du måste backa en ruta. Tillbaka till ruta 32, herrn.'
      : 'Det visade sig att den goda glassen var en magisk, avskuren penis. Det hade fått dig att backa en ruta. Phew! Du låter den ligga och står kvar på ruta 33.';
    $('trap-choices').hidden = true; $('trap-result').hidden = false;
    $('trap-bait').hidden = true; $('trap-reveal').hidden = false; $('trap-thought').hidden = true;
    $('trap-setback').hidden = !taken;
    $('trap-to').textContent = taken ? '32' : '33'; $('trap-from').hidden = !taken; $('trap-arrow').hidden = !taken;
    $('trap-consequence').textContent = taken ? 'En ruta tillbaka. Din träning finns kvar.' : 'Ingen ruta förlorad. Du klarade dig!';
    $('trap-scene').setAttribute('aria-label', (options.label || 'Din pjäs') + (taken ? ' ryggar tillbaka när glassen avslöjar sin förtrollade skepnad.' : ' går förbi glassen som avslöjar sin förtrollade skepnad.'));
    $('trap-close').setAttribute('aria-label', 'Stäng och fortsätt från ruta ' + (taken ? '32' : '33'));
    $('trap-error').hidden = true;
    dialog.scrollTop = 0; $('trap-done').focus({preventScroll:true});
  }
  async function choose(choice) {
    if (stage !== 'choice' || saving || lockedChoice && lockedChoice !== choice) return;
    saving = true; lockedChoice = choice; lock(); $('trap-error').hidden = true;
    try {
      const saved = await options.onChoose?.(choice);
      if (!saved || !['take','keep'].includes(saved.choice)) throw new Error('Valet kunde inte bekräftas. Tryck på samma val för att försöka igen.');
      showResult(saved.choice);
    } catch (error) {
      $('trap-error').textContent = error.message || 'Valet kunde inte sparas. Försök igen.';
      $('trap-error').hidden = false;
    } finally { saving = false; lock(); }
  }
  $('take-icecream').onclick = () => choose('take');
  $('leave-icecream').onclick = () => choose('keep');
  $('trap-close').onclick = $('trap-done').onclick = () => { if (!saving) dialog.close(); };
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    // A queued close from an earlier opening must not erase a newly opened card.
    if (dialog.open) return;
    const callback = options.onClose; options = {};
    if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({preventScroll:true});
    callback?.();
  });
  window.AdventureIcecreamTrap = Object.freeze({
    show(next = {}) {
      if (document.querySelector('dialog[open]')) return false;
      options = next; stage = 'choice'; saving = false; lockedChoice = next.lockedChoice || null;
      dialog.dataset.stage = stage; $('trap-title').innerHTML = original.title;
      $('trap-description').textContent = original.description; $('trap-kicker').textContent = original.kicker;
      $('trap-choices').hidden = false; $('trap-result').hidden = true; $('trap-error').hidden = true;
      $('trap-bait').hidden = false; $('trap-reveal').hidden = true; $('trap-thought').hidden = false; $('trap-setback').hidden = true;
      $('trap-close').setAttribute('aria-label', 'Stäng glassfyndet');
      $('trap-scene').setAttribute('aria-label', (next.label || 'Din pjäs') + ' hittar en lockande glass på ruta 33.');
      $('trap-pawn').replaceChildren(); next.renderPawn?.($('trap-pawn'));
      lock(); previousFocus = document.activeElement; dialog.showModal(); dialog.scrollTop = 0;
      $(lockedChoice === 'keep' ? 'leave-icecream' : 'take-icecream').focus({preventScroll:true});
      return true;
    },
    isOpen: () => dialog.open, isSaving: () => saving,
    close() { if (!saving) dialog.close(); }
  });
})();
