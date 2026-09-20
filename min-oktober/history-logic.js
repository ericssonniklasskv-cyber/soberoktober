(function attachHistoryLogic(root) {
  const OCTOBER_DATES = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`);
  const OCTOBER_START = OCTOBER_DATES[0];
  const OCTOBER_END = OCTOBER_DATES[OCTOBER_DATES.length - 1];

  function previousDate(date) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() - 1);
    return value.toISOString().slice(0, 10);
  }

  function calculate(results, today) {
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

    let eliminatedAt = null;
    for (let index = 1; index < days.length; index += 1) {
      if (days[index - 1].state === 'missed' && days[index].state === 'missed') {
        eliminatedAt = days[index].date;
        break;
      }
    }

    const yesterday = previousDate(today);
    const yesterdayMissed = days.some((day) => day.date === yesterday && day.state === 'missed');
    const todayCompleted = resultsByDate.has(today);
    let competition = {
      tone: 'active',
      text: 'Du är fortfarande med i tävlingen',
    };

    if (eliminatedAt) {
      competition = {
        tone: 'eliminated',
        text: 'Du är utslagen enligt regeln om två missade dagar i rad',
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
      eliminatedAt,
    };
  }

  root.SoberOctoberHistory = { OCTOBER_DATES, calculate };
}(typeof window === 'undefined' ? globalThis : window));
