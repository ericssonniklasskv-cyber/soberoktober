(() => {
  const ui = {
    card: document.querySelector('#home-history-card'),
    totalPoints: document.querySelector('#home-total-points'),
    completedDays: document.querySelector('#home-completed-days'),
    currentStreak: document.querySelector('#home-current-streak'),
    status: document.querySelector('#home-history-status'),
    saveStatus: document.querySelector('#save-status'),
  };

  let client;
  let activeSession = null;
  let sessionWork = Promise.resolve();
  const pointsFormatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

  function stockholmDate() {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).reduce((values, part) => {
      if (part.type !== 'literal') values[part.type] = part.value;
      return values;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function render(history) {
    const dayWord = history.currentStreak === 1 ? 'dag' : 'dagar';
    ui.totalPoints.textContent = pointsFormatter.format(history.totalPoints);
    ui.completedDays.textContent = String(history.completedDays);
    ui.currentStreak.textContent = `${history.currentStreak} ${dayWord}`;
    ui.status.textContent = '';
    ui.card.hidden = false;
  }

  async function loadSummary() {
    if (!activeSession) {
      ui.card.hidden = true;
      return;
    }

    const { data, error } = await client
      .from('daily_results')
      .select('result_date, multiplier, points')
      .gte('result_date', '2026-10-01')
      .lte('result_date', '2026-10-31')
      .order('result_date');

    if (error) throw error;
    const history = window.SoberOctoberHistory.calculate(data || [], stockholmDate());
    render(history);
  }

  async function handleSession(session) {
    activeSession = session;
    if (!session) {
      ui.card.hidden = true;
      return;
    }

    try {
      await loadSummary();
    } catch (error) {
      console.error('Startsidan kunde inte läsa Din oktober', error);
      ui.status.textContent = 'Din oktober kunde inte laddas just nu.';
      ui.card.hidden = false;
    }
  }

  function watchSavedResults() {
    if (!ui.saveStatus) return;
    const observer = new MutationObserver(() => {
      if (ui.saveStatus.textContent.startsWith('Dagens resultat är sparat') && activeSession) {
        loadSummary().catch((error) => console.error('Din oktober kunde inte uppdateras', error));
      }
    });
    observer.observe(ui.saveStatus, { childList: true, characterData: true, subtree: true });
  }

  async function init() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Konfigurationen saknas');
      const config = await response.json();
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await handleSession(data.session);
      watchSavedResults();

      client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        sessionWork = sessionWork
          .then(() => handleSession(session))
          .catch((sessionError) => console.error('Din oktober kunde inte uppdatera auth-status', sessionError));
      });
    } catch (error) {
      console.error('Din oktober kunde inte startas på startsidan', error);
      ui.card.hidden = true;
    }
  }

  init();
})();
