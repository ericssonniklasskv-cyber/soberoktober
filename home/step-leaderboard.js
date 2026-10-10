(() => {
  const panel = document.querySelector('#home-step-preview');
  const list = document.querySelector('#home-step-list');
  const hero = document.querySelector('.hero-stage');
  const layout = document.querySelector('.challenge-layout');
  if (!panel || !list || !hero || !layout) return;

  const mobile = window.matchMedia('(max-width: 860px)');
  const formatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
  let client;
  let loading = false;

  function placePanel() {
    if (mobile.matches) layout.insertBefore(panel, layout.querySelector('.activity-preview'));
    else hero.appendChild(panel);
  }

  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    element.className = className;
    return element;
  }

  function render(rows) {
    list.replaceChildren();
    if (!rows.length) {
      list.appendChild(text('li', 'Stegtopplistan fylls på när första perioden rapporteras.', 'home-step-empty'));
      return;
    }
    // Keep the RPC's order and rankings; never recalculate scores in the preview.
    rows.forEach(entry => {
      const rank = Number(entry.rank_position);
      const row = document.createElement('li');
      row.className = `home-step-row${rank <= 3 ? ` top-${rank}` : ''}`;
      const info = document.createElement('span');
      info.className = 'home-step-info';
      info.append(
        text('span', entry.display_name, 'home-step-name'),
        text('span', `${formatter.format(Number(entry.average_steps))} steg/dag · ${Number(entry.reported_periods)}/4 perioder`, 'home-step-meta'),
      );
      row.append(text('span', String(rank), 'home-step-rank'), info);
      list.appendChild(row);
    });
  }

  async function load() {
    if (!client || loading) return;
    loading = true;
    try {
      const { data, error } = await client.rpc('get_step_leaderboard');
      if (error) throw error;
      render(data || []);
    } catch (_error) {
      list.replaceChildren(text('li', 'Stegtopplistan kunde inte laddas just nu.', 'home-step-empty'));
    } finally {
      loading = false;
    }
  }

  placePanel();
  mobile.addEventListener('change', placePanel);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void load();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) void load(); });
  window.SoberOctoberStepPreview = Object.freeze({
    init(publicClient) {
      client = publicClient;
      void load();
    },
  });
})();
