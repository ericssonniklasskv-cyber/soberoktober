(function () {
  'use strict';
  const list = document.getElementById('activity-list');
  const more = document.getElementById('activity-more');
  const status = document.getElementById('activity-status');
  if (!list || !more || !status) return;
  let client;
  let offset = 0;
  let loading = false;
  const pageSize = 50;

  async function loadPage() {
    if (loading) return;
    loading = true;
    more.disabled = true;
    status.textContent = offset ? 'Laddar äldre aktivitet…' : 'Laddar aktivitet…';
    try {
      client ||= await window.SoberActivity.createPublicClient();
      const { data, error } = await client.rpc('get_activity_feed', { p_limit: pageSize + 1, p_offset: offset });
      if (error) throw error;
      const records = data || [];
      const page = records.slice(0, pageSize).map(item => window.SoberActivity.createFeedItem(item, false)).filter(Boolean);
      if (!page.length && offset === 0) {
        const empty = document.createElement('li');
        empty.className = 'activity-empty';
        empty.textContent = 'Inga aktiviteter än. När någon klarar dagens pass syns det här.';
        list.replaceChildren(empty);
      } else if (page.length) list.append(...page);
      offset += page.length;
      more.hidden = records.length <= pageSize;
      status.textContent = records.length > pageSize ? '' : (offset ? 'Du är ikapp med allt.' : '');
    } catch (_) {
      status.textContent = 'Aktiviteten kunde inte laddas. Kontrollera anslutningen och försök igen.';
      more.hidden = false;
    } finally {
      loading = false;
      more.disabled = false;
    }
  }

  more.addEventListener('click', loadPage);
  loadPage();
})();
