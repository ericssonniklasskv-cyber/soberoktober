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
    historyStatus: document.querySelector('#history-status'),
    detail: document.querySelector('#day-detail'),
    detailClose: document.querySelector('#detail-close'),
    detailDate: document.querySelector('#detail-date'),
    detailTitle: document.querySelector('#detail-title'),
    detailDescription: document.querySelector('#detail-description'),
    detailLevel: document.querySelector('#detail-level'),
    detailPoints: document.querySelector('#detail-points'),
  };

  let client;
  let sessionWork = Promise.resolve();
  let challengesByDate = new Map();
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
        : (day.state === 'missed' ? 'Missad' : (day.date === today ? 'Idag' : 'Framtida'));
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
    const [resultsResponse, challengesResponse, profileResponse] = await Promise.all([
      client
        .from('daily_results')
        .select('result_date, multiplier, points')
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
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle(),
    ]);

    if (resultsResponse.error) throw resultsResponse.error;
    if (challengesResponse.error) throw challengesResponse.error;
    if (profileResponse.error) throw profileResponse.error;

    challengesByDate = new Map((challengesResponse.data || []).map((challenge) => [challenge.challenge_date, challenge]));
    renderHistory(resultsResponse.data || [], profileResponse.data?.display_name);
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
