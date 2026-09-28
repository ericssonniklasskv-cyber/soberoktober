const assert = require('node:assert/strict');
const test = require('node:test');
const { getCountdownState, OCTOBER_START_AT } = require('./countdown-logic.js');

test('targets midnight at the start of October in Stockholm', () => {
  assert.equal(OCTOBER_START_AT, Date.parse('2026-10-01T00:00:00+02:00'));
  assert.deepEqual(getCountdownState(Date.parse('2026-09-28T00:00:00+02:00')), {
    complete: false,
    hours: 72,
    minutes: 0,
    seconds: 0,
  });
});

test('shows the final second until the October start instant', () => {
  assert.deepEqual(getCountdownState(Date.parse('2026-09-30T23:59:59+02:00')), {
    complete: false,
    hours: 0,
    minutes: 0,
    seconds: 1,
  });
});

test('reaches zero exactly at midnight and stays complete afterward', () => {
  assert.deepEqual(getCountdownState(Date.parse('2026-10-01T00:00:00+02:00')), {
    complete: true,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  assert.equal(getCountdownState(Date.parse('2026-10-02T12:00:00+02:00')).complete, true);
});