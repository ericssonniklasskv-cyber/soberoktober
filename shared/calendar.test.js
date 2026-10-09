const test = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('./calendar.js');
const history = require('../min-oktober/history-logic.js');
const steps = require('../stegtavling/steps-logic.js');

test('Stockholm calendar changes at local midnight, including winter time', () => {
  assert.equal(calendar.stockholmDate('2026-09-30T21:59:59Z'), '2026-09-30');
  assert.equal(calendar.stockholmDate('2026-09-30T22:00:00Z'), '2026-10-01');
  assert.equal(calendar.stockholmDate('2026-10-31T22:59:59Z'), '2026-10-31');
  assert.equal(calendar.stockholmDate('2026-10-31T23:00:00Z'), '2026-11-01');
  assert.equal(calendar.stockholmDate('2026-10-25T00:30:00Z'), '2026-10-25');
  assert.equal(calendar.stockholmDate('2026-10-25T01:30:00Z'), '2026-10-25');
  assert.equal(calendar.stockholmDate(null), null);
  assert.equal(calendar.stockholmDate('invalid'), null);
});

test('history and steps share exactly one immutable period configuration', () => {
  assert.equal(history.REPORT_PERIODS, calendar.PERIODS);
  assert.equal(steps.PERIODS, calendar.PERIODS);
  assert.deepEqual(calendar.PERIODS.map(p => p.days), [7, 7, 7, 10]);
  assert.equal(calendar.PERIODS.reduce((sum, p) => sum + p.days, 0), 31);
  for (const period of calendar.PERIODS) {
    assert.equal(calendar.dayNumber(period.end) - calendar.dayNumber(period.start) + 1, period.days);
    assert.ok(Object.isFrozen(period));
  }
});

test('date arithmetic and competition bounds survive DST and month boundaries', () => {
  assert.equal(calendar.shiftDate('2026-10-25', -1), '2026-10-24');
  assert.equal(calendar.shiftDate('2026-11-01', -1), '2026-10-31');
  assert.equal(calendar.shiftDate('2026-10-01', -1), '2026-09-30');
  assert.equal(calendar.isCompetitionDay('2026-09-30'), false);
  assert.equal(calendar.isCompetitionDay('2026-10-01'), true);
  assert.equal(calendar.isCompetitionDay('2026-10-31'), true);
  assert.equal(calendar.isCompetitionDay('2026-11-01'), false);
  assert.equal(calendar.stockholmDate(calendar.OCTOBER_START_AT), '2026-10-01');
  assert.equal(calendar.stockholmDate(calendar.BINGO_END_AT - 1), '2026-10-11');
  assert.equal(calendar.stockholmDate(calendar.BINGO_END_AT), '2026-10-12');
});
