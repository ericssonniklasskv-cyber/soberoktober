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

test('competition status comes from the saved status, not local missed-day inference', () => {
  const results = [
    { result_date: '2026-10-01', multiplier: 1, points: 1 },
    { result_date: '2026-10-04', multiplier: 1, points: 1 },
  ];
  const active = history.calculate(results, '2026-10-05', { status: 'active' });
  assert.equal(active.competition.tone, 'active');
  assert.equal(active.eliminatedAt, null);

  const eliminated = history.calculate(results, '2026-10-05', {
    status: 'eliminated',
    eliminated_at: '2026-10-03T16:00:00Z',
    elimination_reason: 'Två missade dagar i rad',
  });
  assert.equal(eliminated.competition.tone, 'eliminated');
  assert.match(eliminated.competition.text, /Två missade dagar i rad/);
  assert.equal(eliminated.eliminatedAt, '2026-10-03T16:00:00Z');
});

test('final report stays locked while October 31 submissions are incomplete and aggregates the full month after', () => {
  const input = {
    today: '2026-11-01',
    results: [
      { result_date: '2026-10-01', multiplier: 2, points: 1.5 },
      { result_date: '2026-10-02', multiplier: 3, points: 2 },
      { result_date: '2026-10-03', multiplier: 2, points: 1.5 },
      { result_date: '2026-11-01', multiplier: 3, points: 2 },
    ],
    challenges: [
      { challenge_date: '2026-10-01', title: 'Squats', unit: 'squats', base_amount: 15 },
      { challenge_date: '2026-10-02', title: 'Squats', unit: 'Squats', base_amount: 20 },
      { challenge_date: '2026-10-03', title: 'Armar', unit: 'armhävningar', base_amount: 10 },
    ],
    stepResults: [
      { period_key: 'oct_01_07', avg_steps: 10000 },
      { period_key: 'oct_08_14', avg_steps: 12000 },
    ],
    competitionStatus: { status: 'active' },
    displayName: 'Anna',
    trainingLeaderboard: [{ is_current_user: true, rank_position: 3 }],
    stepLeaderboard: [{ display_name: 'Anna', average_steps: 11000, reported_periods: 2, rank_position: 1 }],
    stepsLogic: steps,
  };
  assert.equal(history.buildFinalReport({ ...input, today: '2026-10-31' }), null);
  const report = history.buildFinalReport(input);
  assert.equal(report.completedDays, 3);
  assert.equal(report.missedDays, 28);
  assert.equal(report.totalTrainingPoints, 5);
  assert.equal(report.longestStreak, 3);
  assert.equal(report.multiplierCounts[2], 2);
  assert.equal(report.multiplierCounts[3], 1);
  assert.equal(report.mostUsedMultiplier, 2);
  assert.deepEqual(report.exerciseTotals, [
    { unit: 'armhävningar', amount: 20 },
    { unit: 'squats', amount: 90 },
  ]);
  assert.equal(report.trainingPlacement, 3);
  assert.equal(report.stepAverage, 11000);
  assert.equal(report.stepReportedPeriods, 2);
  assert.equal(report.stepPoints, 18);
  assert.equal(report.stepPlacement, 1);
  assert.equal(report.competition.status, 'active');
});

test('final report unlocks on October 31 only after the last workout and final step period are saved', () => {
  const input = {
    today: '2026-10-31',
    results: [{ result_date: '2026-10-31', multiplier: 2, points: 1.5 }],
    stepResults: [{ period_key: 'oct_22_31', avg_steps: 10200 }],
    competitionStatus: { status: 'active' },
    stepsLogic: steps,
  };
  assert.equal(history.isFinalReportAvailable({ ...input, stepResults: [] }), false);
  assert.equal(history.isFinalReportAvailable({ ...input, results: [] }), false);
  assert.equal(history.isFinalReportAvailable(input), true);
  assert.notEqual(history.buildFinalReport(input), null);
  assert.equal(history.isFinalReportAvailable({
    today: '2026-10-30',
    results: input.results,
    stepResults: input.stepResults,
    competitionStatus: input.competitionStatus,
  }), false);
});

test('eliminated participants need the final step report but not an October 31 workout', () => {
  const shared = {
    today: '2026-10-31',
    results: [{ result_date: '2026-10-08', multiplier: 2, points: 1.5 }],
    stepResults: [{ period_key: 'oct_22_31', avg_steps: 10200 }],
    competitionStatus: { status: 'eliminated', eliminated_at: '2026-10-10T15:00:00Z' },
    stepsLogic: steps,
  };
  assert.equal(history.isFinalReportAvailable(shared), true);
  assert.equal(history.isFinalReportAvailable({ ...shared, stepResults: [] }), false);
  assert.equal(history.isFinalReportAvailable({ ...shared, today: '2026-11-01', stepResults: [] }), true);
});

test('eliminated final report ends its missed-day and streak window on the Stockholm elimination date', () => {
  const report = history.buildFinalReport({
    today: '2026-11-12',
    results: [
      { result_date: '2026-10-01', multiplier: 1, points: 1 },
      { result_date: '2026-10-02', multiplier: 2, points: 1.5 },
      { result_date: '2026-10-06', multiplier: 3, points: 2 },
    ],
    challenges: [
      { challenge_date: '2026-10-01', title: 'Squats', unit: 'squats', base_amount: 10 },
      { challenge_date: '2026-10-02', title: 'Squats', unit: 'squats', base_amount: 10 },
      { challenge_date: '2026-10-06', title: 'Squats', unit: 'squats', base_amount: 10 },
    ],
    stepResults: [],
    competitionStatus: {
      status: 'eliminated',
      eliminated_at: '2026-10-04T22:30:00Z',
      elimination_reason: 'Två missade dagar i rad',
    },
    stepsLogic: steps,
  });
  assert.equal(report.cutoffDate, '2026-10-05');
  assert.equal(report.completedDays, 2);
  assert.equal(report.missedDays, 3);
  assert.equal(report.longestStreak, 2);
  assert.deepEqual(report.exerciseTotals, [{ unit: 'squats', amount: 30 }]);
  assert.deepEqual(report.competition, {
    status: 'eliminated',
    eliminationReason: 'Två missade dagar i rad',
    eliminatedAt: '2026-10-04T22:30:00Z',
    eliminationDate: '2026-10-05',
  });
  assert.equal(report.stepAverage, null);
  assert.equal(report.stepPoints, null);
});

test('step rank is left unknown if identical public rows make the account impossible to distinguish', () => {
  const row = { display_name: 'Alex', average_steps: 7000, reported_periods: 4, rank_position: 2 };
  const report = history.buildFinalReport({
    today: '2026-11-01',
    stepResults: [
      { period_key: 'oct_01_07', avg_steps: 7000 },
      { period_key: 'oct_08_14', avg_steps: 7000 },
      { period_key: 'oct_15_21', avg_steps: 7000 },
      { period_key: 'oct_22_31', avg_steps: 7000 },
    ],
    displayName: 'Alex',
    stepLeaderboard: [row, { ...row, rank_position: 4 }],
    stepsLogic: steps,
  });
  assert.equal(report.stepPlacement, null);
  assert.equal(report.stepPlacementAmbiguous, true);
});
