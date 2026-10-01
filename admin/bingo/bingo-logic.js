(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberOctoberBingo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const START = '2026-10-05';
  const END = '2026-10-11';
  const DATES = Object.freeze(Array.from({ length: 7 }, (_, i) => '2026-10-' + String(i + 5).padStart(2, '0')));
  // Canonical awarded points come from the sandbox RPC; this module handles presentation/reporting.
  function createReport(state) {
    const date = state.simulated_date;
    const activity = new Set((state.activity_dates || []).filter(day => day >= START && day <= END && day <= date));
    const completed = Object.entries(state.completed_cells || {}).filter(([index, day]) => (
      /^([0-9]|1[0-9]|2[0-4])$/.test(index) && day <= date
    ));
    const totals = new Map();
    completed.forEach(([index]) => {
      const task = state.board[Number(index)];
      const amount = Number(task?.base_amount);
      const unit = task?.unit?.trim();
      if (!unit || !Number.isFinite(amount) || amount <= 0) return;
      const key = unit.toLocaleLowerCase('sv-SE');
      const item = totals.get(key) || { unit, amount: 0 };
      item.amount += amount;
      totals.set(key, item);
    });
    let current = 0, longest = 0;
    DATES.forEach(day => {
      if (day > date) return;
      if (activity.has(day)) { current += 1; longest = Math.max(longest, current); }
      else current = 0;
    });
    return {
      final: date > END,
      completedDays: activity.size,
      missedDays: DATES.filter(day => day < date && !activity.has(day)).length,
      longestStreak: longest,
      exerciseTotals: [...totals.values()].sort((a, b) => a.unit.localeCompare(b.unit, 'sv')),
      days: DATES.map(day => ({ date: day, state: activity.has(day) ? 'completed' : day < date ? 'missed' : 'future' })),
    };
  }
  return { START, END, DATES, createReport };
});