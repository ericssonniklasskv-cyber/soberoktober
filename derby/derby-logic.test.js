const test = require('node:test');
const assert = require('node:assert/strict');
const derby = require('./derby-logic.js');

test('race window uses the stated Stockholm boundary instants and dates', () => {
  assert.equal(derby.START_DATE, '2026-10-26');
  assert.equal(derby.END_DATE, '2026-10-31');
  assert.equal(derby.START_INSTANT, Date.parse('2026-10-26T00:00:00+01:00'));
  assert.equal(derby.END_INSTANT, Date.parse('2026-11-01T00:00:00+01:00'));
  assert.equal(derby.isRaceTime(derby.START_INSTANT - 1), false);
  assert.equal(derby.isRaceTime(derby.START_INSTANT), true);
  assert.equal(derby.isRaceTime(Date.parse('2026-10-31T23:59:59+01:00')), true);
  assert.equal(derby.isRaceTime(derby.END_INSTANT), false);
  assert.equal(derby.isRaceDate('2026-10-25'), false);
  assert.equal(derby.isRaceDate('2026-10-26'), true);
  assert.equal(derby.isRaceDate('2026-10-31'), true);
  assert.equal(derby.isRaceDate('2026-11-01'), false);
  assert.equal(derby.isRaceDate('2026-10-32'), false);
});

test('exercise definitions and state are immutable; add and undo preserve prior states', () => {
  assert.deepEqual(derby.EXERCISES, [
    { id: 'squats', label: 'Squats', reps: 15 },
    { id: 'pushups', label: 'Armhävningar', reps: 10 },
    { id: 'pullups', label: 'Pull-ups', reps: 5 },
    { id: 'running', label: 'Löpning', distanceKm: 2.5 },
  ]);
  assert.ok(Object.isFrozen(derby.EXERCISES));
  assert.ok(Object.isFrozen(derby.EXERCISES[0]));
  const initial = derby.createState();
  const added = derby.record(initial, 'squats', 2, '2026-10-19', 'evt-1');
  assert.deepEqual(initial.events, []);
  assert.equal(added.events.length, 1);
  assert.ok(Object.isFrozen(added.events[0]));
  const removed = derby.undo(added, 'evt-1');
  assert.equal(removed.events.length, 0);
  assert.equal(added.events.length, 1);
});

test('record rejects invalid exercise, set count, date and duplicate event ids', () => {
  const state = derby.createState();
  for (const sets of [0, -1, 1.5, 11]) {
    assert.throws(() => derby.record(state, 'squats', sets, '2026-10-19', 'x'));
  }
  assert.throws(() => derby.record(state, 'burpees', 1, '2026-10-19', 'x'));
  for (const date of ['2026-02-29', '2026-13-01', '19-10-2026']) {
    assert.throws(() => derby.record(state, 'squats', 1, date, 'x'));
  }
  const once = derby.record(state, 'pushups', 1, '2026-10-19', 'same');
  assert.throws(() => derby.record(once, 'pushups', 1, '2026-10-19', 'same'));
});

test('restore reloads valid JSON without mutating input and rejects corrupt or duplicate events', () => {
  const source = { version: 1, events: [{ id: 'a', exerciseId: 'pullups', sets: 2, date: '2026-10-20' }] };
  const restored = derby.restore(JSON.stringify(source));
  assert.deepEqual(restored, source);
  assert.equal(Object.isFrozen(restored.events), true);
  assert.equal(Object.isFrozen(source.events), false);
  assert.equal(derby.restore('{bad json'), null);
  assert.equal(derby.restore({ version: 2, events: [] }), null);
  assert.equal(derby.restore({ version: 1, events: [{ ...source.events[0] }, { ...source.events[0] }] }), null);
  assert.equal(derby.restore({ version: 1, events: [{ ...source.events[0], sets: 1.25 }] }), null);
  assert.equal(derby.restore({ version: 1, events: Array(5001).fill(source.events[0]) }), null);
});

test('totals combine exercises and can filter one date', () => {
  let state = derby.createState();
  state = derby.record(state, 'squats', 2, '2026-10-19', 'a');
  state = derby.record(state, 'pushups', 3, '2026-10-19', 'b');
  state = derby.record(state, 'pullups', 1, '2026-10-20', 'c');
  assert.deepEqual(derby.totals(state), {
    points: 6, sets: 6, reps: 65, squats: 30, pushups: 30, pullups: 5, running: 0,
  });
  assert.deepEqual(derby.totals(state, '2026-10-19'), {
    points: 5, sets: 5, reps: 60, squats: 30, pushups: 30, pullups: 0, running: 0,
  });
});


test('running records distance and a step without counting kilometers as repetitions', () => {
  const state = derby.record(derby.createState(), 'running', 2, '2026-10-26', 'run');
  assert.deepEqual(derby.totals(state), {
    points: 2, sets: 2, reps: 0, squats: 0, pushups: 0, pullups: 0, running: 5,
  });
  assert.equal(derby.formatAmount(derby.EXERCISES[3]), '2,5 km löpning');
  assert.equal(derby.restore(JSON.stringify(state)).events[0].exerciseId, 'running');
});

test('each exercise has its own exact daily audio levels, without repeating the final recording', () => {
  for (const [id, count, increment] of [['squats', 3, 15], ['pushups', 3, 10], ['pullups', 4, 5], ['running', 5, 1]]) {
    let state = derby.createState();
    assert.equal(derby.audioClip(state, id, '2026-10-26'), null);
    for (let n = 1; n <= count; n++) {
      state = derby.record(state, id, 1, '2026-10-26', id + n);
      assert.equal(derby.audioClip(state, id, '2026-10-26'), '/derby/audio/' + id + '-' + n * increment + '.m4a');
      assert.equal(derby.audioClip(state, id, '2026-10-27'), null);
    }
    const previous = state;
    state = derby.record(state, id, 1, '2026-10-26', id + 'extra');
    assert.equal(derby.audioClip(state, id, '2026-10-26'), null);
    state = derby.undo(state, id + 'extra');
    assert.deepEqual(state, previous);
    state = derby.record(state, id, 1, '2026-10-27', id + 'next-day');
    assert.equal(derby.audioClip(state, id, '2026-10-27'), '/derby/audio/' + id + '-' + increment + '.m4a');
  }
  assert.throws(() => derby.audioClip(derby.createState(), 'squats'));
});
