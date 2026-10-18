const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('./vote-logic.js');
const monday={date:'2026-10-19',opens:'2026-10-18T21:00:00+02:00',closes:'2026-10-19T00:00:00+02:00',options:[{votes:1},{votes:2},{votes:0},{votes:0}],result:null};
const tuesday={...monday,date:'2026-10-20',opens:'2026-10-19T15:00:00+02:00',closes:'2026-10-20T00:00:00+02:00'};
test('first poll opens exactly Sunday 21:00 Swedish time',()=>{
 const state={now:'2026-10-18T20:59:59+02:00',today:'2026-10-18',days:[monday,tuesday]};
 assert.equal(L.view(state).phase,'before');assert.equal(L.view(state).poll,undefined);
 assert.equal(L.view({...state,now:monday.opens}).poll,monday);
});
test('midnight shows saved winner while the next poll waits until 15:00',()=>{
 const winner={...monday,result:{option_id:1}};
 const view=L.view({now:monday.closes,today:'2026-10-19',days:[winner,tuesday]});
 assert.equal(view.today,winner);assert.equal(view.poll,undefined);assert.equal(view.next,tuesday);
 assert.equal(L.view({now:monday.closes,today:'2026-10-19',days:[monday]}).poll,undefined);
});
test('no new poll after last winner; week ends in Swedish winter time',()=>{
 const last={...monday,date:'2026-10-25',opens:'2026-10-24T15:00:00+02:00',closes:'2026-10-25T00:00:00+02:00',result:{option_id:0}};
 assert.equal(L.view({now:'2026-10-25T23:59:59+01:00',today:last.date,days:[last]}).phase,'active');
 assert.equal(L.view({now:'2026-10-26T00:00:00+01:00',today:'2026-10-26',days:[last]}).phase,'finished');
 assert.equal(L.view({now:last.closes,today:last.date,days:[last]}).poll,undefined);
});
test('vote bars handle empty polls and rounded shares',()=>{assert.equal(L.total(monday),3);assert.equal(L.percentage(0,0),0);assert.equal(L.percentage(1,3),33);assert.equal(L.percentage(2,3),67);});
test('Swedish dates keep calendar date across daylight saving change',()=>{assert.match(L.dateLabel('2026-10-19'),/måndag 19 oktober/);assert.match(L.dateLabel('2026-10-25'),/söndag 25 oktober/);});

test('deadline copy follows the server clock and handles the closing minute',()=>{
 assert.equal(L.timeLeft('2026-10-18T21:00:00+02:00',monday.closes),'3 tim kvar');
 assert.equal(L.timeLeft('2026-10-18T22:20:00+02:00',monday.closes),'1 tim 40 min kvar');
 assert.equal(L.timeLeft('2026-10-18T23:59:30+02:00',monday.closes),'Mindre än 1 min kvar');
 assert.equal(L.timeLeft(monday.closes,monday.closes),'Röstningen är stängd');
});
test('race copy describes the current leader without treating a tie as a winner',()=>{
 const options=[{id:0,title:'Promenad',votes:1},{id:1,title:'Yoga',votes:2},{id:2,title:'Styrka',votes:0},{id:3,title:'Simning',votes:0}];
 assert.match(L.race({options,own_vote:1}).title,/Din favorit leder/);
 assert.match(L.race({options,own_vote:0}).title,/Yoga leder/);
 assert.match(L.race({options:options.map(o=>({...o,votes:1})),own_vote:0}).title,/Jämnt/);
 assert.match(L.race({options:options.map(o=>({...o,votes:0})),own_vote:null}).copy,/Första rösten/);
});
test('workout symbols handle Swedish titles and unknown bingo activities',()=>{
 assert.equal(L.iconKind('Yoga / rörlighet'),'mobility');assert.equal(L.iconKind('100 squats'),'strength');assert.equal(L.iconKind('Mobilfri promenad'),'walk');assert.equal(L.iconKind('Simning'),'swim');assert.equal(L.iconKind('Valfritt pass'),'activity');
});

test('voting completion replaces the old result without counting votes as training',()=>{
 const day={...monday,options:[{id:0,title:'Promenad',description:'Gå 5 km',votes:1}],result:{option_id:0},completion:{points:3,completed_at:'2026-10-19T12:00:00+02:00'}};
 const rows=L.mergeResults([{result_date:'2026-10-01',points:1},{result_date:day.date,points:2,multiplier:3}],{days:[day]});
 assert.equal(rows.length,2);assert.equal(rows[1].points,3);assert.equal(rows[1].kind,'vote');assert.equal(rows[1].multiplier,null);assert.equal(rows[1].description,'Gå 5 km');
 assert.equal(L.mergeResults(rows,{days:[{...day,completion:null}]}).length,1,'Undo removes only the theme result');
});

test('daily poll opens exactly at 15:00 Swedish time',()=>{
 const state={now:'2026-10-19T14:59:59+02:00',today:'2026-10-19',days:[tuesday]};
 assert.equal(L.view(state).poll,undefined);assert.equal(L.view({...state,now:tuesday.opens}).poll,tuesday);
});

test('steps alternative appears as one point with its own title in history',()=>{
 const day={...monday,options:[{id:0,title:'Styrka',description:'Kör passet',votes:1}],result:{option_id:0},completion:{kind:'steps',points:1}};
 const rows=L.mergeResults([{result_date:day.date,kind:'vote',points:3}],{days:[day]});
 assert.equal(rows.length,1);assert.equal(rows[0].points,1);assert.equal(rows[0].completion_kind,'steps');assert.equal(rows[0].title,'10 000 steg');assert.match(rows[0].description,/istället/);
});

test('all new set-based workouts use the strength illustration',()=>{
 for(const title of ['3 × 15 squats','3 × 10 armhävningar','3 × 5 pull-ups'])assert.equal(L.iconKind(title),'strength');
});

test('Sunday roulette remains available alongside the ballot until midnight, with saved-day access afterwards',()=>{
 assert.equal(L.rouletteAvailable('2026-10-18',null),true);assert.equal(L.rouletteAvailable('2026-10-19',null),false);assert.equal(L.rouletteAvailable('2026-10-19','2026-10-18'),true);assert.equal(L.rouletteAvailable('2026-10-19','2026-10-19'),false);
});
