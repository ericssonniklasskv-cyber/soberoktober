(function () {
  'use strict';
  const list = document.getElementById('activity-preview-list');
  if (!list) return;
  const status = document.getElementById('activity-preview-status');
  let client;
  let timer;
  let loading = false;
  let revision = 0, pending = false;

  function showMessage(message) {
    list.replaceChildren();
    const empty = document.createElement('li');
    empty.className = 'activity-empty';
    empty.textContent = message;
    list.append(empty);
  }

  async function refresh() {
    if (document.hidden) return;
    if (loading) { pending = true; return; }
    loading = true;
    const requestRevision = revision;
    try {
      client ||= await window.SoberActivity.createClient();
      const { data, error } = await window.SoberActivity.loadFeed(client, 4, 0);
      if (requestRevision !== revision) return;
      if (error) throw error;
      const items = (data || []).slice(0, 4).map(item => window.SoberActivity.createFeedItem(item, true)).filter(Boolean);
      if (!items.length) showMessage('Inga aktiviteter än. Nästa lilla seger syns här!');
      else list.replaceChildren(...items);
      status.textContent = '';
    } catch (_) {
      if (!list.children.length || list.querySelector('.activity-empty')?.textContent.includes('Laddar')) {
        showMessage('Aktiviteten kunde inte laddas just nu.');
      }
      status.textContent = 'Försök igen om en liten stund.';
    } finally {
      loading = false;
      if (pending) { pending = false; refresh(); }
    }
  }

  function startPolling() {
    clearInterval(timer);
    refresh();
    timer = setInterval(refresh, 30000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(timer);
    else startPolling();
  });
  document.addEventListener('soberoktober:bingo-saved', refresh);
  document.addEventListener('soberoktober:activity-auth', () => {
    revision++;
    // Clear personalized controls immediately when the session changes.
    showMessage('Laddar senaste aktivitet…');
    refresh();
  });
  document.addEventListener('soberoktober:kudos-ready', refresh);
  startPolling();
})();
