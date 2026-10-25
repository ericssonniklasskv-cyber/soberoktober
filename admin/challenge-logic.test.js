const test = require('node:test'), assert = require('node:assert/strict');
const L = require('./challenge-logic.js');
test('bonus-only editing applies to bingo, roulette and voting, and the final week', () => {
  assert.equal(L.bonusOnly('2026-10-04'), false);
  for (const date of ['2026-10-05','2026-10-11','2026-10-12','2026-10-18','2026-10-19','2026-10-25']) assert.equal(L.bonusOnly(date), true);
  assert.equal(L.bonusOnly('2026-10-26'), true); assert.equal(L.bonusOnly('2026-10-31'), true); assert.equal(L.bonusOnly('2026-11-01'), false);
});
test('a roulette bonus creates a valid challenge without requiring a workout', () => {
  const result = L.bonusPayload('2026-10-12','Ta en promenad',1);
  assert.equal(result.title,'Dagens Spinn The Wheel!');
  assert.equal(result.base_amount,null);
  assert.equal(result.completion_mode,'single');
  assert.equal(result.bonus_description,'Ta en promenad');
  assert.equal(result.bonus_points,1);
});
test('bonus edits preserve any existing compound workout and can remove the bonus', () => {
  const existing = {title:'Sparat pass',description:'Del 1',unit:'steg',base_amount:10000,completion_mode:'and',second_description:'Del 2',second_base_amount:10,second_unit:'armhävningar',bonus_description:'Tidigare bonus',bonus_points:1};
  const saved = L.bonusPayload('2026-10-18','Ny bonus',3,existing);
  for (const key of ['title','description','unit','base_amount','completion_mode','second_description','second_base_amount','second_unit']) assert.deepEqual(saved[key],existing[key]);
  assert.equal(saved.bonus_points,3);
  const cleared = L.bonusPayload('2026-10-18','',null,existing);
  assert.equal(cleared.bonus_description,null);assert.equal(cleared.bonus_points,null);
  assert.throws(()=>L.bonusPayload('2026-11-01','Bonus',1), /vanligt/);
  assert.equal(L.bonusPayload('2026-10-26','Bonus',1).title,'Frestelsernas rike');
});

test('voting bonus needs no normal workout and preserves an existing admin challenge',()=>{
 const row=L.bonusPayload('2026-10-19','Gå ut i solen',2);assert.equal(row.title,'Dagens val');assert.equal(row.base_amount,null);assert.equal(row.description,null);assert.equal(row.bonus_points,2);
 const updated=L.bonusPayload('2026-10-25','Ny bonus',3,{...row,title:'Egen rubrik',description:'Sparad beskrivning',base_amount:10,unit:'steg'});assert.equal(updated.title,'Egen rubrik');assert.equal(updated.description,'Sparad beskrivning');assert.equal(updated.base_amount,10);
});
