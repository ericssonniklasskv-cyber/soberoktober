(() => {
  const quotes = [
    `"If Hillary Clinton can't satisfy her husband what makes her think she can satisfy America?"`,
    `"If you look at Saddam Hussein, he killed terrorists. I'm not saying he was an angel, but this guy killed terrorists."`,
    `"The concept of global warming was created by and for the Chinese in order to make U.S. manufacturing non-competitive."`,
    `"I look very much forward to showing my financials, because they are huge."`,
    `"All of the women on *The Apprentice* flirted with me - consciously or unconsciously. That's to be expected."`,
    `"She does have a very nice figure... If [Ivanka] weren't my daughter, perhaps I'd be dating her."`,
    `"I could stand in the middle of 5th Avenue and shoot somebody and I wouldn't lose voters."`,
    `"Nobody knew health care could be so complicated."`,
    `"I’m the least racist person you have ever interviewed."`,
  ];
  const storageKey = 'soberoktober-trump-quote-seen-date';
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const sectionQuote = document.querySelector('#trump-quote-text');
  const modalQuote = document.querySelector('#trump-quote-modal-text');
  const overlay = document.querySelector('#trump-quote-overlay');
  const trigger = document.querySelector('#auth-trigger');
  const authOverlay = document.querySelector('#auth-overlay');
  const appShell = document.querySelector('#app-shell');
  const closeButtons = [...overlay.querySelectorAll('[data-trump-quote-close]')];
  let activeDay = '';
  let seenDay = '';
  let previousFocus = null;

  function stockholmDay(date = new Date()) {
    const parts = Object.fromEntries(dayFormatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]));
    return {
      key: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
      number: Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000),
    };
  }

  function refreshQuote() {
    const today = stockholmDay();
    if (today.key !== activeDay) {
      activeDay = today.key;
      const firstOctoberDay = Math.floor(Date.UTC(2026, 9, 1) / 86400000);
      const index = ((today.number - firstOctoberDay) % quotes.length + quotes.length) % quotes.length;
      sectionQuote.textContent = quotes[index];
      modalQuote.textContent = quotes[index];
    }
    return today.key;
  }

  function alreadySeen(day) {
    if (seenDay === day) return true;
    try { return window.localStorage.getItem(storageKey) === day; }
    catch { return false; }
  }

  function remember(day) {
    seenDay = day;
    try { window.localStorage.setItem(storageKey, day); }
    catch { /* The current tab still remembers this visit if storage is disabled. */ }
  }

  function mainIsReady() {
    return !document.body.classList.contains('entry-active')
      && !appShell.inert
      && !authOverlay.classList.contains('open')
      && trigger.textContent.trim().startsWith('Hej, ');
  }

  function maybeOpen() {
    const day = refreshQuote();
    if (!mainIsReady() || !overlay.hidden || alreadySeen(day)) return;
    previousFocus = document.activeElement;
    remember(day);
    overlay.hidden = false;
    document.body.classList.add('trump-quote-open');
    closeButtons[0].focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove('trump-quote-open');
    if (previousFocus?.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus();
    else trigger.focus();
  }

  closeButtons.forEach((button) => button.addEventListener('click', close));
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const target = event.shiftKey ? closeButtons[0] : closeButtons[closeButtons.length - 1];
      if (document.activeElement === target) {
        event.preventDefault();
        (event.shiftKey ? closeButtons[closeButtons.length - 1] : closeButtons[0]).focus();
      }
    }
  });

  const observer = new MutationObserver(maybeOpen);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  observer.observe(appShell, { attributes: true, attributeFilter: ['inert'] });
  observer.observe(authOverlay, { attributes: true, attributeFilter: ['class'] });
  observer.observe(trigger, { childList: true, characterData: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeOpen(); });
  window.addEventListener('focus', maybeOpen);
  window.setInterval(maybeOpen, 60000);
  maybeOpen();
})();
