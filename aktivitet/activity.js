(function () {
  'use strict';
  const list = document.getElementById('activity-list');
  const more = document.getElementById('activity-more');
  const status = document.getElementById('activity-status');
  if (!list || !more || !status) return;
  let client;
  let offset = 0;
  let loading = false;
  let revision = 0, pending = false;
  const pageSize = 50;

  async function loadPage() {
    if (loading) { pending = true; return; }
    loading = true;
    const requestRevision = revision;
    more.disabled = true;
    status.textContent = offset ? 'Laddar äldre aktivitet…' : 'Laddar aktivitet…';
    try {
      client ||= await window.SoberActivity.createClient();
      const { data, error } = await window.SoberActivity.loadFeed(client, pageSize + 1, offset);
      if (requestRevision !== revision) return;
      if (error) throw error;
      const records = data || [];
      const page = records.slice(0, pageSize).map(item => window.SoberActivity.createFeedItem(item, false)).filter(Boolean);
      if (!page.length && offset === 0) {
        const empty = document.createElement('li');
        empty.className = 'activity-empty';
        empty.textContent = 'Inga aktiviteter än. Klara pass och bingorutor syns här.';
        list.replaceChildren(empty);
      } else if (page.length) {
        if (offset === 0) list.replaceChildren(...page);
        else list.append(...page);
      }
      offset += Math.min(records.length, pageSize);
      more.hidden = records.length <= pageSize;
      status.textContent = records.length > pageSize ? '' : (offset ? 'Du är ikapp med allt.' : '');
    } catch (_) {
      status.textContent = 'Aktiviteten kunde inte laddas. Kontrollera anslutningen och försök igen.';
      more.hidden = false;
    } finally {
      loading = false;
      more.disabled = false;
      if (pending) { pending = false; loadPage(); }
    }
  }

  more.addEventListener('click', loadPage);
  document.addEventListener('soberoktober:activity-auth', () => {
    revision++;
    offset = 0;
    list.replaceChildren();
    loadPage();
  });
  document.addEventListener('soberoktober:kudos-ready', () => { revision++; offset = 0; loadPage(); });
  loadPage();
})();
