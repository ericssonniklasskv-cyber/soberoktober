((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoberRouletteLive = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const START = '2026-10-12', END = '2026-10-18';
  const START_INSTANT = Date.parse('2026-10-12T00:01:00+02:00');
  // Monday after the theme is available only for finishing Sunday's saved round.
  const END_INSTANT = Date.parse('2026-10-20T00:00:00+02:00');
  const isDate = date => date >= START && date <= END;
  const active = (now = Date.now()) => now >= START_INSTANT && now < END_INSTANT;
  const mergeResults = (results, scores) => results.filter(result => !isDate(result.result_date))
    .concat(scores.map(score => ({ ...score, kind: 'roulette', multiplier: null })));
  return Object.freeze({ START, END, START_INSTANT, END_INSTANT, isDate, active, replacesToday: isDate, mergeResults });
});
