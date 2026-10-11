const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./live-logic');
const H = require('../min-oktober/history-logic');
test('Roulette replaces the old card on October 12 and opens at 00:01 Stockholm', () => {
  assert.equal(L.active(Date.parse('2026-10-12T00:00:59+02:00')), false);
  assert.equal(L.active(Date.parse('2026-10-12T00:01:00+02:00')), true);
  assert.equal(L.replacesToday('2026-10-11'), false);
  assert.equal(L.replacesToday('2026-10-12'), true);
  assert.equal(L.replacesToday('2026-10-18'), true);
  assert.equal(L.replacesToday('2026-10-19'), false);
  assert.equal(L.active(Date.parse('2026-10-19T23:59:59+02:00')), true);
  assert.equal(L.active(Date.parse('2026-10-20T00:00:00+02:00')), false);
});
test('Own history replaces normal training scores with roulette points without duplication', () => {
  const scores = L.mergeResults([
    { result_date: '2026-10-04', points: 2, multiplier: 3 },
    { result_date: '2026-10-12', points: 2, multiplier: 3 },
    { result_date: '2026-10-19', points: 1, multiplier: 1 }
  ], [{ result_date: '2026-10-12', points: 9, completed_workouts: 3 }]);
  assert.equal(scores.length, 3);
  assert.equal(scores.find(score => score.kind === 'roulette').points, 9);
  const result = H.calculate(scores, '2026-10-20');
  assert.equal(result.totalPoints, 12);
  assert.equal(result.days.filter(day => day.state === 'completed').length, 3);
  const report = H.buildPeriodReport({results:scores,challenges:[],stepResults:[],periodKey:'oct_08_14',today:'2026-10-20'});
  assert(report); assert.equal(report.trainingPoints,9);
});
