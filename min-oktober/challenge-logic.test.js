const test = require('node:test');
const assert = require('node:assert/strict');
const challenge = require('./challenge-logic.js');

test('legacy challenges and AND challenges count the expected exercise parts', () => {
  const legacy = { challenge_date: '2026-10-01', title: 'Squats', unit: 'squats', base_amount: 15 };
  const andChallenge = {
    challenge_date: '2026-10-02',
    title: 'Mix',
    completion_mode: 'and',
    description: '15 squats',
    unit: 'squats',
    base_amount: 15,
    second_description: '10 pushups',
    second_unit: 'pushups',
    second_base_amount: 10,
  };

  assert.deepEqual(challenge.completedParts({ multiplier: 2 }, legacy), ['first']);
  assert.deepEqual(challenge.completedParts({ completed_parts: ['first', 'second'] }, andChallenge), ['first', 'second']);
  assert.deepEqual(challenge.aggregateExerciseTotals([
    { result_date: '2026-10-01', multiplier: 2 },
    { result_date: '2026-10-02', multiplier: 1, completed_parts: ['first', 'second'] },
  ], [legacy, andChallenge]), [
    { unit: 'pushups', amount: 10 },
    { unit: 'squats', amount: 45 },
  ]);
});

test('OR challenges include only selected parts and combine matching units', () => {
  const first = {
    challenge_date: '2026-10-01',
    title: 'Välj ett pass',
    completion_mode: 'or',
    description: '15 armhävningar',
    unit: 'Armhävningar',
    base_amount: 15,
    second_description: '10 armhävningar',
    second_unit: 'armhävningar',
    second_base_amount: 10,
  };
  const second = { ...first, challenge_date: '2026-10-02' };

  assert.deepEqual(challenge.aggregateExerciseTotals([
    { result_date: '2026-10-01', multiplier: 2, completed_parts: ['second'] },
    { result_date: '2026-10-02', multiplier: 3, completed_parts: ['first', 'second'] },
  ], [first, second]), [{ unit: 'armhävningar', amount: 95 }]);
});

test('bonus totals are filtered to the requested date window', () => {
  assert.equal(challenge.sumBonusPoints([
    { challenge_date: '2026-09-30', points: 5 },
    { challenge_date: '2026-10-01', points: 3 },
    { challenge_date: '2026-10-08', points: 7 },
    { challenge_date: '2026-11-01', points: 9 },
  ], '2026-10-01', '2026-10-31'), 10);
});
