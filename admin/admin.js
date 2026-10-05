(() => {
  const OCTOBER_DATES = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`);
  const OCTOBER_START = OCTOBER_DATES[0];
  const OCTOBER_END = OCTOBER_DATES.at(-1);

  const ui = {
    loading: document.querySelector('#loading-state'),
    signedOut: document.querySelector('#signed-out-state'),
    denied: document.querySelector('#denied-state'),
    admin: document.querySelector('#admin-state'),
    googleLogin: document.querySelector('#google-login'),
    loginStatus: document.querySelector('#login-status'),
    deniedSignOut: document.querySelector('#denied-sign-out'),
    adminSignOut: document.querySelector('#admin-sign-out'),
    identity: document.querySelector('#admin-identity'),
    progressCount: document.querySelector('#progress-count'),
    days: document.querySelector('#challenge-days'),
    editor: document.querySelector('#challenge-editor'),
    editorTitle: document.querySelector('#editor-title'),
    existingStatus: document.querySelector('#existing-status'),
    previousDay: document.querySelector('#previous-day'),
    nextDay: document.querySelector('#next-day'),
    form: document.querySelector('#challenge-form'),
    date: document.querySelector('#challenge-date'),
    title: document.querySelector('#challenge-title'),
    description: document.querySelector('#challenge-description'),
    amount: document.querySelector('#challenge-amount'),
    unit: document.querySelector('#challenge-unit'),
    completionMode: document.querySelector('#completion-mode'),
    secondPartFields: document.querySelector('#second-part-fields'),
    secondDescription: document.querySelector('#second-description'),
    secondAmount: document.querySelector('#second-amount'),
    secondUnit: document.querySelector('#second-unit'),
    bonusDescription: document.querySelector('#bonus-description'),
    bonusPoints: document.querySelector('#bonus-points'),
    formStatus: document.querySelector('#form-status'),
    participants: document.querySelector('#participants-list'),
    participantsStatus: document.querySelector('#participants-status'),
    refreshParticipants: document.querySelector('#refresh-participants'),
    participantConfirmation: document.querySelector('#participant-confirmation'),
    participantConfirmTitle: document.querySelector('#participant-confirm-title'),
    participantConfirmCopy: document.querySelector('#participant-confirm-copy'),
    cancelParticipantAction: document.querySelector('#cancel-participant-action'),
    confirmParticipantAction: document.querySelector('#confirm-participant-action'),
  };

  let client;
  let activeSession;
  let sessionWork = Promise.resolve();
  let selectedDate = OCTOBER_START;
  let challenges = new Map();
  let participantAction = null;

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

  function formatDate(date, includeYear = false) {
    return new Intl.DateTimeFormat('sv-SE', {
      day: 'numeric',
      month: 'long',
      ...(includeYear ? { year: 'numeric' } : {}),
    }).format(new Date(`${date}T12:00:00`));
  }

  function showState(active) {
    [ui.loading, ui.signedOut, ui.denied, ui.admin].forEach((state) => {
      state.hidden = state !== active;
    });
  }

  function renderParticipants(rows) {
    window.SoberOctoberAdminCorrections?.mount(client, rows);
    ui.participants.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'participant-empty';
      empty.textContent = 'Inga deltagare har valt namn ännu.';
      ui.participants.appendChild(empty);
      return;
    }

    rows.forEach((participant) => {
      const item = document.createElement('li');
      item.className = `participant-row${participant.status === 'eliminated' ? ' is-eliminated' : ''}`;
      const details = document.createElement('div');
      details.className = 'participant-details';
      const name = document.createElement('strong');
      name.textContent = participant.display_name;
      const status = document.createElement('span');
      status.className = 'participant-state';
      status.textContent = participant.status === 'eliminated'
        ? `Utslagen${participant.elimination_reason ? ` · ${participant.elimination_reason}` : ''}`
        : 'Aktiv';
      details.append(name, status);

      const action = document.createElement('button');
      action.type = 'button';
      action.className = participant.status === 'eliminated' ? 'secondary participant-action' : 'primary danger participant-action';
      action.dataset.participantId = participant.participant_id;
      action.dataset.participantName = participant.display_name;
      action.dataset.action = participant.status === 'eliminated' ? 'restore' : 'eliminate';
      action.textContent = participant.status === 'eliminated' ? 'Återställ till Aktiv' : 'Slå ut deltagare';
      action.addEventListener('click', () => confirmParticipantAction(action));
      item.append(details, action);
      ui.participants.appendChild(item);
    });
  }

  async function loadCompetitionParticipants() {
    ui.participantsStatus.textContent = '';
    const { data, error } = await client.rpc('get_admin_competition_participants');
    if (error) {
      console.error('Deltagarlistan kunde inte laddas', error);
      ui.participantsStatus.textContent = 'Deltagarlistan kunde inte laddas just nu.';
      return;
    }
    renderParticipants(data || []);
  }

  function confirmParticipantAction(button) {
    participantAction = {
      id: button.dataset.participantId,
      name: button.dataset.participantName,
      action: button.dataset.action,
    };
    const restore = participantAction.action === 'restore';
    ui.participantConfirmTitle.textContent = restore ? 'Återställa deltagare?' : 'Slå ut deltagare?';
    ui.participantConfirmCopy.textContent = restore
      ? `Vill du återställa ${participantAction.name} till Aktiv? Den gamla utslagsnotisen avaktiveras.`
      : `Vill du slå ut ${participantAction.name} ur tävlingen med anledning Alkohol?`;
    ui.confirmParticipantAction.textContent = restore ? 'Återställ till Aktiv' : 'Slå ut deltagare';
    ui.participantConfirmation.showModal();
  }

  async function applyParticipantAction() {
    if (!participantAction) return;
    const current = participantAction;
    participantAction = null;
    ui.confirmParticipantAction.disabled = true;
    const rpc = current.action === 'restore' ? 'admin_restore_participant' : 'admin_eliminate_participant';
    const { error } = await client.rpc(rpc, { p_user_id: current.id });
    ui.confirmParticipantAction.disabled = false;
    ui.participantConfirmation.close();
    if (error) {
      console.error('Tävlingsstatusen kunde inte uppdateras', error);
      ui.participantsStatus.textContent = 'Tävlingsstatusen kunde inte uppdateras. Kontrollera behörighet och försök igen.';
      return;
    }
    ui.participantsStatus.textContent = current.action === 'restore'
      ? `${current.name} är återställd till Aktiv.`
      : `${current.name} är utslagen med anledning Alkohol.`;
    await loadCompetitionParticipants();
  }

  function setBusy(busy) {
    ui.form.classList.toggle('busy', busy);
    ui.form.querySelectorAll('button, input, textarea, select').forEach((control) => {
      control.disabled = busy;
    });
  }

  function clearFields() {
    ui.title.value = '';
    ui.description.value = '';
    ui.amount.value = '';
    ui.unit.value = '';
    ui.completionMode.value = 'single';
    ui.secondDescription.value = '';
    ui.secondAmount.value = '';
    ui.secondUnit.value = '';
    ui.bonusDescription.value = '';
    ui.bonusPoints.value = '1';
    ui.secondPartFields.hidden = true;
  }

  function challengeDescription(challenge) {
    if (!challenge) return 'Ingen beskrivning';
    const first = String(challenge.description || '').trim()
      || [challenge.base_amount, challenge.unit].filter(Boolean).join(' ')
      || 'Del 1';
    const mode = challenge.completion_mode || 'single';
    const second = String(challenge.second_description || '').trim()
      || [challenge.second_base_amount, challenge.second_unit].filter(Boolean).join(' ')
      || 'Del 2';
    const primary = mode === 'single' ? first : `${first} ${mode === 'and' ? 'och' : 'eller'} ${second}`;
    return challenge.bonus_description
      ? `${primary} · Bonus: ${challenge.bonus_description} (+${challenge.bonus_points || 0} p)`
      : primary;
  }

  function updateModeFields() {
    ui.secondPartFields.hidden = ui.completionMode.value === 'single';
  }

  function makeText(className, text) {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function renderDays() {
    const today = stockholmDate();
    ui.progressCount.textContent = `${challenges.size} av 31 dagar har pass`;

    const cards = OCTOBER_DATES.map((date) => {
      const challenge = challenges.get(date);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `day-card ${challenge ? 'saved' : 'missing'}`;
      if (date === selectedDate) card.classList.add('active');
      if (date === today) card.classList.add('today');
      card.dataset.date = date;
      card.setAttribute('aria-pressed', String(date === selectedDate));
      card.setAttribute('aria-label', `${formatDate(date, true)}: ${challenge ? challenge.title : 'pass saknas'}`);

      const top = document.createElement('span');
      top.className = 'day-top';
      top.append(makeText('day-date', `${formatDate(date)}${date === today ? ' · idag' : ''}`));
      top.append(makeText('day-status', challenge ? 'Sparat' : 'Saknas'));
      card.append(top);
      card.append(makeText('day-title', challenge?.title || 'Inget pass ännu'));
      card.append(makeText('day-description', challengeDescription(challenge)));

      const meta = document.createElement('span');
      meta.className = 'day-meta';
      meta.append(makeText('', `Del 1: ${challenge?.base_amount ?? '—'} ${challenge?.unit || ''}`.trim()));
      if (challenge?.completion_mode && challenge.completion_mode !== 'single') {
        meta.append(makeText('', `Del 2: ${challenge.second_base_amount ?? '—'} ${challenge.second_unit || ''}`.trim()));
        meta.append(makeText('', challenge.completion_mode === 'and' ? 'Båda krävs' : 'Valfri del'));
      }
      card.append(meta);
      card.addEventListener('click', () => selectDate(date, true));
      return card;
    });

    ui.days.replaceChildren(...cards);
  }

  function loadSelectedChallenge() {
    const challenge = challenges.get(selectedDate);
    ui.date.value = selectedDate;
    clearFields();
    ui.formStatus.textContent = '';
    ui.editorTitle.textContent = `Redigera ${formatDate(selectedDate)}`;

    if (challenge) {
      ui.title.value = challenge.title;
      ui.description.value = challenge.description || '';
      ui.amount.value = challenge.base_amount ?? '';
      ui.unit.value = challenge.unit || '';
      ui.completionMode.value = challenge.completion_mode || 'single';
      ui.secondDescription.value = challenge.second_description || '';
      ui.secondAmount.value = challenge.second_base_amount ?? '';
      ui.secondUnit.value = challenge.second_unit || '';
      ui.bonusDescription.value = challenge.bonus_description || '';
      ui.bonusPoints.value = challenge.bonus_points ?? '1';
      updateModeFields();
      ui.existingStatus.textContent = 'Sparat pass. Ändra fälten och spara för att uppdatera.';
    } else {
      updateModeFields();
      ui.existingStatus.textContent = 'Den här dagen saknar pass. Fyll i fälten för att skapa ett.';
    }

    if (selectedDate >= '2026-10-05' && selectedDate <= '2026-10-11') {
      if (!challenge) ui.title.value = 'Dagens bingo';
      ui.existingStatus.textContent = 'Bingovecka. Fyll i dagens bonus nedan; bingobrickan hanterar dagens aktivitet.';
    }
    const index = OCTOBER_DATES.indexOf(selectedDate);
    ui.previousDay.disabled = index <= 0;
    ui.nextDay.disabled = index >= OCTOBER_DATES.length - 1;
  }

  function selectDate(date, scrollToEditor = false) {
    if (!OCTOBER_DATES.includes(date)) return;
    selectedDate = date;
    renderDays();
    loadSelectedChallenge();

    if (scrollToEditor && window.matchMedia('(max-width: 860px)').matches) {
      ui.editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function loadOctoberChallenges() {
    ui.days.textContent = 'Laddar oktober…';
    const { data, error } = await client
      .from('daily_challenges')
      .select('challenge_date, title, description, unit, base_amount, completion_mode, second_description, second_base_amount, second_unit, bonus_description, bonus_points')
      .gte('challenge_date', OCTOBER_START)
      .lte('challenge_date', OCTOBER_END)
      .order('challenge_date');

    if (error) {
      console.error('Oktoberpassen kunde inte laddas', error);
      ui.days.textContent = 'Oktoberpassen kunde inte laddas.';
      ui.existingStatus.textContent = 'Försök ladda om sidan.';
      return;
    }

    challenges = new Map((data || []).map((challenge) => [challenge.challenge_date, challenge]));
    const today = stockholmDate();
    const firstMissing = OCTOBER_DATES.find((date) => !challenges.has(date));
    selectedDate = OCTOBER_DATES.includes(today) ? today : (firstMissing || OCTOBER_START);
    renderDays();
    loadSelectedChallenge();
  }

  async function handleSession(session) {
    if (!session && activeSession?.user?.id) {
      window.SoberOctoberEliminations?.resetOnLogout(activeSession.user.id);
    }
    activeSession = session;
    ui.loginStatus.textContent = '';

    if (!session) {
      window.SoberOctoberAdminCorrections?.reset();
      showState(ui.signedOut);
      return;
    }

    const { data: profile, error } = await client
      .from('profiles')
      .select('display_name, is_admin')
      .eq('id', session.user.id)
      .single();

    if (error || !profile?.is_admin) {
      window.SoberOctoberAdminCorrections?.reset();
      showState(ui.denied);
      return;
    }

    await window.SoberOctoberEliminations?.refresh(client, session.user.id, profile.display_name);

    ui.identity.textContent = `Inloggad som ${profile.display_name || session.user.email || 'admin'}`;
    showState(ui.admin);
    await Promise.all([loadOctoberChallenges(), loadCompetitionParticipants()]);
  }

  ui.googleLogin.addEventListener('click', async () => {
    ui.loginStatus.textContent = '';
    ui.googleLogin.disabled = true;
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/admin/', window.location.origin).href },
    });

    if (error) {
      ui.loginStatus.textContent = 'Google-inloggningen kunde inte startas.';
      ui.googleLogin.disabled = false;
    }
  });

  ui.date.addEventListener('change', () => {
    if (!OCTOBER_DATES.includes(ui.date.value)) {
      ui.date.value = selectedDate;
      ui.formStatus.textContent = 'Välj ett datum i oktober 2026.';
      return;
    }
    selectDate(ui.date.value);
  });
  ui.completionMode.addEventListener('change', updateModeFields);

  ui.previousDay.addEventListener('click', () => {
    const index = OCTOBER_DATES.indexOf(selectedDate);
    if (index > 0) selectDate(OCTOBER_DATES[index - 1]);
  });

  ui.nextDay.addEventListener('click', () => {
    const index = OCTOBER_DATES.indexOf(selectedDate);
    if (index < OCTOBER_DATES.length - 1) selectDate(OCTOBER_DATES[index + 1]);
  });

  ui.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = ui.title.value.trim();
    const amount = ui.amount.value ? Number(ui.amount.value) : null;
    const unit = ui.unit.value.trim();
    const completionMode = ui.completionMode.value;
    const secondDescription = ui.secondDescription.value.trim();
    const secondAmount = ui.secondAmount.value ? Number(ui.secondAmount.value) : null;
    const secondUnit = ui.secondUnit.value.trim();
    const bonusDescription = ui.bonusDescription.value.trim();
    const bonusPoints = bonusDescription && ui.bonusPoints.value ? Number(ui.bonusPoints.value) : null;

    if (!OCTOBER_DATES.includes(ui.date.value)) {
      ui.formStatus.textContent = 'Välj ett datum i oktober 2026.';
      return;
    }

    const validAmount = (value) => value !== null && Number.isInteger(value) && value >= 1 && value <= 100000;
    const invalidFirst = amount !== null && !validAmount(amount);
    const invalidSecond = completionMode !== 'single'
      && (!validAmount(amount) || !unit || !validAmount(secondAmount) || !secondUnit);
    const invalidBonus = Boolean(bonusDescription) !== (bonusPoints !== null)
      || (bonusPoints !== null && (!Number.isInteger(bonusPoints) || bonusPoints < 1 || bonusPoints > 100));
    if (!title || invalidFirst || invalidSecond || invalidBonus) {
      ui.formStatus.textContent = invalidBonus
        ? 'Fyll i både bonusuppgift och ett heltal mellan 1 och 100 bonuspoäng.'
        : invalidSecond
          ? 'För pass med två delar krävs grundmängd och enhet för båda delarna.'
          : 'Kontrollera passnamn och grundmängd.';
      return;
    }

    setBusy(true);
    ui.formStatus.textContent = 'Sparar passet…';
    const { data, error } = await client
      .from('daily_challenges')
      .upsert({
        challenge_date: ui.date.value,
        title,
        description: ui.description.value.trim() || null,
        unit: unit || null,
        base_amount: amount,
        completion_mode: completionMode,
        second_description: completionMode === 'single' ? null : (secondDescription || null),
        second_base_amount: completionMode === 'single' ? null : secondAmount,
        second_unit: completionMode === 'single' ? null : secondUnit,
        bonus_description: bonusDescription || null,
        bonus_points: bonusDescription ? bonusPoints : null,
      }, { onConflict: 'challenge_date' })
      .select('challenge_date, title, description, unit, base_amount, completion_mode, second_description, second_base_amount, second_unit, bonus_description, bonus_points')
      .single();
    setBusy(false);

    if (error) {
      console.error('Kunde inte spara passet', error);
      ui.formStatus.textContent = 'Passet kunde inte sparas.';
      return;
    }

    challenges.set(data.challenge_date, data);
    selectedDate = data.challenge_date;
    renderDays();
    ui.editorTitle.textContent = `Redigera ${formatDate(selectedDate)}`;
    ui.existingStatus.textContent = 'Sparat pass. Ändra fälten och spara för att uppdatera.';
    ui.formStatus.textContent = 'Passet är sparat.';
  });

  ui.refreshParticipants.addEventListener('click', loadCompetitionParticipants);
  ui.cancelParticipantAction.addEventListener('click', () => {
    participantAction = null;
    ui.participantConfirmation.close();
  });
  ui.confirmParticipantAction.addEventListener('click', applyParticipantAction);

  async function signOut() {
    const previousUserId = activeSession?.user?.id;
    await client.auth.signOut();
    window.SoberOctoberEliminations?.resetOnLogout(previousUserId);
    activeSession = null;
    challenges = new Map();
    showState(ui.signedOut);
  }

  ui.deniedSignOut.addEventListener('click', signOut);
  ui.adminSignOut.addEventListener('click', signOut);

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
          .catch((sessionError) => console.error('Auth-status kunde inte uppdateras', sessionError));
      });
    } catch (error) {
      console.error('Admin kunde inte startas', error);
      ui.loading.querySelector('h2').textContent = 'Admin kunde inte laddas.';
    }
  }

  init();
})();

