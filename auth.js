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
  };

  let client;
  let session;
  let profile;
  let sessionWork = Promise.resolve();

  const cleanName = (value) => value.trim().replace(/\s+/g, ' ');

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
    ui.trigger.focus();
  }

  function setBusy(element, busy) {
    element.classList.toggle('auth-busy', busy);
    element.querySelectorAll('button, input').forEach((control) => {
      control.disabled = busy;
    });
  }

  function setSignedOut() {
    session = null;
    profile = null;
    ui.trigger.textContent = 'Logga in';
    ui.trigger.title = 'Logga in med Google';
  }

  function setSignedIn(displayName) {
    ui.trigger.textContent = displayName ? `Hej, ${displayName}` : 'Välj namn';
    ui.trigger.title = displayName ? 'Öppna ditt konto' : 'Slutför din profil';
  }

  async function getOrCreateProfile(currentSession) {
    const user = currentSession.user;
    const { data, error } = await client
      .from('profiles')
      .select('id, email, display_name, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: created, error: insertError } = await client
      .from('profiles')
      .insert({ id: user.id, email: user.email })
      .select('id, email, display_name, created_at')
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
      return;
    }

    try {
      profile = await getOrCreateProfile(session);
      setSignedIn(profile.display_name);

      if (!profile.display_name) {
        ui.email.textContent = session.user.email || '';
        openModal(ui.onboardingView);
      } else {
        ui.accountName.textContent = `Hej, ${profile.display_name}!`;
        ui.accountEmail.textContent = session.user.email || '';
      }
    } catch (error) {
      console.error('Kunde inte läsa profilen', error);
      setSignedIn('');
      ui.nameStatus.textContent = 'Profilen kunde inte laddas. Försök igen om en stund.';
      openModal(ui.onboardingView);
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

  ui.close.addEventListener('click', closeModal);
  ui.overlay.addEventListener('click', (event) => {
    if (event.target === ui.overlay) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.overlay.classList.contains('open')) closeModal();
  });

  ui.googleLogin.addEventListener('click', async () => {
    ui.loginStatus.textContent = '';
    setBusy(ui.loginView, true);

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/', window.location.origin).href },
    });

    if (error) {
      ui.loginStatus.textContent = 'Google-inloggningen kunde inte startas. Försök igen.';
      setBusy(ui.loginView, false);
    }
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
      .select('id, email, display_name, created_at')
      .single();

    setBusy(ui.onboardingView, false);

    if (error) {
      ui.nameStatus.textContent = 'Namnet kunde inte sparas. Försök igen.';
      return;
    }

    profile = data;
    setSignedIn(profile.display_name);
    ui.accountName.textContent = `Hej, ${profile.display_name}!`;
    ui.accountEmail.textContent = session.user.email || '';
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

      ui.trigger.disabled = false;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await handleSession(data.session);

      client.auth.onAuthStateChange((_event, nextSession) => {
        sessionWork = sessionWork
          .then(() => handleSession(nextSession))
          .catch((error) => console.error('Auth-status kunde inte uppdateras', error));
      });
    } catch (error) {
      console.error('Supabase Auth kunde inte startas', error);
      ui.trigger.textContent = 'Login saknas';
      ui.trigger.title = 'Auth-konfigurationen kunde inte laddas';
    }
  }

  init();
})();
