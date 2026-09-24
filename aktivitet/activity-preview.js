(function () {
  'use strict';
  const list = document.getElementById('activity-preview-list');
  if (!list) return;
  const status = document.getElementById('activity-preview-status');
  let client;
  let timer;

  function showMessage(message) {
    list.replaceChildren();
    const empty = document.createElement('li');
    empty.className = 'activity-empty';
    empty.textContent = message;
    list.append(empty);
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      client ||= await window.SoberActivity.createPublicClient();
      const { data, error } = await client.rpc('get_activity_feed', { p_limit: 4, p_offset: 0 });
      if (error) throw error;
      const items = (data || []).slice(0, 4).map(item => window.SoberActivity.createFeedItem(item, true)).filter(Boolean);
      if (!items.length) showMessage('Inga aktiviteter än. Bli först med dagens pass!');
      else list.replaceChildren(...items);
      status.textContent = '';
    } catch (_) {
      if (!list.children.length || list.querySelector('.activity-empty')?.textContent.includes('Laddar')) {
        showMessage('Aktiviteten kunde inte laddas just nu.');
      }
      status.textContent = 'Försök igen om en liten stund.';
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
  startPolling();
})();
