const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateWeightedAverage,
  pointsForAverage,
  nextLevelForAverage,
  createProjection,
} = require('./steps-logic.js');

test('step score thresholds match the requested ladder exactly', () => {
  const cases = [
    [3999, 0], [4000, 4], [5000, 7], [6000, 10], [7000, 12],
    [8000, 14], [9000, 16], [10000, 18], [11999, 18], [12000, 20],
  ];
  for (const [average, points] of cases) assert.equal(pointsForAverage(average), points, `${average} steps/day`);
});

test('partial averages weight only reported periods by 7, 7, 7, and 10 days', () => {
  const one = calculateWeightedAverage([{ period_key: 'oct_01_07', avg_steps: 10000 }]);
  assert.deepEqual(one, { average: 10000, includedDays: 7, reportedPeriods: 1 });

  const two = calculateWeightedAverage([
    { period_key: 'oct_01_07', avg_steps: 10000 },
    { period_key: 'oct_08_14', avg_steps: 12000 },
  ]);
  assert.deepEqual(two, { average: 11000, includedDays: 14, reportedPeriods: 2 });

  const three = calculateWeightedAverage([
    { period_key: 'oct_01_07', avg_steps: 10000 },
    { period_key: 'oct_08_14', avg_steps: 12000 },
    { period_key: 'oct_15_21', avg_steps: 9000 },
  ]);
  assert.deepEqual(three, { average: 10333.333333333334, includedDays: 21, reportedPeriods: 3 });

  const partialLast = calculateWeightedAverage([
    { period_key: 'oct_22_31', avg_steps: 11000 },
  ]);
  assert.deepEqual(partialLast, { average: 11000, includedDays: 10, reportedPeriods: 1 });
});

test('next level and full-points gaps are calculated from the exact average', () => {
  assert.deepEqual(nextLevelForAverage(10430), { minimum: 12000, points: 20, stepsRemaining: 1570 });
  assert.deepEqual(nextLevelForAverage(9430), { minimum: 10000, points: 18, stepsRemaining: 570 });
  assert.deepEqual(nextLevelForAverage(11999), { minimum: 12000, points: 20, stepsRemaining: 1 });
  assert.equal(nextLevelForAverage(12000), null);
});

test('projection stays provisional through three periods and becomes final at four', () => {
  const firstThree = [
    { period_key: 'oct_01_07', avg_steps: 10000 },
    { period_key: 'oct_08_14', avg_steps: 10000 },
    { period_key: 'oct_15_21', avg_steps: 10000 },
  ];
  for (let count = 1; count <= 3; count += 1) {
    const projection = createProjection(firstThree.slice(0, count));
    assert.equal(projection.reportedPeriods, count);
    assert.equal(projection.final, false);
    assert.equal(projection.points, 18);
  }

  const final = createProjection([
    ...firstThree,
    { period_key: 'oct_22_31', avg_steps: 12000 },
  ]);
  assert.equal(final.reportedPeriods, 4);
  assert.equal(final.includedDays, 31);
  assert.ok(Math.abs(final.average - 10645.16129032258) < 1e-9);
  assert.equal(final.points, 18);
  assert.equal(final.final, true);
  assert.equal(final.nextLevel, null);
});

test('no reported periods produces no average or projected points', () => {
  assert.deepEqual(createProjection([]), {
    average: null,
    includedDays: 0,
    reportedPeriods: 0,
    points: null,
    final: false,
    nextLevel: null,
  });
});
