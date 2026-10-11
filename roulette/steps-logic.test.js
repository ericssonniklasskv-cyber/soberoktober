const test = require('node:test'), assert = require('node:assert/strict');
const R = require('./roulette-logic.js'), Live = require('./live-logic.js');
const A = require('../aktivitet/activity-logic.js');
test('steps score one point without a spin and restore across devices', () => {
  const state = R.setSteps(R.fresh(), true);
  assert.deepEqual(R.restore(state), state);
  assert.deepEqual(state.days, {});
  assert.equal(R.summary(state).total, 1);
  assert.equal(R.summary(state).days, 1);
  assert.equal(R.summary(state).remaining, 5);
  assert.equal(R.summary(R.setSteps(state, true)).total, 1);
  assert.equal(R.summary(R.setSteps(state, false)).total, 0);
  assert.throws(() => R.spin(state, .2), /Klicka ur/);
});
test('undo steps preserves the drawn workout, checklist and free spins', () => {
  let state = R.spin(R.fresh(), .2);
  state = R.spin(state, .7);
  state = R.setStepChecked(state, R.checklistItems(state.days[state.date])[0].key, true);
  const before = structuredClone(state.days);
  const steps = R.setSteps(state, true);
  assert.throws(() => R.toggleCompleted(steps), /Klicka ur/);
  const undone = R.setSteps(R.restore(steps), false);
  assert.deepEqual(undone.days, before);
  assert.equal(R.remaining(undone), 4);
  assert.throws(() => R.setSteps(R.toggleCompleted(undone), true), /antingen/);
});
test('one point and correct activity label reach shared live views', () => {
  const [score] = Live.mergeResults([], [{result_date:'2026-10-12', points:1, completed_workouts:0}]);
  assert.equal(score.points, 1);
  assert.equal(score.kind, 'roulette');
  assert.equal(A.sentence({display_name:'Test',activity_type:'roulette_steps'}), 'Test gick 10 000 steg · 1 poäng');
});
