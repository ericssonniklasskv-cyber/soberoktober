const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('./adventure-logic.js');
const date='2026-10-27';
function reach(n,shortcut='keep',ride='keep') {
 let s=G.createState();
 while(G.progress(s).position<n) {const p=G.progress(s);if(p.pendingBoss)s=G.resolveBoss(s,p.pendingBoss.id,p.pendingBoss.choices[0].id,date);else if(p.position===21&&!s.shortcutChoice)s=G.chooseShortcut(s,shortcut,date);else if(p.position===28&&!s.rideChoice)s=G.chooseRide(s,ride,date);else s=G.record(s,'squats',date);}
 return s;
}
test('tile 33 take backs up exactly one tile without removing training or points',()=>{
 const before=reach(33),s=G.chooseIcecream(before,'take',date);
 assert.equal(G.progress(s).position,32);assert.equal(s.icecreamChoice,'take');assert.deepEqual(s.events,before.events);assert.deepEqual(G.totals(s),G.totals(before));assert.deepEqual(G.scoreTotals(s),G.scoreTotals(before));assert.equal(Object.values(s.stepCredits).filter(n=>n===-1).length,1);
});
test('tile 33 keep stays on 33, with no reward, loss or fabricated exercise',()=>{
 const before=reach(33),s=G.chooseIcecream(before,'keep',date);assert.equal(G.progress(s).position,33);assert.deepEqual(s.events,before.events);assert.deepEqual(s.stepCredits,before.stepCredits);assert.deepEqual(G.totals(s),G.totals(before));
});
test('either answer is permanent across reload and the next day',()=>{
 for(const choice of ['take','keep']) {let s=G.restore(JSON.stringify(G.chooseIcecream(reach(33),choice,date)));for(const other of ['take','keep'])assert.throws(()=>G.chooseIcecream(s,other,'2026-10-28'),/already saved/);if(choice==='take'){s=G.record(s,'pushups','2026-10-28');assert.equal(G.progress(s).position,33);}s=G.record(s,'running','2026-10-28');assert.equal(G.progress(s).position,34);assert.equal(s.icecreamChoice,choice);assert.equal(G.scoreTotals(s).points,0);}
});
test('repeated undo of arrival cannot reset the answer or stack the setback',()=>{
 for(const choice of ['take','keep']) {let s=G.chooseIcecream(reach(33),choice,date);for(let i=0;i<4;i++){s=G.undo(s);assert.equal(G.progress(s).position,32);assert.equal(s.icecreamChoice,choice);assert(!Object.values(s.stepCredits).includes(-1));s=G.record(s,'squats',date);assert.equal(G.progress(s).position,choice==='take'?32:33);assert.equal(Object.values(s.stepCredits).filter(n=>n===-1).length,choice==='take'?1:0);assert.throws(()=>G.chooseIcecream(s,'keep',date),/already saved/);}}
});
test('undo after returning to 33 keeps the already-applied setback',()=>{
 let s=G.chooseIcecream(reach(33),'take',date);s=G.record(s,'squats',date);for(let i=0;i<4;i++){s=G.undo(s);assert.equal(G.progress(s).position,32);assert.equal(Object.values(s.stepCredits).filter(n=>n===-1).length,1);s=G.record(s,'pullups',date);assert.equal(G.progress(s).position,33);}assert.equal(G.totals(s).steps,34);
});
test('all eight encounter combinations preserve later bosses and scoring at the castle',()=>{
 for(const shortcut of ['take','keep'])for(const ride of ['take','keep'])for(const choice of ['take','keep']) {
  let s=G.chooseIcecream(reach(33,shortcut,ride),choice,date);
  for(const boss of G.BOSSES.slice(3)){while(G.progress(s).position<boss.position)s=G.record(s,'running',date);assert.equal(G.progress(s).pendingBoss.id,boss.id);if(boss.id!=='final'){assert.throws(()=>G.record(s,'squats',date),/boss/);s=G.resolveBoss(s,boss.id,boss.choices[0].id,date);}}
  assert.equal(G.totals(s).steps,60-Number(shortcut==='take')-Number(ride==='take')+Number(choice==='take'));assert.equal(G.scoreTotals(s).points,0);s=G.recordScore(s,'squats',date);assert.equal(G.scoreTotals(s).points,1);assert.equal(G.restore(JSON.stringify(s)).icecreamChoice,choice);
 }
});
test('the trap cannot be selected at another tile, outside dates or with another answer',()=>{
 for(const n of [0,6,21,28,32,34,36])assert.throws(()=>G.chooseIcecream(reach(n),'take',date));for(const day of ['2026-10-25','2026-11-01','bad'])assert.throws(()=>G.chooseIcecream(reach(33),'take',day));assert.throws(()=>G.chooseIcecream(reach(33),'lick',date));
});
test('forged losses, wrong arrival, multiple losses and mismatched choices fail restore',()=>{
 const s=G.chooseIcecream(reach(33),'take',date),first=s.events[0].id;
 assert.equal(G.restore({...s,icecreamChoice:'keep'}),null);assert.equal(G.restore({...s,icecreamChoice:'fake'}),null);assert.equal(G.restore({...s,icecreamChoice:undefined}),null);assert.equal(G.restore({...s,stepCredits:{...s.stepCredits,[first]:-1}}),null);assert.equal(G.restore({...s,stepCredits:{[first]:-1}}),null);assert.equal(G.restore({...s,stepCredits:{...s.stepCredits,[first]:-2}}),null);
});
test('old current-version saves beyond 33 remain valid and are not penalized retroactively',()=>{
 for(const n of [18,28,33,34,36,60]) {const s=reach(n);assert(G.restore(JSON.stringify(s)));assert.equal(G.progress(s).position,n);assert.equal(s.icecreamChoice,undefined);assert.equal(Object.values(s.stepCredits).filter(n=>n<0).length,0);}
});
