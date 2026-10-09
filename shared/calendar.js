(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberOctoberCalendar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TIME_ZONE = 'Europe/Stockholm';
  const YEAR = 2026;
  const OCTOBER_START = `${YEAR}-10-01`;
  const OCTOBER_END = `${YEAR}-10-31`;
  const OCTOBER_DATES = Object.freeze(Array.from({ length: 31 }, (_, i) => `${YEAR}-10-${String(i + 1).padStart(2, '0')}`));
  const PERIODS = Object.freeze([
    Object.freeze({ key: 'oct_01_07', title: 'Vecka 1', label: '1–7 oktober', start: OCTOBER_START, end: `${YEAR}-10-07`, days: 7 }),
    Object.freeze({ key: 'oct_08_14', title: 'Vecka 2', label: '8–14 oktober', start: `${YEAR}-10-08`, end: `${YEAR}-10-14`, days: 7 }),
    Object.freeze({ key: 'oct_15_21', title: 'Vecka 3', label: '15–21 oktober', start: `${YEAR}-10-15`, end: `${YEAR}-10-21`, days: 7 }),
    Object.freeze({ key: 'oct_22_31', title: 'Slutspurten', label: '22–31 oktober', start: `${YEAR}-10-22`, end: OCTOBER_END, days: 10 }),
  ]);
  const BINGO_START = `${YEAR}-10-05`;
  const BINGO_END = `${YEAR}-10-11`;
  const OCTOBER_START_AT = Date.parse(`${OCTOBER_START}T00:00:00+02:00`);
  const BINGO_START_AT = Date.parse(`${BINGO_START}T00:01:00+02:00`);
  const BINGO_END_AT = Date.parse(`${YEAR}-10-12T00:00:00+02:00`);
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

  function stockholmDate(value = new Date()) {
    if (value == null) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = Object.fromEntries(formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function shiftDate(date, amount) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  }

  const dayNumber = date => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const isCompetitionDay = date => date >= OCTOBER_START && date <= OCTOBER_END;
  return Object.freeze({ TIME_ZONE, YEAR, OCTOBER_START, OCTOBER_END, OCTOBER_DATES, PERIODS,
    BINGO_START, BINGO_END, OCTOBER_START_AT, BINGO_START_AT, BINGO_END_AT,
    stockholmDate, shiftDate, dayNumber, isCompetitionDay });
});
