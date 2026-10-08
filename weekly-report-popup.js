(() => {
  const dialog = document.querySelector('#weekly-release-dialog');
  const openLink = document.querySelector('#weekly-release-open');
  const closeButton = document.querySelector('#weekly-release-close');
  const cta = document.querySelector('#home-weekly-report');
  const app = document.querySelector('#app-shell');
  if (!dialog || !openLink || !app) return;

  let userId = null;
  let period = null;
  let previousFocus = null;
  let scheduled = false;
  const dismissed = new Set();
  const key = () => `${userId}:${period?.key}`;

  function blocked() {
    return document.hidden || app.inert || document.body.classList.contains('entry-active')
      || document.querySelector('#auth-overlay.open')
      || document.querySelector('#trump-quote-overlay:not([hidden])')
      || document.querySelector('#elimination-overlay:not([hidden])')
      || [...document.querySelectorAll('dialog[open]')].some((item) => item !== dialog);
  }

  function maybeOpen() {
    scheduled = false;
    if (!userId || !period || window.SoberOctoberReportSeen.read(userId).includes(period.key)) {
      if (dialog.open) dialog.close();
      return;
    }
    if (blocked()) {
      if (dialog.open) dialog.close();
      return;
    }
    if (dialog.open || dismissed.has(key())) return;
    document.querySelector('#weekly-release-period').textContent = `${period.title} · ${period.label}`;
    document.querySelector('#weekly-release-copy').textContent = `Klicka här för att se allt du gjort de senaste ${period.days} dagarna.`;
    openLink.href = `/min-oktober/?rapport=${encodeURIComponent(period.key)}`;
    previousFocus = document.activeElement;
    dialog.showModal();
    openLink.focus();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // Let the existing login, quote and elimination overlays settle first.
    window.setTimeout(maybeOpen, 0);
  }

  function dismiss() {
    dismissed.add(key());
    dialog.close();
    if (previousFocus?.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus();
  }

  openLink.addEventListener('click', (event) => {
    if (!userId || !period) { event.preventDefault(); return; }
    window.SoberOctoberReportSeen.mark(userId, period.key);
    cta.hidden = true;
    dialog.close();
  });
  closeButton.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); dismiss(); });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
  });
  // Attribute-only observation avoids listening to confetti and feed text updates.
  new MutationObserver(schedule).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ['hidden', 'open', 'class', 'inert'],
  });
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('storage', (event) => {
    if (event.key === `soberoktober:weekly-reports-seen:${userId}`) schedule();
  });
  window.SoberOctoberWeeklyPopup = Object.freeze({
    update(nextUserId, nextPeriod) {
      if (userId !== nextUserId || period?.key !== nextPeriod?.key) {
        if (dialog.open) dialog.close();
      }
      userId = nextUserId;
      period = nextPeriod;
      schedule();
    },
  });
})();
