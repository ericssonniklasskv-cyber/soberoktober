(function attachSoberDerby(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberDerby = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSoberDerby() {
  const EXERCISES = Object.freeze([
    Object.freeze({ id: 'squats', label: 'Squats', reps: 15 }),
    Object.freeze({ id: 'pushups', label: 'Armhävningar', reps: 10 }),
    Object.freeze({ id: 'pullups', label: 'Pull-ups', reps: 5 }),
    Object.freeze({ id: 'running', label: 'Löpning', distanceKm: 2.5 }),
  ]);
  const BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
  const MAX_EVENTS = 5000;
  const START_DATE = '2026-10-26';
  const END_DATE = '2026-10-31';
  const START_INSTANT = Date.parse('2026-10-26T00:00:00+01:00');
  const END_INSTANT = Date.parse('2026-11-01T00:00:00+01:00');

  function validDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }

  function isRaceDate(date) {
    return validDate(date) && date >= START_DATE && date <= END_DATE;
  }

  function isRaceTime(now) {
    const instant = now instanceof Date ? now.getTime() : Number(now);
    return Number.isFinite(instant) && instant >= START_INSTANT && instant < END_INSTANT;
  }

  function freshId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function createState() {
    return Object.freeze({ version: 1, events: Object.freeze([]) });
  }

  function validateEvent(event) {
    return !!event && typeof event === 'object' && !Array.isArray(event)
      && typeof event.id === 'string' && event.id.length > 0 && event.id.length <= 200
      && BY_ID.has(event.exerciseId)
      && Number.isInteger(event.sets) && event.sets >= 1 && event.sets <= 10
      && validDate(event.date);
  }

  function restore(raw) {
    let value = raw;
    if (typeof raw === 'string') {
      try { value = JSON.parse(raw); } catch (_) { return null; }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || value.version !== 1 || !Array.isArray(value.events)
      || value.events.length > MAX_EVENTS) return null;
    const ids = new Set();
    const events = [];
    for (const event of value.events) {
      if (!validateEvent(event) || ids.has(event.id)) return null;
      ids.add(event.id);
      events.push(Object.freeze({ id: event.id, exerciseId: event.exerciseId, sets: event.sets, date: event.date }));
    }
    return Object.freeze({ version: 1, events: Object.freeze(events) });
  }

  function checkedState(state) {
    const normalized = restore(state);
    if (!normalized) throw new TypeError('Invalid derby state');
    return normalized;
  }

  function record(state, exerciseId, sets = 1, date = new Date().toISOString().slice(0, 10), id = freshId()) {
    const current = checkedState(state);
    if (!BY_ID.has(exerciseId)) throw new TypeError('Unknown exercise');
    if (!Number.isInteger(sets) || sets < 1 || sets > 10) throw new RangeError('Sets must be an integer from 1 to 10');
    if (!validDate(date)) throw new TypeError('Date must be a valid YYYY-MM-DD date');
    if (typeof id !== 'string' || id.length === 0 || id.length > 200 || current.events.some((event) => event.id === id)) {
      throw new TypeError('Event id must be unique and non-empty');
    }
    if (current.events.length >= MAX_EVENTS) throw new RangeError('Event limit reached');
    const event = Object.freeze({ id, exerciseId, sets, date });
    return Object.freeze({ version: 1, events: Object.freeze([...current.events, event]) });
  }

  function undo(state, eventId) {
    const current = checkedState(state);
    return Object.freeze({ version: 1, events: Object.freeze(current.events.filter((event) => event.id !== eventId)) });
  }

  function totals(state, date) {
    const current = checkedState(state);
    if (date !== undefined && !validDate(date)) throw new TypeError('Date must be a valid YYYY-MM-DD date');
    const result = { points: 0, sets: 0, reps: 0, squats: 0, pushups: 0, pullups: 0, running: 0 };
    current.events.forEach((event) => {
      if (date !== undefined && event.date !== date) return;
      const exercise = BY_ID.get(event.exerciseId);
      const reps = (exercise.reps || 0) * event.sets;
      result.points += event.sets;
      result.sets += event.sets;
      result.reps += reps;
      result[event.exerciseId] += exercise.distanceKm ? exercise.distanceKm * event.sets : reps;
    });
    return Object.freeze(result);
  }

  const AUDIO_LEVELS = Object.freeze({
    squats: Object.freeze([15, 30, 45]),
    pushups: Object.freeze([10, 20, 30]),
    pullups: Object.freeze([5, 10, 15, 20]),
    running: Object.freeze([2.5, 5, 7.5, 10, 12.5]),
  });

  function formatAmount(exercise, sets = 1) {
    if (exercise.distanceKm) return (exercise.distanceKm * sets).toLocaleString('sv-SE') + ' km löpning';
    return (exercise.reps * sets) + ' ' + exercise.label.toLowerCase();
  }

  // Exact daily milestones only: never replay a lower count at a higher total.
  function audioClip(state, exerciseId, date) {
    if (!validDate(date)) throw new TypeError('Audio requires a valid day');
    const levels = AUDIO_LEVELS[exerciseId];
    if (!levels) return null;
    const amount = totals(state, date)[exerciseId];
    const index = levels.indexOf(amount);
    if (index < 0) return null;
    const suffix = exerciseId === 'running' ? index + 1 : amount;
    return '/derby/audio/' + exerciseId + '-' + suffix + '.m4a';
  }

  return Object.freeze({
    EXERCISES, MAX_EVENTS, START_DATE, END_DATE, START_INSTANT, END_INSTANT,
    isRaceTime, isRaceDate, createState, record, undo, totals, restore, formatAmount, audioClip,
  });
}));
