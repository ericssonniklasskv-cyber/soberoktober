(() => {
  const ui = {
    loading: document.querySelector('#loading-state'),
    signedOut: document.querySelector('#signed-out-state'),
    history: document.querySelector('#history-state'),
    googleLogin: document.querySelector('#google-login'),
    loginStatus: document.querySelector('#login-status'),
    summary: document.querySelector('#summary-line'),
    competition: document.querySelector('#competition-status'),
    totalPoints: document.querySelector('#total-points'),
    completedDays: document.querySelector('#completed-days'),
    currentStreak: document.querySelector('#current-streak'),
    longestStreak: document.querySelector('#longest-streak'),
    identity: document.querySelector('#history-identity'),
    calendar: document.querySelector('#history-calendar'),
    weeklyReportList: document.querySelector('#weekly-report-list'),
    historyStatus: document.querySelector('#history-status'),
    detail: document.querySelector('#day-detail'),
    detailClose: document.querySelector('#detail-close'),
    detailDate: document.querySelector('#detail-date'),
    detailTitle: document.querySelector('#detail-title'),
    detailDescription: document.querySelector('#detail-description'),
    detailLevel: document.querySelector('#detail-level'),
    detailPoints: document.querySelector('#detail-points'),
    reportDetail: document.querySelector('#weekly-report-detail'),
    reportDetailClose: document.querySelector('#report-detail-close'),
    reportPeriod: document.querySelector('#weekly-report-period'),
    reportTitle: document.querySelector('#weekly-report-detail-title'),
    reportPep: document.querySelector('#weekly-report-pep'),
    reportStats: document.querySelector('#weekly-report-stats'),
    reportExerciseSection: document.querySelector('#weekly-report-exercise-section'),
    reportExercises: document.querySelector('#weekly-report-exercises'),
    reportSteps: document.querySelector('#weekly-report-steps'),
    reportConfetti: document.querySelector('#report-confetti'),
  };

  let client;
  let sessionWork = Promise.resolve();
  let challengesByDate = new Map();
  let weeklyReports = new Map();
  let activeUserId = null;
  const pointsFormatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
  const reportSeenStorageKey = (userId) => `soberoktober:weekly-reports-seen:${userId}`;

  function seenReportKeys() {
    try {
      const saved = JSON.parse(localStorage.getItem(reportSeenStorageKey(activeUserId)) || '[]');
      return new Set(Array.isArray(saved) ? saved.filter((key) => typeof key === 'string') : []);
    } catch (_error) {
      return new Set();
    }
  }

  function markReportSeen(key) {
    const seen = seenReportKeys();
    const wasNew = !seen.has(key);
    seen.add(key);
    try {
      localStorage.setItem(reportSeenStorageKey(activeUserId), JSON.stringify([...seen]));
    } catch (_error) {
      // The report remains available even when browser storage is unavailable.
    }
    return wasNew;
  }

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

  function formatDate(date) {
    return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' })
      .format(new Date(`${date}T12:00:00`));
  }

  function showState(active) {
    [ui.loading, ui.signedOut, ui.history].forEach((state) => {
      state.hidden = state !== active;
    });
  }

  function challengeDescription(challenge) {
    if (!challenge) return 'Passinformationen saknas';
    const generated = [challenge.base_amount, challenge.unit].filter((value) => value !== null && value !== '').join(' ');
    return challenge.description?.trim() || generated || challenge.title;
  }

  function openDetail(day) {
    const challenge = challengesByDate.get(day.date);
    ui.detailDate.textContent = formatDate(day.date);
    ui.detailTitle.textContent = challenge?.title || 'Dagens pass';
    ui.detailDescription.textContent = challengeDescription(challenge);
    ui.detailLevel.textContent = `${day.result.multiplier}×`;
    ui.detailPoints.textContent = `${pointsFormatter.format(Number(day.result.points))} poäng`;
    ui.detail.showModal();
  }

  function renderCalendar(history, today) {
    const firstWeekday = new Date('2026-10-01T12:00:00').getDay();
    const mondayOffset = (firstWeekday + 6) % 7;
    const cells = Array.from({ length: mondayOffset }, () => {
      const spacer = document.createElement('span');
      spacer.className = 'calendar-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      return spacer;
    });

    history.days.forEach((day, index) => {
      const cell = document.createElement(day.state === 'completed' ? 'button' : 'div');
      cell.className = `calendar-day ${day.state}${day.date === today ? ' today' : ''}`;
      if (cell.tagName === 'BUTTON') {
        cell.type = 'button';
        cell.addEventListener('click', () => openDetail(day));
      }

      const dayNumber = document.createElement('span');
      dayNumber.className = 'day-number';
      dayNumber.textContent = String(index + 1);
      cell.append(dayNumber);

      const result = document.createElement('span');
      result.className = 'day-result';
      result.textContent = day.state === 'completed'
        ? `${day.result.multiplier}×`
        : (day.state === 'missed' ? 'Missad' : (day.date === today ? 'Idag' : 'Senare'));
      cell.append(result);

      if (day.state === 'completed') {
        const points = document.createElement('span');
        points.className = 'day-points';
        points.textContent = `${pointsFormatter.format(Number(day.result.points))} p`;
        cell.append(points);
        const challenge = challengesByDate.get(day.date);
        cell.setAttribute('aria-label', `${formatDate(day.date)}, genomförd ${day.result.multiplier} gånger, ${pointsFormatter.format(Number(day.result.points))} poäng, ${challengeDescription(challenge)}`);
      } else {
        cell.setAttribute('aria-label', `${formatDate(day.date)}, ${day.state === 'missed' ? 'missad' : 'framtida'}`);
      }
      cells.push(cell);
    });

    ui.calendar.replaceChildren(...cells);
  }

  function formatNumber(value) {
    return pointsFormatter.format(value);
  }

  function createReportCard(period, report, seen) {
    const card = document.createElement('article');
    card.className = `weekly-report-card${report ? ' is-available' : ' is-locked'}`;

    const eyebrow = document.createElement('p');
    eyebrow.className = 'weekly-report-label';
    eyebrow.textContent = period.label;

    const title = document.createElement('h3');
    title.textContent = period.title;

    const summary = document.createElement('p');
    summary.className = 'weekly-report-summary';
    summary.textContent = report
      ? `${report.completedDays} av ${period.days} dagar · ${formatNumber(report.trainingPoints)} träningspoäng`
      : (period.start > stockholmDate() ? 'Låst tills perioden är avslutad' : 'Pågår fortfarande');

    const action = document.createElement(report ? 'button' : 'span');
    action.className = report ? 'weekly-report-action' : 'weekly-report-lock';
    if (report) {
      action.type = 'button';
      action.dataset.periodKey = period.key;
      action.textContent = seen.has(period.key) ? 'Öppna rapport →' : 'Ny rapport · öppna →';
      action.addEventListener('click', () => openWeeklyReport(period.key));
      action.setAttribute('aria-label', `${seen.has(period.key) ? 'Öppna' : 'Ny'} rapport: ${period.title}, ${period.label}`);
    } else {
      action.textContent = 'Kommer snart';
      action.setAttribute('aria-label', `Rapporten för ${period.title} är låst`);
    }

    if (report && !seen.has(period.key)) {
      const badge = document.createElement('span');
      badge.className = 'weekly-report-new';
      badge.textContent = 'Ny';
      card.append(eyebrow, title, badge, summary, action);
    } else {
      card.append(eyebrow, title, summary, action);
    }
    return card;
  }

  function renderWeeklyReports(results, challenges, stepResults, today) {
    const seen = seenReportKeys();
    weeklyReports = new Map();
    const cards = window.SoberOctoberHistory.REPORT_PERIODS.map((period) => {
      const report = window.SoberOctoberHistory.buildPeriodReport({
        results,
        challenges,
        stepResults,
        periodKey: period.key,
        today,
        stepsLogic: window.SoberOctoberSteps,
      });
      if (report) weeklyReports.set(period.key, report);
      return createReportCard(period, report, seen);
    });
    ui.weeklyReportList.replaceChildren(...cards);
  }

  function addReportConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ef8537', '#204b3b', '#e9b674', '#a8bd9b'];
    ui.reportConfetti.replaceChildren();
    for (let index = 0; index < 28; index += 1) {
      const piece = document.createElement('i');
      piece.style.setProperty('--confetti-x', `${Math.random() * 100}%`);
      piece.style.setProperty('--confetti-color', colors[index % colors.length]);
      piece.style.setProperty('--confetti-delay', `${Math.random() * 220}ms`);
      piece.className = 'report-confetti-piece';
      ui.reportConfetti.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
  }

  function openWeeklyReport(periodKey) {
    const report = weeklyReports.get(periodKey);
    if (!report) return;
    const wasNew = markReportSeen(periodKey);
    ui.reportPeriod.textContent = report.label;
    ui.reportTitle.textContent = `${report.title} är klar!`;
    ui.reportPep.textContent = report.completedDays === report.days
      ? 'Hela perioden avklarad. Du kan vara riktigt nöjd med den insatsen.'
      : report.completedDays > 0
        ? `Du var med ${report.completedDays} av ${report.days} dagar. Varje pass du gjorde räknas.`
        : 'En period i backspegeln. Nästa chans väntar när du är redo.';

    const stats = [
      ['Genomförda dagar', `${report.completedDays} av ${report.days}`],
      ['Missade dagar', String(report.missedDays)],
      ['Träningspoäng', `${formatNumber(report.trainingPoints)} p`],
      ['3×-dagar', String(report.multiplierCounts[3])],
      ['Bästa streak', `${report.bestStreak} ${report.bestStreak === 1 ? 'dag' : 'dagar'}`],
    ];
    ui.reportStats.replaceChildren(...stats.map(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'report-stat';
      const name = document.createElement('span');
      name.textContent = label;
      const amount = document.createElement('strong');
      amount.textContent = value;
      item.append(name, amount);
      return item;
    }));

    const exercises = report.exerciseTotals.map((total) => {
      const item = document.createElement('li');
      const amount = document.createElement('strong');
      amount.textContent = `${formatNumber(total.amount)} ${total.unit}`;
      item.appendChild(amount);
      return item;
    });
    ui.reportExercises.replaceChildren(...exercises);
    ui.reportExerciseSection.hidden = exercises.length === 0;

    if (report.stepAverage === null) {
      ui.reportSteps.textContent = 'Steg för perioden är inte rapporterade ännu.';
      ui.reportSteps.classList.add('is-unreported');
    } else {
      ui.reportSteps.textContent = `${formatNumber(report.stepAverage)} steg/dag i snitt · ${report.stepPoints}/20 möjliga stegpoäng om du håller samma snitt.`;
      ui.reportSteps.classList.remove('is-unreported');
    }

    ui.reportDetail.showModal();
    if (wasNew) addReportConfetti();
    renderWeeklyReportsFromCache();
  }

  function renderWeeklyReportsFromCache() {
    const seen = seenReportKeys();
    ui.weeklyReportList.querySelectorAll('.weekly-report-action').forEach((action) => {
      const key = action.dataset.periodKey;
      if (!seen.has(key)) return;
      action.closest('.weekly-report-card')?.querySelector('.weekly-report-new')?.remove();
      action.textContent = 'Öppna rapport →';
      action.setAttribute('aria-label', `Öppna rapport: ${action.closest('.weekly-report-card')?.querySelector('h3')?.textContent}`);
    });
  }

  function renderHistory(results, displayName) {
    const today = stockholmDate();
    const history = window.SoberOctoberHistory.calculate(results, today);
    const points = pointsFormatter.format(history.totalPoints);
    const dayWord = history.completedDays === 1 ? 'dag' : 'dagar';
    const streakWord = history.currentStreak === 1 ? 'dag' : 'dagar';

    ui.summary.textContent = `${history.completedDays} ${dayWord} genomförda · ${points} poäng · streak ${history.currentStreak} ${streakWord}`;
    ui.totalPoints.textContent = points;
    ui.completedDays.textContent = String(history.completedDays);
    ui.currentStreak.textContent = String(history.currentStreak);
    ui.longestStreak.textContent = String(history.longestStreak);
    ui.identity.textContent = displayName || '';
    ui.competition.className = `competition ${history.competition.tone}`;
    ui.competition.textContent = history.competition.text;
    if (history.eliminatedAt) ui.competition.textContent += ` (${formatDate(history.eliminatedAt)})`;
    renderCalendar(history, today);
  }

  async function loadHistory(session) {
    ui.historyStatus.textContent = '';
    const [resultsResponse, challengesResponse, stepResultsResponse, profileResponse] = await Promise.all([
      client
        .from('daily_results')
        .select('result_date, multiplier, points')
        .eq('user_id', session.user.id)
        .gte('result_date', '2026-10-01')
        .lte('result_date', '2026-10-31')
        .order('result_date'),
      client
        .from('daily_challenges')
        .select('challenge_date, title, description, unit, base_amount')
        .gte('challenge_date', '2026-10-01')
        .lte('challenge_date', '2026-10-31')
        .order('challenge_date'),
      client
        .from('step_period_results')
        .select('period_key, avg_steps')
        .eq('user_id', session.user.id),
      client
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle(),
    ]);

    if (resultsResponse.error) throw resultsResponse.error;
    if (challengesResponse.error) throw challengesResponse.error;
    if (stepResultsResponse.error) throw stepResultsResponse.error;
    if (profileResponse.error) throw profileResponse.error;

    const results = resultsResponse.data || [];
    const challenges = challengesResponse.data || [];
    const stepResults = stepResultsResponse.data || [];
    challengesByDate = new Map(challenges.map((challenge) => [challenge.challenge_date, challenge]));
    activeUserId = session.user.id;
    renderHistory(results, profileResponse.data?.display_name);
    renderWeeklyReports(results, challenges, stepResults, stockholmDate());

    const requestedReport = new URLSearchParams(window.location.search).get('rapport');
    if (requestedReport && weeklyReports.has(requestedReport)) {
      openWeeklyReport(requestedReport);
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
  }

  async function handleSession(session) {
    ui.loginStatus.textContent = '';
    if (!session) {
      showState(ui.signedOut);
      return;
    }

    showState(ui.loading);
    try {
      await loadHistory(session);
      showState(ui.history);
    } catch (error) {
      console.error('Historiken kunde inte laddas', error);
      ui.loading.innerHTML = '<p class="loading">Din oktober kunde inte laddas just nu.</p>';
    }
  }

  ui.googleLogin.addEventListener('click', async () => {
    ui.googleLogin.disabled = true;
    ui.loginStatus.textContent = '';
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/min-oktober/', window.location.origin).href },
    });
    if (error) {
      ui.loginStatus.textContent = 'Google-inloggningen kunde inte startas.';
      ui.googleLogin.disabled = false;
    }
  });

  ui.detailClose.addEventListener('click', () => ui.detail.close());
  ui.detail.addEventListener('click', (event) => {
    if (event.target === ui.detail) ui.detail.close();
  });
  ui.reportDetailClose.addEventListener('click', () => ui.reportDetail.close());
  ui.reportDetail.addEventListener('click', (event) => {
    if (event.target === ui.reportDetail) ui.reportDetail.close();
  });

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

      client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        sessionWork = sessionWork
          .then(() => handleSession(session))
          .catch((sessionError) => console.error('Historikens auth-status kunde inte uppdateras', sessionError));
      });
    } catch (error) {
      console.error('Min oktober kunde inte startas', error);
      ui.loading.innerHTML = '<p class="loading">Min oktober kunde inte startas.</p>';
    }
  }

  init();
})();
