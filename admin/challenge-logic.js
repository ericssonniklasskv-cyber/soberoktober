((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoberOctoberAdminChallenge = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const bonusOnly = date => date >= '2026-10-05' && date <= '2026-10-31';
  const themeTitle = date => date <= '2026-10-11' ? 'Dagens bingo' : date <= '2026-10-18' ? 'Dagens Spinn The Wheel!' : date <= '2026-10-25' ? 'Dagens val' : 'Frestelsernas rike';
  function bonusPayload(date, description, points, existing) {
    if (!bonusOnly(date)) throw Error('Datumet har ett vanligt dagens pass.');
    const preserved = existing ? Object.fromEntries(['title','description','unit','base_amount','completion_mode','second_description','second_base_amount','second_unit'].map(key => [key, existing[key] ?? null])) : {
      title: themeTitle(date), description: null, unit: null, base_amount: null,
      completion_mode: 'single', second_description: null, second_base_amount: null, second_unit: null
    };
    return { ...preserved, challenge_date: date, bonus_description: description || null, bonus_points: description ? points : null };
  }
  return Object.freeze({ bonusOnly, themeTitle, bonusPayload });
});
