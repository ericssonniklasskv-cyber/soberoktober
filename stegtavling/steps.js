(() => {
  const { PERIODS, calculateWeightedAverage, createProjection } = window.SoberOctoberSteps;
  const periodKeys = new Set(PERIODS.map((period) => period.key));
  const ui = {
    average: document.querySelector('#steps-average'),
    summaryTitle: document.querySelector('#steps-summary-title'),
    coverage: document.querySelector('#steps-coverage'),
    reported: document.querySelector('#reported-count'),
    score: document.querySelector('#steps-score'),
    scoreKicker: document.querySelector('#steps-score-kicker'),
    scoreTrack: document.querySelector('.steps-score-track'),
    scoreFill: document.querySelector('#steps-score-fill'),
    projection: document.querySelector('#steps-projection'),
    nextLevel: document.querySelector('#steps-next-level'),
    cards: [...document.querySelectorAll('[data-period-card]')],
    forms: [...document.querySelectorAll('.period-form')],
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

  function renderSummary(results) {
    const projection = createProjection(results);
    const { average, includedDays, reportedPeriods: count } = projection;
    ui.average.textContent = average === null ? '–' : stepFormatter.format(average);
    ui.reported.textContent = `${count}/4`;
    ui.summaryTitle.textContent = projection.final ? 'Ditt slutliga snitt' : 'Ditt snitt hittills';
    ui.score.textContent = projection.points === null ? '–' : String(projection.points);
    ui.scoreKicker.textContent = projection.final ? 'Slutliga stegpoäng' : 'Stegpoäng just nu';
    ui.scoreFill.style.width = `${projection.points === null ? 0 : projection.points / 20 * 100}%`;
    ui.scoreTrack.setAttribute('aria-valuenow', String(projection.points ?? 0));
    if (!count) {
      ui.coverage.textContent = 'Fyll i en period så räknar vi ditt snitt hittills.';
    } else if (count === PERIODS.length) {
      ui.coverage.textContent = `${includedDays} av 31 dagar medräknade · alla perioder rapporterade.`;
    } else {
      ui.coverage.textContent = `${includedDays} av 31 dagar medräknade · ${PERIODS.length - count} ${PERIODS.length - count === 1 ? 'period kvar' : 'perioder kvar'}.`;
    }

    if (projection.final) {
      ui.projection.textContent = `Stegpoäng: ${projection.points}/20. Resultatet är slutligt.`;
      ui.nextLevel.textContent = 'Samtliga perioder är rapporterade.';
    } else if (average === null) {
      ui.projection.textContent = 'Fyll i en period för att se din prognos.';
      ui.nextLevel.textContent = '';
    } else {
      ui.projection.textContent = `Du snittar just nu ${stepFormatter.format(average)} steg per dag. Om du håller det här tempot slutar du på ${projection.points}/20 stegpoäng. ${projection.points >= 18 ? 'Snyggt jobbat!' : 'Bra kämpat — varje period räknas!'}`;
      if (projection.nextLevel) {
        const { stepsRemaining, points } = projection.nextLevel;
        ui.nextLevel.textContent = points === 20
          ? `${stepFormatter.format(stepsRemaining)} steg/dag till full pott!`
          : `${stepFormatter.format(stepsRemaining)} steg/dag till nästa nivå: ${points} poäng`;
      } else {
        ui.nextLevel.textContent = 'Du ligger på 20/20 möjliga stegpoäng. Full pott!';
      }
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
    ui.reported.textContent = '–/4';
    ui.average.textContent = '–';
    ui.summaryTitle.textContent = 'Ditt snitt hittills';
    ui.coverage.textContent = 'Dina egna rapporter visas här.';
    ui.score.textContent = '–';
    ui.scoreKicker.textContent = 'Stegpoäng just nu';
    ui.scoreFill.style.width = '0%';
    ui.scoreTrack.setAttribute('aria-valuenow', '0');
    ui.projection.textContent = 'Ditt stegresultat visas här när du är inloggad.';
    ui.nextLevel.textContent = '';
    ui.cards.forEach((card) => {
      card.querySelector('input').value = '';
      card.querySelector('input').disabled = true;
      card.querySelector('button[type="submit"]').disabled = true;
      setStatus(card.querySelector('.period-feedback'), '');
    });
  }

  async function loadOwnResults() {
    if (!session) return;
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
      setStatus(ui.pageStatus, 'Logga in på startsidan för att rapportera perioder.', true);
      return;
    }
    if (!periodKeys.has(periodKey) || !/^\d+$/.test(cleaned)) {
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

  ui.forms.forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    savePeriod(form);
  }));

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
