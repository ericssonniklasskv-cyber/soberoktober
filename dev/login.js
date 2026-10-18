(async () => {
  const status = document.querySelector('#status');
  const buttons = [...document.querySelectorAll('[data-email]')];
  try {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol !== 'http:') throw new Error('Testsidan fungerar bara lokalt.');
    const response = await fetch('/api/config', { redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error('Den lokala API-konfigurationen kunde inte läsas.');
    const config = await response.json();
    const url = new URL(config.supabaseUrl);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.port !== '54321' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Supabase är inte lokal. Inloggningen stoppas.');
    if (!window.supabase) throw new Error('Inloggningsbiblioteket kunde inte laddas.');
    const client = window.supabase.createClient(url.origin, config.supabasePublishableKey);
    status.textContent = 'Lokal Supabase bekräftad. Välj ett konto.';
    buttons.forEach(button => {
      button.disabled = false;
      button.addEventListener('click', async () => {
        buttons.forEach(b => b.disabled = true);
        status.textContent = 'Loggar in…';
        try {
          const { error } = await client.auth.signInWithPassword({ email: button.dataset.email, password: 'SoberLocal-2026!' });
          if (error) throw error;
          location.assign('/');
        } catch (error) {
          status.textContent = `Inloggningen misslyckades: ${error.message}. Kör npm run seed:local först.`;
          buttons.forEach(b => b.disabled = false);
        }
      });
    });
  } catch (error) { status.textContent = error.message; }
})();
