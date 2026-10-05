const test = require('node:test');
const assert = require('node:assert/strict');
const { setClaim } = require('./bonus-client.js');

test('claim preserves existing workout and leaves point calculation to the server', async () => {
  const result = { multiplier: 2, points: 1.5, completed_parts: ['first'], updated_at: 'saved' };
  const calls = [];
  const client = { rpc: async (name, args) => {
    calls.push({ name, args });
    return args.p_action === 'save' ? { data: { result, bonus_points: 1 } } : { data: { result, bonus_points: null } };
  }};
  assert.equal((await setClaim(client, '2026-10-05', true, null)).bonus_points, 1);
  assert.deepEqual(calls[1].args.p_payload, { expected: result, multiplier: null, claim_bonus: true, unclaim_bonus: false, expected_bonus_points: null });
  assert.equal(calls[1].name, 'self_daily_result');
});

test('undo requests removal of the existing bonus only', async () => {
  let payload;
  const client = { rpc: async (_name, args) => {
    if (args.p_action === 'save') { payload = args.p_payload; return { data: { result: null, bonus_points: null } }; }
    return { data: { result: null, bonus_points: 1 } };
  }};
  await setClaim(client, '2026-10-05', false, 1);
  assert.equal(payload.unclaim_bonus, true);
  assert.equal(payload.claim_bonus, false);
  assert.equal(payload.multiplier, null);
  assert.equal(payload.expected_bonus_points, 1);
});

test('a changed claim or failed read cannot silently overwrite another view', async () => {
  let writes = 0;
  const client = { rpc: async (_name, args) => {
    if (args.p_action === 'save') writes++;
    return { data: { result: null, bonus_points: 1 } };
  }};
  await assert.rejects(setClaim(client, '2026-10-05', true, null), { code: '40001' });
  assert.equal(writes, 0);
  await assert.rejects(setClaim({ rpc: async () => ({ error: { code: '42501' } }) }, '2026-10-05', true, null), { code: '42501' });
});
