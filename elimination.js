(() => {
  const ownNoticeKey = (userId) => `soberoktober:own-elimination:${userId}`;
  let client;
  let userId;
  let ownStatus;
  let otherEvents = [];
  let activeNotice = null;

  function ensureDialog() {
    if (document.querySelector('#elimination-overlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'elimination-overlay';
    overlay.id = 'elimination-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="elimination-dialog" role="dialog" aria-modal="true" aria-labelledby="elimination-title" aria-describedby="elimination-reason">
        <div class="elimination-noise" aria-hidden="true"></div>
        <p class="elimination-eyebrow">Sober Oktober · resultatet är inne</p>
        <span class="elimination-stamp" aria-hidden="true">OUT</span>
        <h2 class="elimination-title" id="elimination-title"></h2>
        <p class="elimination-reason" id="elimination-reason"></p>
        <button class="elimination-close" id="elimination-close" type="button"></button>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#elimination-close').addEventListener('click', closeActiveNotice);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeActiveNotice();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeActiveNotice();
    });
  }

  function openNotice(notice) {
    ensureDialog();
    activeNotice = notice;
    const overlay = document.querySelector('#elimination-overlay');
    const title = overlay.querySelector('#elimination-title');
    const reason = overlay.querySelector('#elimination-reason');
    const close = overlay.querySelector('#elimination-close');
    const name = notice.isOwn ? (notice.displayName || 'Du') : notice.display_name;
    if (notice.isOwn) {
      try { localStorage.setItem(ownNoticeKey(userId), notice.eventId); } catch (_error) { /* Browser storage is optional. */ }
    }
    title.textContent = `${name} has been eliminated`;
    reason.textContent = notice.reason || notice.elimination_reason || '';
    close.textContent = notice.isOwn ? 'Acceptera mitt öde' : 'Brutalt.';
    overlay.hidden = false;
    document.body.classList.add('elimination-open');
    close.focus();
  }

  async function closeActiveNotice() {
    if (!activeNotice) return;
    const dismissed = activeNotice;
    activeNotice = null;
    const overlay = document.querySelector('#elimination-overlay');
    overlay.hidden = true;
    document.body.classList.remove('elimination-open');

    await loadNextOtherEvent();
    showNextNotice();
  }

  async function loadNextOtherEvent() {
    if (!client || !userId) return;
    const { data, error } = await client.rpc('get_unseen_elimination_events');
    if (error) {
      console.warn('Utslagsnotiserna kunde inte hämtas ännu.', error);
      return;
    }
    otherEvents.push(...(data || []));
  }

  function showNextNotice() {
    if (activeNotice) return;
    if (ownStatus?.status === 'eliminated') {
      const eventId = ownStatus.current_elimination_event_id;
      let seenEvent = null;
      try { seenEvent = localStorage.getItem(ownNoticeKey(userId)); } catch (_error) { /* Browser storage is optional. */ }
      if (eventId && seenEvent !== eventId) {
        openNotice({
          isOwn: true,
          eventId,
          displayName: ownStatus.display_name,
          reason: ownStatus.elimination_reason,
        });
        return;
      }
    }
    const next = otherEvents.shift();
    if (next) openNotice(next);
  }

  async function refresh(nextClient, nextUserId, displayName) {
    client = nextClient;
    userId = nextUserId;
    if (!client || !userId) return null;
    ensureDialog();
    ownStatus = null;
    otherEvents = [];
    try {
      const { data, error } = await client.rpc('sync_competition_status');
      if (error) throw error;
      const statusRow = Array.isArray(data) ? data[0] : data;
      ownStatus = statusRow ? { ...statusRow, display_name: displayName } : null;
      if (!ownStatus) return null;

      let ownWasShown = false;
      let seenEvent = null;
      try { seenEvent = localStorage.getItem(ownNoticeKey(userId)); } catch (_error) { /* Browser storage is optional. */ }
      if (ownStatus.status === 'eliminated' && ownStatus.current_elimination_event_id && seenEvent !== ownStatus.current_elimination_event_id) {
        showNextNotice();
        ownWasShown = true;
      }
      if (!ownWasShown) {
        await loadNextOtherEvent();
        showNextNotice();
      }
      return ownStatus;
    } catch (error) {
      console.warn('Tävlingsstatus kunde inte hämtas just nu.', error);
      return null;
    }
  }

  function resetOnLogout(previousUserId) {
    if (!previousUserId) return;
    try { localStorage.removeItem(ownNoticeKey(previousUserId)); } catch (_error) { /* Browser storage is optional. */ }
    ownStatus = null;
    otherEvents = [];
    activeNotice = null;
    const overlay = document.querySelector('#elimination-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('elimination-open');
  }

  window.SoberOctoberEliminations = Object.freeze({ refresh, resetOnLogout });
  ensureDialog();
})();
