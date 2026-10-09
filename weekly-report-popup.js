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
  const dismissed = new Set();
  const key = () => `${userId}:${period?.key}`;

  const notice = window.SoberOctoberPopups.register('weekly-report', {
    priority: window.SoberOctoberPopups.priorities.weeklyReport,
    element: dialog,
    isOpen: () => dialog.open,
    canShow: () => Boolean(userId && period && !dismissed.has(key())
      && !window.SoberOctoberReportSeen.read(userId).includes(period.key)),
    suspend: () => dialog.close(),
    show() {
      document.querySelector('#weekly-release-period').textContent = `${period.title} · ${period.label}`;
      document.querySelector('#weekly-release-copy').textContent = `Klicka här för att se allt du gjort de senaste ${period.days} dagarna.`;
      openLink.href = `/min-oktober/?rapport=${encodeURIComponent(period.key)}`;
      previousFocus = document.activeElement;
      dialog.showModal();
      openLink.focus();
    },
  });

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
  window.addEventListener('storage', (event) => {
    if (event.key === `soberoktober:weekly-reports-seen:${userId}`) notice.request();
  });
  window.SoberOctoberWeeklyPopup = Object.freeze({
    update(nextUserId, nextPeriod) {
      if (userId !== nextUserId || period?.key !== nextPeriod?.key) {
        if (dialog.open) dialog.close();
      }
      userId = nextUserId;
      period = nextPeriod;
      if ((!userId || !period || window.SoberOctoberReportSeen.read(userId).includes(period.key)) && dialog.open) dialog.close();
      notice.request();
    },
  });
})();
