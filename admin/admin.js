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
  };

  let client;
  let activeSession;
  let sessionWork = Promise.resolve();
  let selectedDate = OCTOBER_START;
  let challenges = new Map();

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
  }

  async function handleSession(session) {
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

    ui.identity.textContent = `Inloggad som ${profile.display_name || session.user.email || 'admin'}`;
    showState(ui.admin);
    await loadOctoberChallenges();
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
    ui.editorTitle.textContent = `Redigera ${formatDate(selectedDate)}`;
    ui.existingStatus.textContent = 'Sparat pass. Ändra fälten och spara för att uppdatera.';
    ui.formStatus.textContent = 'Passet är sparat.';
  });

  async function signOut() {
    await client.auth.signOut();
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

      client.auth.onAuthStateChange((_event, session) => {
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
