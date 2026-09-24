const test = require('node:test');
const assert = require('node:assert/strict');
const history = require('./history-logic.js');
const steps = require('../stegtavling/steps-logic.js');

test('weekly reports stay locked through the period end and remain available after', () => {
  assert.deepEqual(history.closedReportPeriods('2026-10-07'), []);
  assert.deepEqual(history.closedReportPeriods('2026-10-08').map(({ key }) => key), ['oct_01_07']);
  assert.deepEqual(history.closedReportPeriods('2026-10-22').map(({ key }) => key), [
    'oct_01_07', 'oct_08_14', 'oct_15_21',
  ]);
  assert.equal(history.closedReportPeriods('2026-11-01').length, 4);
  assert.equal(history.nextUnseenReport('2026-10-15', ['oct_01_07'])?.key, 'oct_08_14');
});

test('report multiplies daily amounts, combines matching units, and counts misses and streaks', () => {
  const report = history.buildPeriodReport({
    periodKey: 'oct_01_07',
    today: '2026-10-08',
    stepsLogic: steps,
    results: [
      { result_date: '2026-10-01', multiplier: 2, points: 1.5 },
      { result_date: '2026-10-02', multiplier: 3, points: 2 },
      { result_date: '2026-10-04', multiplier: 1, points: 1 },
      { result_date: '2026-10-08', multiplier: 3, points: 2 },
    ],
    challenges: [
      { challenge_date: '2026-10-01', title: 'Squats', unit: 'squats', base_amount: 15 },
      { challenge_date: '2026-10-02', title: 'Squats', unit: 'Squats', base_amount: 20 },
      { challenge_date: '2026-10-04', title: 'Core', unit: 'situps', base_amount: 10 },
    ],
    stepResults: [{ period_key: 'oct_01_07', avg_steps: 9430 }],
  });

  assert.equal(report.completedDays, 3);
  assert.equal(report.missedDays, 4);
  assert.equal(report.trainingPoints, 4.5);
  assert.equal(report.multiplierCounts[3], 1);
  assert.equal(report.bestStreak, 2);
  assert.deepEqual(report.exerciseTotals, [
    { unit: 'situps', amount: 10 },
    { unit: 'squats', amount: 90 },
  ]);
  assert.equal(report.stepAverage, 9430);
  assert.equal(report.stepPoints, 16);
});

test('missing exercises and step reports stay empty instead of becoming zeros', () => {
  const report = history.buildPeriodReport({
    periodKey: 'oct_08_14',
    today: '2026-10-15',
    results: [],
    challenges: [],
    stepResults: [],
    stepsLogic: steps,
  });
  assert.equal(report.completedDays, 0);
  assert.equal(report.missedDays, 7);
  assert.deepEqual(report.exerciseTotals, []);
  assert.equal(report.stepAverage, null);
  assert.equal(report.stepPoints, null);
});

test('locked and unknown report periods cannot be calculated early', () => {
  assert.equal(history.buildPeriodReport({ periodKey: 'oct_01_07', today: '2026-10-07' }), null);
  assert.equal(history.buildPeriodReport({ periodKey: 'unknown', today: '2026-11-01' }), null);
});
