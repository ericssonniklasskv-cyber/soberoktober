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
    `"My IQ is one of the highest — and you all know it! Please don't feel so stupid or insecure; it's not your fault."`,
    `"God created Trump, and then he said, 'I think I'll do a good job.'"`,
    `"My fingers are long and beautiful, as, it has been well documented, are various other parts of my body."`,
    `"I could stand in the middle of Fifth Avenue and shoot somebody, and I wouldn’t lose any voters."`,
    `"It’s freezing and snowing in New York — we need global warming!"`,
    `"When you’re a star, they let you do it. You can do anything."`,
    `"We will have so much winning if I get elected that you may get bored with winning."`,
    `"I’m the king of debt. I love debt."`,
    `"I think that I’m a very nice person."`,
  ];
  const storageKey = 'soberoktober-trump-quote-seen-date';
  const modalQuote = document.querySelector('#trump-quote-modal-text');
  const overlay = document.querySelector('#trump-quote-overlay');
  const trigger = document.querySelector('#auth-trigger');
  const authOverlay = document.querySelector('#auth-overlay');
  const appShell = document.querySelector('#app-shell');
  const closeButtons = [...overlay.querySelectorAll('[data-trump-quote-close]')];
  let activeDay = '';
  let seenDay = '';

  function stockholmDay(date = new Date()) {
    const key = window.SoberOctoberCalendar.stockholmDate(date);
    return { key, number: window.SoberOctoberCalendar.dayNumber(key) };
  }

  function refreshQuote() {
    const today = stockholmDay();
    if (today.key !== activeDay) {
      activeDay = today.key;
      const firstOctoberDay = window.SoberOctoberCalendar.dayNumber(window.SoberOctoberCalendar.OCTOBER_START);
      const index = ((today.number - firstOctoberDay) % quotes.length + quotes.length) % quotes.length;
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

  function showQuote() {
    const day = refreshQuote();
    remember(day);
    overlay.hidden = false;
    document.body.classList.add('trump-quote-open');
    closeButtons[0].focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove('trump-quote-open');
  }

  closeButtons.forEach((button) => button.addEventListener('click', close));
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  const notice = window.SoberOctoberPopups.register('quote', {
    priority: window.SoberOctoberPopups.priorities.quote,
    element: overlay,
    isOpen: () => !overlay.hidden,
    canShow: () => mainIsReady() && overlay.hidden && !alreadySeen(refreshQuote()),
    show: showQuote,
    suspend: close,
  });
  notice.request();
})();
