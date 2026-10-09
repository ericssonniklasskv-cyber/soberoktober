(function (root, factory) {
  const calendar = root?.SoberOctoberCalendar || (typeof require === 'function' ? require('./shared/calendar.js') : null);
  const api = factory(calendar);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SoberOctoberCountdown = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function (calendar) {
  const { OCTOBER_START_AT } = calendar;

  function getCountdownState(nowMs = Date.now()) {
    const remainingMs = Math.max(0, OCTOBER_START_AT - nowMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    return {
      complete: nowMs >= OCTOBER_START_AT,
      hours: Math.floor(remainingSeconds / 3600),
      minutes: Math.floor((remainingSeconds % 3600) / 60),
      seconds: remainingSeconds % 60,
    };
  }

  return { OCTOBER_START_AT, getCountdownState };
});