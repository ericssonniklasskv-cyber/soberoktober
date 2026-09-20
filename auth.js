(() => {
  const ui = {
    trigger: document.querySelector('#auth-trigger'),
    overlay: document.querySelector('#auth-overlay'),
    close: document.querySelector('#auth-close'),
    loginView: document.querySelector('#auth-login'),
    onboardingView: document.querySelector('#auth-onboarding'),
    accountView: document.querySelector('#auth-account'),
    googleLogin: document.querySelector('#google-login'),
    loginStatus: document.querySelector('#login-status'),
    form: document.querySelector('#name-form'),
    input: document.querySelector('#display-name'),
    email: document.querySelector('#auth-email'),
    nameStatus: document.querySelector('#name-status'),
    accountName: document.querySelector('#account-name'),
    accountEmail: document.querySelector('#account-email'),
    accountStatus: document.querySelector('#account-status'),
    signOut: document.querySelector('#sign-out'),
    levelButtons: [...document.querySelectorAll('.level[data-level]')],
    scoreSummary: document.querySelector('#score-summary'),
    dailyResult: document.querySelector('#daily-result'),
    dailyPoints: document.querySelector('#daily-points'),
    totalPoints: document.querySelector('#total-points'),
    completedDays: document.querySelector('#completed-days'),
    saveStatus: document.querySelector('#save-status'),
    challengeTitle: document.querySelector('#challenge-title'),
    challengeDescription: document.querySelector('#challenge-description'),
    historyLink: document.querySelector('#history-link'),
    adminLink: document.querySelector('#admin-link'),
    leaderboardList: document.querySelector('#leaderboard-list'),
    leaderboardSelf: document.querySelector('#leaderboard-self'),
    leaderboardStatus: document.querySelector('#leaderboard-status'),
    homeHistoryCard: document.querySelector('#home-history-card'),
    homeTotalPoints: document.querySelector('#home-total-points'),
    homeCompletedDays: document.querySelector('#home-completed-days'),
    homeCurrentStreak: document.querySelector('#home-current-streak'),
    homeHistoryStatus: document.querySelector('#home-history-status'),
    appShell: document.querySelector('#app-shell'),
    entryGate: document.querySelector('#entry-gate'),
    entryYes: document.querySelector('#entry-yes'),
    entryNo: document.querySelector('#entry-no'),
    entryStatus: document.querySelector('#entry-status'),
    entryJoke: document.querySelector('#entry-joke'),
    entryJokeYes: document.querySelector('#entry-joke-yes'),
    rulesGate: document.querySelector('#rules-gate'),
    rulesStart: document.querySelector('#rules-start'),
    rulesBack: document.querySelector('#rules-back'),
    rulesStatus: document.querySelector('#rules-status'),
  };

  let client;
  let session;
  let profile;
  let authReady = false;
  let sessionWork = Promise.resolve();
  const validMultipliers = new Set([1, 2, 3]);
  const pointsFormatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

  const cleanName = (value) => value.trim().replace(/\s+/g, ' ');

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

  function showView(view) {
    [ui.loginView, ui.onboardingView, ui.accountView].forEach((item) => {
      item.hidden = item !== view;
    });
  }

  function openModal(view) {
    showView(view);
    ui.overlay.classList.add('open');
    ui.overlay.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => {
      const focusTarget = view === ui.onboardingView ? ui.input : view.querySelector('button, input');
      focusTarget?.focus();
    }, 50);
  }

  function closeModal() {
    ui.overlay.classList.remove('open');
    ui.overlay.setAttribute('aria-hidden', 'true');
    (ui.entryGate.hidden ? ui.trigger : ui.entryYes).focus();
  }

  function setBusy(element, busy) {
    element.classList.toggle('auth-busy', busy);
    element.querySelectorAll('button, input').forEach((control) => {
      control.disabled = busy;
    });
  }

  function setEntryBusy(busy) {
    [ui.entryYes, ui.entryNo, ui.entryJokeYes, ui.rulesStart, ui.rulesBack].forEach((button) => {
      button.disabled = busy || !authReady;
    });
  }

  function setAppLocked(locked) {
    ui.appShell.inert = locked;
    ui.appShell.setAttribute('aria-hidden', String(locked));
    document.body.classList.toggle('entry-active', locked);
  }

  function showEntry() {
    ui.entryGate.hidden = false;
    ui.rulesGate.hidden = true;
    ui.entryJoke.hidden = true;
    setAppLocked(true);
    setEntryBusy(false);
  }

  function showRules() {
    ui.entryGate.hidden = true;
    ui.entryJoke.hidden = true;
    ui.rulesGate.hidden = false;
    ui.rulesStatus.textContent = '';
    setAppLocked(true);
    setEntryBusy(false);
    ui.rulesStart.focus();
  }

  function hideOnboardingGates() {
    ui.entryGate.hidden = true;
    ui.rulesGate.hidden = true;
    ui.entryJoke.hidden = true;
    setAppLocked(false);
  }

  function setSignedOut() {
    session = null;
    profile = null;
    ui.trigger.textContent = 'Logga in';
    ui.trigger.title = 'Logga in med Google';
    ui.scoreSummary.hidden = true;
    ui.saveStatus.textContent = '';
    ui.historyLink.hidden = true;
    ui.adminLink.hidden = true;
    ui.homeHistoryCard.hidden = true;
    showEntry();
  }

  function setSignedIn(displayName) {
    hideOnboardingGates();
    ui.trigger.textContent = displayName ? `Hej, ${displayName}` : 'Välj namn';
    ui.trigger.title = displayName ? 'Öppna ditt konto' : 'Slutför din profil';
  }

  function renderResults(results) {
    const today = stockholmDate();
    const todayResult = results.find((result) => result.result_date === today);
    const totalPoints = results.reduce((total, result) => total + Number(result.points), 0);
    const october = window.SoberOctoberHistory.calculate(results, today);
    const streakWord = october.currentStreak === 1 ? 'dag' : 'dagar';

    ui.dailyResult.textContent = todayResult ? `${todayResult.multiplier}×` : 'Inte registrerat';
    ui.dailyPoints.textContent = `${pointsFormatter.format(todayResult ? Number(todayResult.points) : 0)} poäng`;
    ui.totalPoints.textContent = pointsFormatter.format(totalPoints);
    ui.completedDays.textContent = String(results.length);
    ui.scoreSummary.hidden = false;
    ui.homeTotalPoints.textContent = pointsFormatter.format(october.totalPoints);
    ui.homeCompletedDays.textContent = String(october.completedDays);
    ui.homeCurrentStreak.textContent = `${october.currentStreak} ${streakWord}`;
    ui.homeHistoryStatus.textContent = '';
    ui.homeHistoryCard.hidden = false;
  }

  async function loadResults() {
    const { data, error } = await client
      .from('daily_results')
      .select('result_date, multiplier, points')
      .order('result_date', { ascending: true });

    if (error) throw error;
    renderResults(data || []);
  }

  async function loadTodayChallenge() {
    const { data, error } = await client
      .from('daily_challenges')
      .select('title, description, unit, base_amount')
      .eq('challenge_date', stockholmDate())
      .maybeSingle();

    if (error) {
      console.error('Kunde inte läsa dagens pass', error);
      return;
    }

    if (!data) {
      ui.challengeTitle.textContent = 'Dagens pass kommer snart';
      ui.challengeDescription.hidden = true;
      return;
    }

    const generatedDescription = [data.base_amount, data.unit].filter(Boolean).join(' ');
    ui.challengeTitle.textContent = data.title;
    ui.challengeDescription.textContent = data.description?.trim() || generatedDescription;
    ui.challengeDescription.hidden = !ui.challengeDescription.textContent;
  }

  function renderLeaderboard(rows) {
    ui.leaderboardList.replaceChildren();
    ui.leaderboardStatus.textContent = '';
    ui.leaderboardSelf.hidden = true;

    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Topplistan vaknar när det första passet är sparat.';
      ui.leaderboardList.appendChild(empty);
      return;
    }

    rows.forEach((entry) => {
      const rank = Number(entry.rank_position);
      const days = Number(entry.completed_days);
      const row = document.createElement('li');
      row.className = `leaderboard-row${rank <= 3 ? ` top-${rank}` : ''}${entry.is_current_user ? ' is-current' : ''}`;

      const rankBadge = document.createElement('span');
      rankBadge.className = 'leaderboard-rank';
      rankBadge.textContent = String(rank);

      const name = document.createElement('span');
      name.className = 'leaderboard-name';
      name.textContent = entry.display_name;

      if (entry.is_current_user) {
        const you = document.createElement('span');
        you.className = 'leaderboard-you';
        you.textContent = 'Du';
        name.appendChild(you);
        ui.leaderboardSelf.textContent = `Din placering: ${rank}`;
        ui.leaderboardSelf.hidden = false;
      }

      const points = document.createElement('span');
      points.className = 'leaderboard-points';
      points.textContent = `${pointsFormatter.format(Number(entry.total_points))} p`;

      const completed = document.createElement('span');
      completed.className = 'leaderboard-days';
      completed.textContent = `${days} ${days === 1 ? 'dag' : 'dagar'}`;

      row.append(rankBadge, name, points, completed);
      ui.leaderboardList.appendChild(row);
    });
  }

  async function refreshLeaderboard() {
    const { data, error } = await client.rpc('get_leaderboard');

    if (error) {
      console.error('Kunde inte läsa topplistan', error);
      ui.leaderboardStatus.textContent = 'Topplistan kunde inte laddas just nu.';
      return;
    }

    renderLeaderboard(data || []);
  }

  function setLevelBusy(busy) {
    ui.levelButtons.forEach((button) => {
      button.disabled = busy;
    });
  }

  async function saveDailyResult(multiplier) {
    if (!validMultipliers.has(multiplier)) return;

    if (!authReady) {
      ui.saveStatus.textContent = 'Inloggningen laddas. Försök igen om en sekund.';
      return;
    }

    if (!session) {
      ui.loginStatus.textContent = 'Logga in först för att spara dagens pass.';
      openModal(ui.loginView);
      return;
    }

    if (!profile?.display_name) {
      ui.nameStatus.textContent = 'Välj ditt namn innan du sparar dagens pass.';
      ui.email.textContent = session.user.email || '';
      openModal(ui.onboardingView);
      return;
    }

    ui.saveStatus.textContent = 'Sparar dagens resultat…';
    setLevelBusy(true);

    const { error } = await client
      .from('daily_results')
      .upsert(
        {
          user_id: session.user.id,
          result_date: stockholmDate(),
          multiplier,
        },
        { onConflict: 'user_id,result_date' },
      );

    if (error) {
      console.error('Kunde inte spara dagens resultat', error);
      ui.saveStatus.textContent = 'Resultatet kunde inte sparas. Försök igen.';
      setLevelBusy(false);
      return;
    }

    try {
      await loadResults();
      await refreshLeaderboard();
      ui.saveStatus.textContent = 'Dagens resultat är sparat.';
      window.celebrateLevel?.(multiplier);
    } catch (error) {
      console.error('Kunde inte uppdatera poängen', error);
      ui.saveStatus.textContent = 'Resultatet sparades, men poängen kunde inte uppdateras.';
    } finally {
      setLevelBusy(false);
    }
  }

  async function getOrCreateProfile(currentSession) {
    const user = currentSession.user;
    const { data, error } = await client
      .from('profiles')
      .select('id, email, display_name, is_admin, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: created, error: insertError } = await client
      .from('profiles')
      .insert({ id: user.id, email: user.email })
      .select('id, email, display_name, is_admin, created_at')
      .single();

    if (insertError) throw insertError;
    return created;
  }

  async function handleSession(nextSession) {
    session = nextSession;
    ui.loginStatus.textContent = '';
    ui.nameStatus.textContent = '';
    ui.accountStatus.textContent = '';

    if (!session) {
      setSignedOut();
      if (ui.overlay.classList.contains('open')) closeModal();
      await refreshLeaderboard();
      return;
    }

    hideOnboardingGates();

    try {
      profile = await getOrCreateProfile(session);
      setSignedIn(profile.display_name);
      ui.historyLink.hidden = false;
      ui.adminLink.hidden = !profile.is_admin;
      try {
        await loadResults();
      } catch (error) {
        console.error('Kunde inte läsa poängen', error);
        ui.saveStatus.textContent = 'Poängen kunde inte laddas. Försök igen om en stund.';
      }

      if (!profile.display_name) {
        ui.email.textContent = session.user.email || '';
        openModal(ui.onboardingView);
      } else {
        ui.accountName.textContent = `Hej, ${profile.display_name}!`;
        ui.accountEmail.textContent = session.user.email || '';
      }
      await refreshLeaderboard();
    } catch (error) {
      console.error('Kunde inte läsa profilen', error);
      setSignedIn('');
      ui.nameStatus.textContent = 'Profilen kunde inte laddas. Försök igen om en stund.';
      openModal(ui.onboardingView);
      await refreshLeaderboard();
    }
  }

  ui.trigger.addEventListener('click', () => {
    if (!session) {
      openModal(ui.loginView);
    } else if (!profile?.display_name) {
      ui.email.textContent = session.user.email || '';
      openModal(ui.onboardingView);
    } else {
      ui.accountName.textContent = `Hej, ${profile.display_name}!`;
      ui.accountEmail.textContent = session.user.email || '';
      openModal(ui.accountView);
    }
  });

  ui.levelButtons.forEach((button) => {
    button.addEventListener('click', () => saveDailyResult(Number(button.dataset.level)));
  });

  ui.close.addEventListener('click', closeModal);
  ui.overlay.addEventListener('click', (event) => {
    if (event.target === ui.overlay) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.overlay.classList.contains('open')) closeModal();
    if (event.key === 'Escape' && !ui.entryJoke.hidden) {
      ui.entryJoke.hidden = true;
      ui.entryNo.focus();
    }
  });

  async function startGoogleLogin() {
    ui.loginStatus.textContent = '';
    ui.entryStatus.textContent = '';
    ui.rulesStatus.textContent = '';
    setBusy(ui.loginView, true);
    setEntryBusy(true);

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/', window.location.origin).href },
    });

    if (error) {
      const message = 'Google-inloggningen kunde inte startas. Försök igen.';
      ui.loginStatus.textContent = message;
      ui.entryStatus.textContent = message;
      ui.rulesStatus.textContent = message;
      setBusy(ui.loginView, false);
      setEntryBusy(false);
    }
  }

  ui.googleLogin.addEventListener('click', startGoogleLogin);
  ui.entryYes.addEventListener('click', showRules);
  ui.entryJokeYes.addEventListener('click', showRules);
  ui.entryNo.addEventListener('click', () => {
    ui.entryJoke.hidden = false;
    ui.entryJokeYes.focus();
  });
  ui.rulesBack.addEventListener('click', showEntry);
  ui.rulesStart.addEventListener('click', () => {
    if (session) {
      hideOnboardingGates();
      return;
    }
    startGoogleLogin();
  });

  ui.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayName = cleanName(ui.input.value);

    if (displayName.length < 2 || displayName.length > 32) {
      ui.nameStatus.textContent = 'Välj ett namn med 2–32 tecken.';
      return;
    }

    ui.nameStatus.textContent = '';
    setBusy(ui.onboardingView, true);

    const { data, error } = await client
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', session.user.id)
      .select('id, email, display_name, is_admin, created_at')
      .single();

    setBusy(ui.onboardingView, false);

    if (error) {
      ui.nameStatus.textContent = 'Namnet kunde inte sparas. Försök igen.';
      return;
    }

    profile = data;
    setSignedIn(profile.display_name);
    ui.historyLink.hidden = false;
    ui.adminLink.hidden = !profile.is_admin;
    ui.accountName.textContent = `Hej, ${profile.display_name}!`;
    ui.accountEmail.textContent = session.user.email || '';
    await refreshLeaderboard();
    closeModal();
  });

  ui.signOut.addEventListener('click', async () => {
    ui.accountStatus.textContent = '';
    setBusy(ui.accountView, true);
    const { error } = await client.auth.signOut();
    setBusy(ui.accountView, false);

    if (error) {
      ui.accountStatus.textContent = 'Det gick inte att logga ut. Försök igen.';
      return;
    }

    setSignedOut();
    await refreshLeaderboard();
    closeModal();
  });

  async function init() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Konfigurationen saknas');

      const config = await response.json();
      if (!config.supabaseUrl || !config.supabasePublishableKey || !window.supabase) {
        throw new Error('Ogiltig auth-konfiguration');
      }

      client = window.supabase.createClient(
        config.supabaseUrl,
        config.supabasePublishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        },
      );

      await loadTodayChallenge();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      authReady = true;
      await handleSession(data.session);
      ui.trigger.disabled = false;

      client.auth.onAuthStateChange((_event, nextSession) => {
        sessionWork = sessionWork
          .then(() => handleSession(nextSession))
          .catch((error) => console.error('Auth-status kunde inte uppdateras', error));
      });
    } catch (error) {
      console.error('Supabase Auth kunde inte startas', error);
      ui.trigger.textContent = 'Login saknas';
      ui.trigger.title = 'Auth-konfigurationen kunde inte laddas';
      ui.entryStatus.textContent = 'Inloggningen kunde inte startas just nu.';
    }
  }

  init();
})();
