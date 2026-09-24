(() => {
  const PERIODS = [
    { key: 'oct_01_07', days: 7 },
    { key: 'oct_08_14', days: 7 },
    { key: 'oct_15_21', days: 7 },
    { key: 'oct_22_31', days: 10 },
  ];
  const byKey = new Map(PERIODS.map((period) => [period.key, period]));
  const ui = {
    average: document.querySelector('#steps-average'),
    coverage: document.querySelector('#steps-coverage'),
    reported: document.querySelector('#reported-count'),
    cards: [...document.querySelectorAll('[data-period-card]')],
    forms: [...document.querySelectorAll('.period-form')],
    loginNote: document.querySelector('#steps-login-note'),
    login: document.querySelector('#steps-login'),
    loginStatus: document.querySelector('#login-status'),
    pageStatus: document.querySelector('#steps-page-status'),
    leaderboard: document.querySelector('#step-leaderboard-list'),
    leaderboardStatus: document.querySelector('#step-leaderboard-status'),
  };
  const stepFormatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
  let client;
  let publicClient;
  let session = null;

  function setStatus(element, text, isError = false) {
    element.textContent = text;
    element.classList.toggle('is-error', isError);
  }

  function ownAverage(results) {
    let weightedTotal = 0;
    let includedDays = 0;
    results.forEach((result) => {
      const period = byKey.get(result.period_key);
      if (!period) return;
      weightedTotal += Number(result.avg_steps) * period.days;
      includedDays += period.days;
    });
    return { average: includedDays ? weightedTotal / includedDays : null, includedDays };
  }

  function renderSummary(results) {
    const { average, includedDays } = ownAverage(results);
    const count = results.length;
    ui.average.textContent = average === null ? '–' : stepFormatter.format(average);
    ui.reported.textContent = `${count}/4`;
    if (!count) {
      ui.coverage.textContent = 'Fyll i en period så räknar vi ditt snitt hittills.';
    } else if (count === PERIODS.length) {
      ui.coverage.textContent = `${includedDays} av 31 dagar medräknade · alla perioder rapporterade.`;
    } else {
      ui.coverage.textContent = `${includedDays} av 31 dagar medräknade · ${PERIODS.length - count} ${PERIODS.length - count === 1 ? 'period kvar' : 'perioder kvar'}.`;
    }
  }

  function renderOwnResults(results) {
    const resultByKey = new Map(results.map((result) => [result.period_key, result]));
    ui.cards.forEach((card) => {
      const periodKey = card.dataset.periodCard;
      const result = resultByKey.get(periodKey);
      const status = card.querySelector('.period-status');
      const input = card.querySelector('input');
      card.classList.toggle('is-saved', Boolean(result));
      status.textContent = result ? 'Sparat' : 'Saknas';
      input.value = result ? String(result.avg_steps) : '';
      input.disabled = false;
      card.querySelector('button[type="submit"]').disabled = false;
      setStatus(card.querySelector('.period-feedback'), result ? `Sparat snitt: ${stepFormatter.format(Number(result.avg_steps))} steg/dag.` : '');
    });
    renderSummary(results);
  }

  function renderSignedOut() {
    ui.loginNote.hidden = false;
    ui.login.disabled = false;
    ui.reported.textContent = '–/4';
    ui.average.textContent = '–';
    ui.coverage.textContent = 'Logga in för att se ditt snitt och dina rapporter.';
    ui.cards.forEach((card) => {
      card.querySelector('input').value = '';
      card.querySelector('input').disabled = true;
      card.querySelector('button[type="submit"]').disabled = true;
      setStatus(card.querySelector('.period-feedback'), '');
    });
  }

  async function loadOwnResults() {
    if (!session) return;
    ui.loginNote.hidden = true;
    const { data, error } = await client
      .from('step_period_results')
      .select('period_key, avg_steps')
      .order('period_key');
    if (error) {
      setStatus(ui.pageStatus, 'Dina perioder kunde inte laddas. Försök igen.', true);
      return;
    }
    setStatus(ui.pageStatus, '');
    renderOwnResults(data || []);
  }

  function createLeaderboardRow(entry) {
    const rank = document.createElement('li');
    const place = Number(entry.rank_position);
    rank.className = `step-leaderboard-row${place <= 3 ? ` top-${place}` : ''}`;
    const position = document.createElement('span');
    position.className = 'step-rank';
    position.textContent = String(place);
    const name = document.createElement('span');
    name.className = 'step-name';
    name.textContent = entry.display_name;
    const average = document.createElement('span');
    average.className = 'step-average-value';
    average.textContent = `${stepFormatter.format(Number(entry.average_steps))} steg/dag`;
    const periods = Number(entry.reported_periods);
    const count = document.createElement('span');
    count.className = 'step-period-count';
    count.textContent = `${periods}/4 ${periods === 1 ? 'period' : 'perioder'}`;
    rank.append(position, name, average, count);
    return rank;
  }

  async function loadLeaderboard() {
    const { data, error } = await publicClient.rpc('get_step_leaderboard');
    if (error) {
      ui.leaderboard.replaceChildren();
      const empty = document.createElement('li');
      empty.className = 'step-leaderboard-empty';
      empty.textContent = 'Stegtopplistan kunde inte laddas just nu.';
      ui.leaderboard.appendChild(empty);
      setStatus(ui.leaderboardStatus, 'Försök igen om en stund.', true);
      return;
    }
    setStatus(ui.leaderboardStatus, '');
    ui.leaderboard.replaceChildren();
    if (!data?.length) {
      const empty = document.createElement('li');
      empty.className = 'step-leaderboard-empty';
      empty.textContent = 'Stegtopplistan fylls på när första perioden rapporteras.';
      ui.leaderboard.appendChild(empty);
      return;
    }
    data.forEach((entry) => ui.leaderboard.appendChild(createLeaderboardRow(entry)));
  }

  async function savePeriod(form) {
    const periodKey = form.dataset.period;
    const input = form.elements.avg_steps;
    const button = form.querySelector('button[type="submit"]');
    const feedback = form.querySelector('.period-feedback');
    const cleaned = input.value.trim().replace(/\s+/g, '');
    if (!session) {
      ui.loginNote.hidden = false;
      ui.login.focus();
      return;
    }
    if (!byKey.has(periodKey) || !/^\d+$/.test(cleaned)) {
      setStatus(feedback, 'Ange ett positivt heltal mellan 1 och 100 000.', true);
      return;
    }
    const avgSteps = Number(cleaned);
    if (!Number.isSafeInteger(avgSteps) || avgSteps < 1 || avgSteps > 100000) {
      setStatus(feedback, 'Ange ett positivt heltal mellan 1 och 100 000.', true);
      return;
    }

    button.disabled = true;
    input.disabled = true;
    setStatus(feedback, 'Sparar…');
    const { error } = await client
      .from('step_period_results')
      .upsert(
        { user_id: session.user.id, period_key: periodKey, avg_steps: avgSteps },
        { onConflict: 'user_id,period_key' },
      );
    button.disabled = false;
    input.disabled = false;
    if (error) {
      setStatus(feedback, 'Perioden kunde inte sparas. Försök igen.', true);
      return;
    }
    setStatus(feedback, 'Perioden är sparad.');
    setStatus(ui.pageStatus, '');
    await Promise.all([loadOwnResults(), loadLeaderboard()]);
  }

  async function startLogin() {
    ui.login.disabled = true;
    setStatus(ui.loginStatus, '');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/stegtavling/', window.location.origin).href },
    });
    if (error) {
      ui.login.disabled = false;
      setStatus(ui.loginStatus, 'Google-inloggningen kunde inte startas. Försök igen.', true);
    }
  }

  ui.forms.forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    savePeriod(form);
  }));
  ui.login.addEventListener('click', startLogin);

  async function init() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Konfigurationen saknas');
      const config = await response.json();
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      publicClient = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'soberoktober-step-leaderboard' },
      });
      const [sessionResponse] = await Promise.all([client.auth.getSession(), loadLeaderboard()]);
      if (sessionResponse.error) throw sessionResponse.error;
      session = sessionResponse.data.session;
      if (session) await loadOwnResults();
      else renderSignedOut();
      client.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession;
        if (session) loadOwnResults();
        else renderSignedOut();
      });
    } catch (_error) {
      setStatus(ui.pageStatus, 'Stegtävlingen kunde inte startas just nu.', true);
      setStatus(ui.leaderboardStatus, 'Topplistan kunde inte laddas just nu.', true);
    }
  }

  init();
})();
