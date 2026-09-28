(() => {
  const timers = [...document.querySelectorAll('[data-countdown]')];
  const countdown = window.SoberOctoberCountdown;
  if (!timers.length || !countdown) return;

  const pad = (value) => String(value).padStart(2, '0');

  function renderTimer(timer) {
    const mode = timer.dataset.countdown;
    const state = countdown.getCountdownState(Date.now());
    const isRegistration = mode === 'registration';
    const label = timer.querySelector('[data-countdown-label]');
    const caption = timer.querySelector('[data-countdown-caption]');

    timer.querySelector('[data-countdown-hours]').textContent = String(state.hours);
    timer.querySelector('[data-countdown-minutes]').textContent = pad(state.minutes);
    timer.querySelector('[data-countdown-seconds]').textContent = pad(state.seconds);
    timer.classList.toggle('is-complete', state.complete);

    if (state.complete) {
      label.textContent = isRegistration ? 'Anmälan har stängt' : 'Nu kör vi!';
      caption.textContent = isRegistration
        ? 'Oktoberutmaningen är igång.'
        : 'Dagens pass väntar på dig.';
      timer.setAttribute(
        'aria-label',
        isRegistration ? 'Anmälan har stängt. Oktoberutmaningen är igång.' : 'Oktoberutmaningen har startat. Dagens pass väntar på dig.',
      );
      return;
    }

    label.textContent = isRegistration ? 'Anmälan stänger om' : 'Vi drar igång om';
    caption.textContent = isRegistration ? 'Stänger 1 oktober kl. 00.00' : 'Första passet väntar på dig.';
    const hours = state.hours;
    const minutes = state.minutes;
    const seconds = state.seconds;
    timer.setAttribute(
      'aria-label',
      isRegistration
        ? `Anmälan stänger om ${hours} timmar, ${minutes} minuter och ${seconds} sekunder.`
        : `Oktober startar om ${hours} timmar, ${minutes} minuter och ${seconds} sekunder.`,
    );
  }

  function renderAll() {
    timers.forEach(renderTimer);
  }

  renderAll();
  const interval = window.setInterval(renderAll, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderAll();
  });
  window.addEventListener('pagehide', () => window.clearInterval(interval), { once: true });
})();