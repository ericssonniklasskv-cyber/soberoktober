(() => {
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
    existingStatus: document.querySelector('#existing-status'),
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

  async function loadChallenge() {
    ui.formStatus.textContent = '';
    clearFields();

    const { data, error } = await client
      .from('daily_challenges')
      .select('challenge_date, title, description, unit, base_amount')
      .eq('challenge_date', ui.date.value)
      .maybeSingle();

    if (error) {
      ui.existingStatus.textContent = 'Passet kunde inte laddas.';
      return;
    }

    if (!data) {
      ui.existingStatus.textContent = 'Inget pass finns för datumet ännu.';
      return;
    }

    ui.title.value = data.title;
    ui.description.value = data.description || '';
    ui.amount.value = data.base_amount || '';
    ui.unit.value = data.unit || '';
    ui.existingStatus.textContent = 'Ett befintligt pass är laddat. Spara för att uppdatera det.';
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
    if (!ui.date.value) ui.date.value = stockholmDate();
    await loadChallenge();
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

  ui.date.addEventListener('change', loadChallenge);

  ui.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = ui.title.value.trim();
    const amount = ui.amount.value ? Number(ui.amount.value) : null;

    if (!title || (amount !== null && (!Number.isInteger(amount) || amount < 1))) {
      ui.formStatus.textContent = 'Kontrollera namn och grundmängd.';
      return;
    }

    setBusy(true);
    ui.formStatus.textContent = 'Sparar passet…';
    const { error } = await client
      .from('daily_challenges')
      .upsert({
        challenge_date: ui.date.value,
        title,
        description: ui.description.value.trim() || null,
        unit: ui.unit.value.trim() || null,
        base_amount: amount,
      }, { onConflict: 'challenge_date' });
    setBusy(false);

    if (error) {
      console.error('Kunde inte spara passet', error);
      ui.formStatus.textContent = 'Passet kunde inte sparas.';
      return;
    }

    ui.formStatus.textContent = 'Passet är sparat.';
    ui.existingStatus.textContent = 'Ett befintligt pass är laddat. Spara för att uppdatera det.';
  });

  async function signOut() {
    await client.auth.signOut();
    activeSession = null;
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
