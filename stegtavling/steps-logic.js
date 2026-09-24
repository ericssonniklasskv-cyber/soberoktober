(function attachStepsLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberOctoberSteps = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createStepsLogic() {
  const PERIODS = Object.freeze([
    Object.freeze({ key: 'oct_01_07', days: 7 }),
    Object.freeze({ key: 'oct_08_14', days: 7 }),
    Object.freeze({ key: 'oct_15_21', days: 7 }),
    Object.freeze({ key: 'oct_22_31', days: 10 }),
  ]);
  const PERIOD_BY_KEY = new Map(PERIODS.map((period) => [period.key, period]));
  const SCORE_LEVELS = Object.freeze([
    Object.freeze({ minimum: 0, points: 0 }),
    Object.freeze({ minimum: 4000, points: 4 }),
    Object.freeze({ minimum: 5000, points: 7 }),
    Object.freeze({ minimum: 6000, points: 10 }),
    Object.freeze({ minimum: 7000, points: 12 }),
    Object.freeze({ minimum: 8000, points: 14 }),
    Object.freeze({ minimum: 9000, points: 16 }),
    Object.freeze({ minimum: 10000, points: 18 }),
    Object.freeze({ minimum: 12000, points: 20 }),
  ]);

  function calculateWeightedAverage(results) {
    let weightedTotal = 0;
    let includedDays = 0;
    const reported = new Set();
    (results || []).forEach((result) => {
      const period = PERIOD_BY_KEY.get(result.period_key);
      if (!period || reported.has(period.key)) return;
      const averageSteps = Number(result.avg_steps);
      if (!Number.isFinite(averageSteps) || averageSteps <= 0) return;
      reported.add(period.key);
      weightedTotal += averageSteps * period.days;
      includedDays += period.days;
    });
    return {
      average: includedDays ? weightedTotal / includedDays : null,
      includedDays,
      reportedPeriods: reported.size,
    };
  }

  function pointsForAverage(average) {
    if (!Number.isFinite(average) || average < 0) return 0;
    let level = SCORE_LEVELS[0];
    SCORE_LEVELS.forEach((candidate) => {
      if (average >= candidate.minimum) level = candidate;
    });
    return level.points;
  }

  function nextLevelForAverage(average) {
    const highestMinimum = SCORE_LEVELS[SCORE_LEVELS.length - 1].minimum;
    if (!Number.isFinite(average) || average >= highestMinimum) return null;
    const next = SCORE_LEVELS.find((level) => level.minimum > average);
    return next ? {
      minimum: next.minimum,
      points: next.points,
      stepsRemaining: Math.ceil(next.minimum - average),
    } : null;
  }

  function createProjection(results) {
    const summary = calculateWeightedAverage(results);
    if (summary.average === null) return { ...summary, points: null, final: false, nextLevel: null };
    const final = summary.reportedPeriods === PERIODS.length;
    return {
      ...summary,
      points: pointsForAverage(summary.average),
      final,
      nextLevel: final ? null : nextLevelForAverage(summary.average),
    };
  }

  function getScoreLadder(average) {
    const hasAverage = Number.isFinite(average);
    const currentPoints = hasAverage ? pointsForAverage(average) : null;
    const nextLevel = hasAverage ? nextLevelForAverage(average) : null;
    return SCORE_LEVELS.map((level, index) => ({
      ...level,
      isLowest: index === 0,
      isHighest: index === SCORE_LEVELS.length - 1,
      threshold: index === 0 ? SCORE_LEVELS[index + 1].minimum : level.minimum,
      isCurrent: hasAverage && level.points === currentPoints,
      isNext: nextLevel?.minimum === level.minimum,
    })).reverse();
  }

  return Object.freeze({ PERIODS, SCORE_LEVELS, calculateWeightedAverage, pointsForAverage, nextLevelForAverage, createProjection, getScoreLadder });
}));
