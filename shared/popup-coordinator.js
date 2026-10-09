(() => {
  'use strict';
  const sources = new Map();
  const priorities = Object.freeze({ elimination: 100, quote: 80, weeklyReport: 60, kudos: 40 });
  let active = null, timer = null, wakeTimer = null, paused = false;
  const elementOf = source => typeof source.element === 'function' ? source.element() : source.element;
  const isOpen = source => source.isOpen();

  function appBlocked() {
    return document.hidden || paused || document.body.classList.contains('entry-active')
      || document.getElementById('app-shell')?.inert || document.querySelector('#auth-overlay.open');
  }

  function otherModalOpen(except) {
    return [...document.querySelectorAll('dialog[open], #auth-overlay.open, #trump-quote-overlay:not([hidden]), #elimination-overlay:not([hidden])')]
      .some(node => node !== except);
  }

  function restoreFocus(source) {
    const previous = source.previousFocus;
    if (previous?.isConnected && !previous.closest('[hidden], [inert]') && previous.getClientRects().length) previous.focus();
  }

  function run() {
    timer = null;
    if (active && !isOpen(active)) {
      if (!appBlocked() && !otherModalOpen(null)) restoreFocus(active);
      active = null;
    }
    if (appBlocked() || otherModalOpen(active ? elementOf(active) : null)) {
      if (active?.suspend) { active.suspend(); active = null; }
      return;
    }
    if (active) return;
    const candidates = [...sources.values()].sort((a, b) => b.priority - a.priority);
    for (const source of candidates) {
      if (!source.canShow()) continue;
      source.previousFocus = document.activeElement;
      source.show();
      if (isOpen(source)) { active = source; return; }
    }
  }

  function schedule() {
    if (paused || timer !== null) return;
    timer = setTimeout(run, 0);
  }

  const observer = new MutationObserver(schedule);
  const observe = () => observer.observe(document.body, { subtree: true, attributes: true,
    attributeFilter: ['hidden', 'open', 'class', 'inert'] });
  const start = () => { observe(); clearInterval(wakeTimer); wakeTimer = setInterval(schedule, 60000); schedule(); };
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('focus', schedule);
  window.addEventListener('pagehide', () => {
    paused = true; observer.disconnect(); clearTimeout(timer); timer = null; clearInterval(wakeTimer);
  });
  window.addEventListener('pageshow', event => { if (event.persisted) { paused = false; start(); } });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !active) return;
    const box = elementOf(active);
    if (!box || box.tagName === 'DIALOG') return; // Native dialogs already trap focus.
    const targets = [...box.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.closest('[hidden]') && node.getClientRects().length);
    if (!targets.length) return;
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });

  function register(id, options) {
    if (sources.has(id)) throw Error(`Popup already registered: ${id}`);
    const source = { ...options, priority: options.priority ?? 0 };
    sources.set(id, source); schedule();
    return Object.freeze({
      request: schedule,
      dispose() {
        if (active === source) { source.suspend?.(); active = null; }
        sources.delete(id); schedule();
      },
    });
  }
  window.SoberOctoberPopups = Object.freeze({ register, priorities, request: schedule });
  start();
})();
