const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReport, DATES } = require('./bingo-logic.js');
const base = () => ({
  simulated_date:'2026-10-05', activity_dates:[], completed_cells:{},
  board:Array.from({length:25},(_,index)=>({unit:index<2?'squats':'min promenad',base_amount:10})),
});
test('A new square contributes its amount once; repetitions only count days',()=>{
 const state=base(); state.completed_cells={0:'2026-10-05',1:'2026-10-06'};
 state.activity_dates=['2026-10-05','2026-10-06','2026-10-07'];
 state.simulated_date='2026-10-08';
 const report=createReport(state);
 assert.deepEqual(report.exerciseTotals,[{unit:'squats',amount:20}]);
 assert.equal(report.completedDays,3); assert.equal(report.longestStreak,3); assert.equal(report.missedDays,0);
});
test('Today and future days never count as missed',()=>{
 for(const today of DATES){
  const state=base(); state.simulated_date=today;
  assert.equal(createReport(state).missedDays,DATES.filter(day=>day<today).length);
  assert.equal(createReport(state).final,false);
 }
});
test('The report is final after all seven days have closed',()=>{
 const state=base(); state.simulated_date='2026-10-12'; state.activity_dates=['2026-10-05','2026-10-06','2026-10-08'];
 const report=createReport(state);
 assert.equal(report.final,true); assert.equal(report.completedDays,3); assert.equal(report.missedDays,4); assert.equal(report.longestStreak,2);
});
test('Future data excluded when previewing a report',()=>{
 const state=base(); state.activity_dates=['2026-10-05','2026-10-08']; state.completed_cells={0:'2026-10-08'};
 const report=createReport(state);
 assert.equal(report.completedDays,1); assert.deepEqual(report.exerciseTotals,[]);
});
test('Unit aggregation is dynamic, trimmed and case insensitive',()=>{
 const state=base(); state.board[1]={unit:' SQUATS ',base_amount:15}; state.completed_cells={0:'2026-10-05',1:'2026-10-05',2:'2026-10-05'};
 assert.deepEqual(createReport(state).exerciseTotals,[{unit:'min promenad',amount:10},{unit:'squats',amount:25}]);
});
