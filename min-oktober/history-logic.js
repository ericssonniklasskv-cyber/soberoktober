(function attachHistoryLogic(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberOctoberHistory = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createHistoryLogic() {
  const OCTOBER_DATES = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`);
  const OCTOBER_START = OCTOBER_DATES[0];
  const OCTOBER_END = OCTOBER_DATES[OCTOBER_DATES.length - 1];
  const REPORT_PERIODS = Object.freeze([
    Object.freeze({ key: 'oct_01_07', title: 'Vecka 1', label: '1–7 oktober', start: '2026-10-01', end: '2026-10-07', days: 7 }),
    Object.freeze({ key: 'oct_08_14', title: 'Vecka 2', label: '8–14 oktober', start: '2026-10-08', end: '2026-10-14', days: 7 }),
    Object.freeze({ key: 'oct_15_21', title: 'Vecka 3', label: '15–21 oktober', start: '2026-10-15', end: '2026-10-21', days: 7 }),
    Object.freeze({ key: 'oct_22_31', title: 'Slutspurten', label: '22–31 oktober', start: '2026-10-22', end: '2026-10-31', days: 10 }),
  ]);

  function previousDate(date) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() - 1);
    return value.toISOString().slice(0, 10);
  }

  function calculate(results, today, competitionStatus = null) {
    const octoberResults = results.filter(({ result_date: date }) => date >= OCTOBER_START && date <= OCTOBER_END);
    const resultsByDate = new Map(octoberResults.map((result) => [result.result_date, result]));
    const days = OCTOBER_DATES.map((date) => ({
      date,
      result: resultsByDate.get(date) || null,
      state: resultsByDate.has(date) ? 'completed' : (date < today ? 'missed' : 'future'),
    }));

    let longestStreak = 0;
    let runningStreak = 0;
    days.forEach((day) => {
      if (day.state === 'completed') {
        runningStreak += 1;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    });

    let currentStreak = 0;
    if (today >= OCTOBER_START) {
      let cursor = today > OCTOBER_END ? OCTOBER_END : today;
      if (today <= OCTOBER_END && !resultsByDate.has(cursor)) cursor = previousDate(cursor);
      while (resultsByDate.has(cursor) && cursor >= OCTOBER_START) {
        currentStreak += 1;
        cursor = previousDate(cursor);
      }
    }

    const yesterday = previousDate(today);
    const yesterdayMissed = days.some((day) => day.date === yesterday && day.state === 'missed');
    const todayCompleted = resultsByDate.has(today);
    let competition = {
      tone: 'active',
      text: 'Du är fortfarande med i tävlingen',
    };

    const isEliminated = competitionStatus?.status === 'eliminated';
    if (isEliminated) {
      competition = {
        tone: 'eliminated',
        text: `Du är utslagen ur tävlingen${competitionStatus.elimination_reason ? ` · ${competitionStatus.elimination_reason}` : ''}`,
      };
    } else if (today >= OCTOBER_START && today <= OCTOBER_END && yesterdayMissed && !todayCompleted) {
      competition = {
        tone: 'warning',
        text: 'Du missade igår – dagens pass håller dig kvar',
      };
    }

    return {
      days,
      resultsByDate,
      totalPoints: octoberResults.reduce((total, result) => total + Number(result.points || 0), 0),
      completedDays: octoberResults.length,
      currentStreak,
      longestStreak,
      competition,
      eliminatedAt: isEliminated ? competitionStatus.eliminated_at : null,
    };
  }

  function closedReportPeriods(today) {
    return REPORT_PERIODS.filter((period) => period.end < today);
  }

  function nextUnseenReport(today, seenKeys = []) {
    const seen = new Set(seenKeys);
    return closedReportPeriods(today).find((period) => !seen.has(period.key)) || null;
  }

  function buildPeriodReport({ results, challenges, stepResults, periodKey, today, stepsLogic }) {
    const period = REPORT_PERIODS.find((candidate) => candidate.key === periodKey);
    if (!period || period.end >= today) return null;

    const completed = (results || []).filter((result) => (
      result.result_date >= period.start
      && result.result_date <= period.end
      && result.result_date <= today
    ));
    const challengeByDate = new Map((challenges || []).map((challenge) => [challenge.challenge_date, challenge]));
    const totalsByUnit = new Map();
    const multiplierCounts = { 1: 0, 2: 0, 3: 0 };
    const completedDates = new Set();
    let trainingPoints = 0;

    completed.forEach((result) => {
      const multiplier = Number(result.multiplier);
      if (![1, 2, 3].includes(multiplier)) return;
      completedDates.add(result.result_date);
      multiplierCounts[multiplier] += 1;
      trainingPoints += Number(result.points) || 0;

      const challenge = challengeByDate.get(result.result_date);
      const baseAmount = Number(challenge?.base_amount);
      const rawUnit = typeof challenge?.unit === 'string' && challenge.unit.trim()
        ? challenge.unit.trim()
        : (typeof challenge?.title === 'string' ? challenge.title.trim() : '');
      if (!rawUnit || !Number.isFinite(baseAmount) || baseAmount <= 0) return;
      const key = rawUnit.toLocaleLowerCase('sv-SE');
      const current = totalsByUnit.get(key) || { unit: rawUnit, amount: 0 };
      current.amount += baseAmount * multiplier;
      totalsByUnit.set(key, current);
    });

    let bestStreak = 0;
    let streak = 0;
    for (let day = 1; day <= period.days; day += 1) {
      const date = `${period.start.slice(0, 8)}${String(Number(period.start.slice(-2)) + day - 1).padStart(2, '0')}`;
      if (completedDates.has(date)) {
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }
    }

    const stepResult = (stepResults || []).find((row) => row.period_key === period.key) || null;
    const stepAverage = stepResult ? Number(stepResult.avg_steps) : null;
    const stepProjection = stepResult && stepsLogic
      ? stepsLogic.createProjection([stepResult])
      : null;

    return {
      ...period,
      completedDays: completedDates.size,
      missedDays: Math.max(0, period.days - completedDates.size),
      trainingPoints,
      bestStreak,
      multiplierCounts,
      exerciseTotals: [...totalsByUnit.values()].sort((a, b) => a.unit.localeCompare(b.unit, 'sv-SE')),
      stepAverage: Number.isFinite(stepAverage) ? stepAverage : null,
      stepPoints: stepProjection?.points ?? null,
    };
  }

  return Object.freeze({ OCTOBER_DATES, REPORT_PERIODS, calculate, closedReportPeriods, nextUnseenReport, buildPeriodReport });
}));
