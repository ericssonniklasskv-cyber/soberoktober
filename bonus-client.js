(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberOctoberBonus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Reuse the own-result RPC: configured points, ownership and elimination are
  // checked in PostgreSQL. Never send a multiplier or an arbitrary point value.
  async function setClaim(client, date, claim, expectedPoints) {
    const current = await client.rpc('self_daily_result', { p_date: date });
    if (current.error) throw current.error;
    if (current.data.bonus_points !== expectedPoints) {
      throw Object.assign(new Error('Bonusen har ändrats i en annan vy. Uppdatera och försök igen.'), { code: '40001' });
    }
    const saved = await client.rpc('self_daily_result', {
      p_date: date, p_action: 'save',
      p_payload: {
        expected: current.data.result, multiplier: null,
        claim_bonus: claim, unclaim_bonus: !claim,
        expected_bonus_points: expectedPoints,
      },
    });
    if (saved.error) throw saved.error;
    return saved.data;
  }
  return Object.freeze({ setClaim });
});
