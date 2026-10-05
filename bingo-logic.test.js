const test = require('node:test');
const assert = require('node:assert/strict');
const bingo = require('./bingo-logic.js');
const history = require('./min-oktober/history-logic.js');
const fixture = { enabled: true, board: [{unit:'squats',base_amount:100},{unit:'Squats',base_amount:50},{unit:'min promenad',base_amount:60}], completed_cells:{0:'2026-10-05',1:'2026-10-06',2:'2026-10-08'}, activity_dates:['2026-10-05','2026-10-06','2026-10-07','2026-10-08'], daily_scores:[{result_date:'2026-10-05',points:2},{result_date:'2026-10-06',points:2},{result_date:'2026-10-08',points:2}] };
test('Swedish start at 00:01 and return on October 12, with activation required',()=>{
 assert.equal(bingo.active(true,Date.parse('2026-10-05T00:00:59+02:00')),false);
 assert.equal(bingo.active(true,Date.parse('2026-10-05T00:01:00+02:00')),true);
 assert.equal(bingo.active(true,Date.parse('2026-10-11T23:59:59+02:00')),true);
 assert.equal(bingo.active(true,Date.parse('2026-10-12T00:00:00+02:00')),false);
 assert.equal(bingo.active(false,Date.parse('2026-10-06T12:00:00+02:00')),false);
});
test('Disabled bingo leaves existing results and bonuses intact',()=>{
 const r=[{result_date:'2026-10-05',multiplier:3,points:2}];
 assert.equal(bingo.mergeResults(r,{enabled:false}),r);
 const c=[{challenge_date:'2026-10-05',points:3}];assert.equal(bingo.normalBonus(c,{enabled:false}),c);
});
test('Bingo substitutes daily workouts; separate daily bonuses remain and do not create attendance',()=>{
 const results=bingo.mergeResults([{result_date:'2026-10-04',multiplier:2,points:1.5},{result_date:'2026-10-05',multiplier:3,points:2}],fixture);
 assert.equal(results.length,5);assert.equal(results.filter(r=>r.result_date==='2026-10-05').length,1);
 assert.equal(results.find(r=>r.result_date==='2026-10-07').points,0);
 const stats=history.calculate(results,'2026-10-09');assert.equal(stats.totalPoints,7.5);assert.equal(stats.longestStreak,5);assert.equal(stats.completedDays,5);
 const claims=bingo.normalBonus([{challenge_date:'2026-10-04',points:1},{challenge_date:'2026-10-05',points:1},{challenge_date:'2026-10-09',points:1}],fixture);
 assert.equal(claims.length,3);
 const withBonus=history.calculate(results,'2026-10-09',null,claims);
 assert.equal(withBonus.totalPoints,10.5);assert.equal(withBonus.completedDays,5);
 assert.equal(withBonus.days.find(d=>d.date==='2026-10-09').state,'future');
});
test('Weekly bingo is separate, dynamic units aggregate and week boundary preserves totals',()=>{
 const results=bingo.mergeResults([],fixture);
 const first=history.buildPeriodReport({results,challenges:[],stepResults:[],bonusClaims:[{challenge_date:'2026-10-05',points:1}],bingo:fixture,periodKey:'oct_01_07',today:'2026-10-08'});
 assert.equal(first.trainingPoints,0);assert.equal(first.totalPoints,5);assert.equal(first.bonusPoints,1);assert.equal(first.completedDays,3);assert.equal(first.bingo.completedCells,2);
 assert.deepEqual(first.bingo.exerciseTotals,[{unit:'squats',amount:150}]);
 const second=history.buildPeriodReport({results,challenges:[],stepResults:[],bingo:fixture,periodKey:'oct_08_14',today:'2026-10-15'});
 assert.equal(second.totalPoints,2);assert.deepEqual(second.bingo.exerciseTotals,[{unit:'min promenad',amount:60}]);
 assert.equal(first.bingo.points+second.bingo.points,bingo.report(fixture).points);
});
test('Final report totals include bingo separately without inventing multipliers',()=>{
 const report=history.buildFinalReport({results:bingo.mergeResults([{result_date:'2026-10-31',multiplier:2,points:1.5}],fixture),bingo:fixture,today:'2026-11-01'});
 assert.equal(report.totalPoints,7.5);assert.equal(report.totalTrainingPoints,1.5);assert.equal(report.bingo.points,6);assert.equal(report.completedDays,5);assert.equal(report.multiplierCounts[2],1);assert.equal(report.mostUsedMultiplier,2);
});
