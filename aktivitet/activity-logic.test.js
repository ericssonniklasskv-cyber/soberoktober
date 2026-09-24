const test = require('node:test');
const assert = require('node:assert/strict');
const ActivityLogic = require('./activity-logic.js');

test('formats first completions and true upgrades differently', () => {
  assert.equal(ActivityLogic.sentence({ display_name: 'Niklas', multiplier: 2, activity_type: 'completed' }), 'Niklas klarade dagens pass ×2');
  assert.equal(ActivityLogic.sentence({ display_name: 'Emma', multiplier: 3, activity_type: 'upgraded' }), 'Emma uppgraderade till ×3');
});

test('rejects invalid levels and safely falls back for missing names', () => {
  assert.equal(ActivityLogic.sentence({ display_name: ' ', multiplier: 1, activity_type: 'completed' }), 'Deltagare klarade dagens pass ×1');
  assert.equal(ActivityLogic.sentence({ display_name: 'Test', multiplier: 4, activity_type: 'completed' }), '');
});

test('formats relative and absolute times', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  assert.equal(ActivityLogic.relativeTime('2026-10-12T11:58:00Z', now), 'för 2 minuter sedan');
  assert.match(ActivityLogic.fullTimestamp('2026-10-12T11:58:00Z'), /2026/);
  assert.equal(ActivityLogic.relativeTime('not a date', now), '');
});
