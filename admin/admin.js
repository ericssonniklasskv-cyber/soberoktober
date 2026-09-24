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
    formStatus: document.querySelector('#form-status'),
    bulkSection: document.querySelector('#bulk-section'),
    bulkRows: document.querySelector('#bulk-rows'),
    bulkDirtyCount: document.querySelector('#bulk-dirty-count'),
    bulkSave: document.querySelector('#bulk-save'),
    bulkStatus: document.querySelector('#bulk-status'),
    deleteConfirmation: document.querySelector('#delete-confirmation'),
    deleteList: document.querySelector('#delete-list'),
    cancelDelete: document.querySelector('#cancel-delete'),
    confirmDelete: document.querySelector('#confirm-delete'),
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
  let bulkOriginals = new Map();
  let bulkDrafts = new Map();
  let bulkSaving = false;
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
    ui.form.querySelectorAll('button, input, textarea').forEach((control) => {
      control.disabled = busy;
    });
  }

  function clearFields() {
    ui.title.value = '';
    ui.description.value = '';
    ui.amount.value = '';
    ui.unit.value = '';
  }

  function makeText(className, text) {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function normalizeRow(challenge = {}) {
    return {
      title: String(challenge.title ?? '').trim(),
      description: String(challenge.description ?? '').trim(),
      base_amount: challenge.base_amount === null || challenge.base_amount === undefined
        ? ''
        : String(challenge.base_amount).trim(),
      unit: String(challenge.unit ?? '').trim(),
    };
  }

  function isEmptyRow(row) {
    return !row.title && !row.description && !row.base_amount && !row.unit;
  }

  function rowsEqual(first, second) {
    return ['title', 'description', 'base_amount', 'unit'].every((field) => first[field] === second[field]);
  }

  function getBulkChanges() {
    return OCTOBER_DATES.map((date) => ({
      date,
      original: normalizeRow(bulkOriginals.get(date)),
      draft: normalizeRow(bulkDrafts.get(date)),
    })).filter(({ original, draft }) => !rowsEqual(original, draft));
  }

  function updateBulkState() {
    const changedDates = new Set(getBulkChanges().map(({ date }) => date));
    ui.bulkRows.querySelectorAll('tr[data-date]').forEach((row) => {
      row.classList.toggle('dirty', changedDates.has(row.dataset.date));
      if (!changedDates.has(row.dataset.date)) row.classList.remove('invalid', 'save-error');
    });

    const count = changedDates.size;
    ui.bulkDirtyCount.textContent = count
      ? `${count} ${count === 1 ? 'osparad ändring' : 'osparade ändringar'}`
      : 'Inga osparade ändringar';
    ui.bulkDirtyCount.classList.toggle('has-changes', count > 0);
    ui.bulkSave.disabled = count === 0 || bulkSaving;
  }

  function createBulkInput(date, field, value, options = {}) {
    const input = document.createElement('input');
    input.type = options.type || 'text';
    input.value = value;
    input.placeholder = options.placeholder || '';
    input.dataset.field = field;
    input.setAttribute('aria-label', `${options.label} för ${formatDate(date, true)}`);
    if (options.maxLength) input.maxLength = options.maxLength;
    if (options.type === 'number') {
      input.min = '1';
      input.max = '100000';
      input.step = '1';
      input.inputMode = 'numeric';
    }
    input.addEventListener('input', () => {
      const draft = { ...bulkDrafts.get(date), [field]: input.value };
      bulkDrafts.set(date, draft);
      ui.bulkStatus.textContent = '';
      input.closest('tr').classList.remove('invalid', 'save-error');
      updateBulkState();
    });
    return input;
  }

  function renderBulkEditor(errorDates = new Set()) {
    const rows = OCTOBER_DATES.map((date) => {
      const draft = bulkDrafts.get(date) || normalizeRow();
      const row = document.createElement('tr');
      row.dataset.date = date;
      if (errorDates.has(date)) row.classList.add('save-error');

      const dateCell = document.createElement('td');
      dateCell.dataset.label = 'Datum';
      dateCell.append(makeText('bulk-date', formatDate(date)));
      row.append(dateCell);

      const fields = [
        ['title', 'Passnamn', { label: 'Passnamn', placeholder: 'Squats', maxLength: 80 }],
        ['description', 'Beskrivning', { label: 'Beskrivning', placeholder: '15 squats', maxLength: 240 }],
        ['base_amount', 'Grundmängd', { label: 'Grundmängd', placeholder: '15', type: 'number' }],
        ['unit', 'Enhet', { label: 'Enhet', placeholder: 'squats', maxLength: 32 }],
      ];

      fields.forEach(([field, label, options]) => {
        const cell = document.createElement('td');
        cell.dataset.label = label;
        cell.append(createBulkInput(date, field, draft[field], options));
        row.append(cell);
      });
      return row;
    });

    ui.bulkRows.replaceChildren(...rows);
    updateBulkState();
  }

  function resetBulkDrafts() {
    bulkOriginals = new Map();
    bulkDrafts = new Map();
    OCTOBER_DATES.forEach((date) => {
      const row = normalizeRow(challenges.get(date));
      bulkOriginals.set(date, row);
      bulkDrafts.set(date, { ...row });
    });
    renderBulkEditor();
  }

  function syncBulkChallenge(challenge) {
    const date = challenge.challenge_date;
    const previousOriginal = normalizeRow(bulkOriginals.get(date));
    const currentDraft = normalizeRow(bulkDrafts.get(date));
    const draftWasDirty = !rowsEqual(previousOriginal, currentDraft);
    const nextOriginal = normalizeRow(challenge);
    bulkOriginals.set(date, nextOriginal);
    if (!draftWasDirty) bulkDrafts.set(date, { ...nextOriginal });
    renderBulkEditor();
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
      card.append(makeText('day-description', challenge?.description || 'Ingen beskrivning'));

      const meta = document.createElement('span');
      meta.className = 'day-meta';
      meta.append(makeText('', `Grundmängd: ${challenge?.base_amount ?? '—'}`));
      meta.append(makeText('', `Enhet: ${challenge?.unit || '—'}`));
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
      ui.existingStatus.textContent = 'Sparat pass. Ändra fälten och spara för att uppdatera.';
    } else {
      ui.existingStatus.textContent = 'Den här dagen saknar pass. Fyll i fälten för att skapa ett.';
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
      .select('challenge_date, title, description, unit, base_amount')
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
    resetBulkDrafts();
  }

  async function handleSession(session) {
    if (!session && activeSession?.user?.id) {
      window.SoberOctoberEliminations?.resetOnLogout(activeSession.user.id);
    }
    activeSession = session;
    ui.loginStatus.textContent = '';

    if (!session) {
      showState(ui.signedOut);
      return;
    }

    const { data: profile, error } = await client
      .from('profiles')
      .select('display_name, is_admin')
      .eq('id', session.user.id)
      .single();

    if (error || !profile?.is_admin) {
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

    if (!OCTOBER_DATES.includes(ui.date.value)) {
      ui.formStatus.textContent = 'Välj ett datum i oktober 2026.';
      return;
    }

    if (!title || (amount !== null && (!Number.isInteger(amount) || amount < 1))) {
      ui.formStatus.textContent = 'Kontrollera namn och grundmängd.';
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
        unit: ui.unit.value.trim() || null,
        base_amount: amount,
      }, { onConflict: 'challenge_date' })
      .select('challenge_date, title, description, unit, base_amount')
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
    syncBulkChallenge(data);
    ui.editorTitle.textContent = `Redigera ${formatDate(selectedDate)}`;
    ui.existingStatus.textContent = 'Sparat pass. Ändra fälten och spara för att uppdatera.';
    ui.formStatus.textContent = 'Passet är sparat.';
  });

  function validateBulkChanges(changes) {
    const invalidDates = new Set();
    changes.forEach(({ date, draft }) => {
      if (isEmptyRow(draft)) return;
      const amount = draft.base_amount ? Number(draft.base_amount) : null;
      const validAmount = amount === null || (Number.isInteger(amount) && amount >= 1 && amount <= 100000);
      if (!draft.title || !validAmount) invalidDates.add(date);
    });
    return invalidDates;
  }

  function showDeleteConfirmation(deletions) {
    ui.deleteList.replaceChildren(...deletions.map(({ date, original }) => {
      const item = document.createElement('li');
      item.textContent = `${formatDate(date)} — ${original.title}`;
      return item;
    }));
    ui.deleteConfirmation.showModal();
  }

  async function saveBulkChanges(allowDeletes = false) {
    if (bulkSaving) return;
    const changes = getBulkChanges();
    if (!changes.length) {
      ui.bulkStatus.textContent = 'Det finns inga ändringar att spara.';
      return;
    }

    const invalidDates = validateBulkChanges(changes);
    if (invalidDates.size) {
      invalidDates.forEach((date) => ui.bulkRows.querySelector(`tr[data-date="${date}"]`)?.classList.add('invalid'));
      ui.bulkStatus.textContent = `Kontrollera ${[...invalidDates].map((date) => formatDate(date)).join(', ')}. Passnamn krävs och grundmängd ska vara ett heltal mellan 1 och 100 000.`;
      return;
    }

    const deletions = changes.filter(({ original, draft }) => !isEmptyRow(original) && isEmptyRow(draft));
    if (deletions.length && !allowDeletes) {
      showDeleteConfirmation(deletions);
      return;
    }

    bulkSaving = true;
    ui.bulkSection.classList.add('busy');
    ui.bulkSave.disabled = true;
    ui.bulkStatus.textContent = `Sparar ${changes.length} ${changes.length === 1 ? 'dag' : 'dagar'}…`;

    const results = await Promise.allSettled(changes.map(async ({ date, draft }) => {
      if (isEmptyRow(draft)) {
        const { error } = await client.from('daily_challenges').delete().eq('challenge_date', date);
        if (error) throw error;
        return { date, challenge: null };
      }

      const { data, error } = await client
        .from('daily_challenges')
        .upsert({
          challenge_date: date,
          title: draft.title,
          description: draft.description || null,
          base_amount: draft.base_amount ? Number(draft.base_amount) : null,
          unit: draft.unit || null,
        }, { onConflict: 'challenge_date' })
        .select('challenge_date, title, description, unit, base_amount')
        .single();
      if (error) throw error;
      return { date, challenge: data };
    }));

    const failedDates = new Set();
    const savedDates = [];
    results.forEach((result, index) => {
      const date = changes[index].date;
      if (result.status === 'rejected') {
        console.error(`Kunde inte spara ${date}`, result.reason);
        failedDates.add(date);
        return;
      }

      const { challenge } = result.value;
      if (challenge) challenges.set(date, challenge);
      else challenges.delete(date);
      const savedRow = normalizeRow(challenge || {});
      bulkOriginals.set(date, savedRow);
      bulkDrafts.set(date, { ...savedRow });
      savedDates.push(date);
    });

    bulkSaving = false;
    ui.bulkSection.classList.remove('busy');
    renderDays();
    renderBulkEditor(failedDates);
    if (savedDates.includes(selectedDate)) loadSelectedChallenge();

    if (failedDates.size) {
      ui.bulkStatus.textContent = `${savedDates.length} ${savedDates.length === 1 ? 'dag uppdaterades' : 'dagar uppdaterades'}. ${failedDates.size} kunde inte sparas: ${[...failedDates].map((date) => formatDate(date)).join(', ')}.`;
    } else {
      ui.bulkStatus.textContent = `${savedDates.length} ${savedDates.length === 1 ? 'dag uppdaterades' : 'dagar uppdaterades'}.`;
    }
  }

  ui.bulkSave.addEventListener('click', () => saveBulkChanges());
  ui.cancelDelete.addEventListener('click', () => ui.deleteConfirmation.close());
  ui.confirmDelete.addEventListener('click', () => {
    ui.deleteConfirmation.close();
    saveBulkChanges(true);
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
    bulkOriginals = new Map();
    bulkDrafts = new Map();
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
