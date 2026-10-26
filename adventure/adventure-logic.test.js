const test = require('node:test');
const assert = require('node:assert/strict');
const adventure = require('./adventure-logic.js');

function reachCheckpoint(state, count, date = '2026-10-26') {
  for (let i = adventure.progress(state).position; i < count; i += 1) {
    state = adventure.record(state, adventure.EXERCISES[i % adventure.EXERCISES.length].id, date, `step-${state.events.length + 1}`);
  }
  return state;
}

test('board has 60 steps and six checkpoints over the six-day prototype window', () => {
  assert.equal(adventure.BOARD_SIZE, 60);
  assert.equal(adventure.START_DATE, '2026-10-26');
  assert.equal(adventure.END_DATE, '2026-10-31');
  assert.deepEqual(adventure.BOSSES.map((boss) => boss.position), [6, 12, 24, 36, 48, 60]);
  assert.equal(adventure.BOSSES.length, 6);
  assert.ok(adventure.EXERCISES.every((exercise) => exercise.provisional));
  assert.ok(Object.isFrozen(adventure.BOSSES) && Object.isFrozen(adventure.BOSSES[0].choices[0]));
});

test('each exercise advances one step and a boss blocks further progress until resolved', () => {
  let state = reachCheckpoint(adventure.createState(), 5);
  state = adventure.record(state, 'running', '2026-10-27', 'step-6');
  assert.equal(adventure.progress(state).position, 6);
  assert.equal(adventure.progress(state).pendingBoss.id, 'troll');
  assert.throws(() => adventure.record(state, 'squats', '2026-10-27', 'blocked'), /Resolve the boss/);
  assert.throws(() => adventure.resolveBoss(state, 'witch', 'handstand', '2026-10-27', 'wrong-boss'));
  assert.throws(() => adventure.resolveBoss(state, 'troll', 'missing', '2026-10-27', 'wrong-choice'));
  state = adventure.resolveBoss(state, 'troll', 'somersault', '2026-10-27', 'boss-1');
  assert.equal(adventure.progress(state).pendingBoss, null);
  assert.equal(adventure.progress(state).bossesDefeated, 1);
  assert.equal(adventure.progress(state).position, 6);
});

test('serialized state restores across days and preserves totals and a pending boss', () => {
  let state = reachCheckpoint(adventure.createState(), 6, '2026-10-26');
  const restored = adventure.restore(JSON.stringify(state));
  assert.deepEqual(restored, state);
  assert.equal(adventure.progress(restored).pendingBoss.id, 'troll');
  assert.deepEqual(adventure.totals(restored, '2026-10-26'), {
    steps: 6, squats: 30, pushups: 20, pullups: 5, running: 1,
  });
  state = adventure.resolveBoss(restored, 'troll', 'somersault', '2026-10-28', 'boss-1');
  state = adventure.record(state, 'pushups', '2026-10-28', 'step-7');
  assert.equal(adventure.progress(adventure.restore(state)).position, 7);
  assert.deepEqual(adventure.totals(state, '2026-10-28'), {
    steps: 1, squats: 0, pushups: 10, pullups: 0, running: 0,
  });
});

test('restore rejects malformed, duplicated, bypassed, and overlong histories', () => {
  const exercise = (id, exerciseId = 'squats') => ({ id, type: 'exercise', exerciseId, date: '2026-10-26' });
  const boss = (id, bossId = 'troll', choiceId = 'somersault') => ({ id, type: 'boss', bossId, choiceId, date: '2026-10-26' });
  assert.equal(adventure.restore('{bad json'), null);
  assert.equal(adventure.restore({ version: 99, events: [] }), null);
  assert.equal(adventure.restore({ version: 1, events: [exercise('1'), exercise('1')] }), null);
  assert.equal(adventure.restore({ version: 1, events: [boss('boss-early')] }), null);
  assert.equal(adventure.restore({ version: 1, events: [...Array.from({ length: 7 }, (_, i) => exercise(`s${i}`)), boss('boss-1')] }), null);
  assert.equal(adventure.restore({ version: 1, events: [exercise('1', 'not-an-exercise')] }), null);
  assert.equal(adventure.restore({ version: 1, events: [exercise('1'), { ...exercise('2'), date: '2026-02-30' }] }), null);
  assert.equal(adventure.restore({ version: 1, events: Array(43).fill(exercise('x')) }), null);
});

test('undo last event reopens a defeated boss, then removes the step and clears its gate', () => {
  let state = reachCheckpoint(adventure.createState(), 6);
  state = adventure.resolveBoss(state, 'troll', 'somersault', '2026-10-26', 'boss-1');
  state = adventure.undo(state);
  assert.equal(adventure.progress(state).pendingBoss.id, 'troll');
  assert.deepEqual(adventure.progress(state).completedBossIds, []);
  state = adventure.undo(state);
  assert.equal(adventure.progress(state).position, 5);
  assert.equal(adventure.progress(state).pendingBoss, null);
  assert.equal(adventure.progress(state).steps, 5);
});

test('the final checkpoint stays gated until its boss is resolved, then marks the board finished', () => {
  let state = adventure.createState();
  for (let i = 1; i <= adventure.BOARD_SIZE; i += 1) {
    state = adventure.record(state, adventure.EXERCISES[(i - 1) % adventure.EXERCISES.length].id, '2026-10-31', `step-${i}`);
    if (adventure.BOSSES.some(boss => boss.position === i)) {
      const boss = adventure.BOSSES.find((item) => item.position === i);
      assert.equal(adventure.progress(state).pendingBoss.id, boss.id);
      assert.equal(adventure.progress(state).finished, false);
      state = adventure.resolveBoss(state, boss.id, boss.choices[0].id, '2026-10-31', `boss-${i}`);
    }
  }
  assert.equal(adventure.progress(state).position, 60);
  assert.equal(adventure.progress(state).bossesDefeated, 6);
  assert.equal(adventure.progress(state).finished, true);
  assert.throws(() => adventure.record(state, 'squats', '2026-10-31', 'extra'));
});

test('avatar assignment is stable and indexed sample identities get unique animal mounts', () => {
  assert.equal(adventure.stableHash('player-a'), adventure.stableHash('player-a'));
  assert.deepEqual(adventure.avatarFor('player-a'), adventure.avatarFor('player-a'));
  const mounts = Array.from({ length: 12 }, (_, index) => adventure.avatarFor(`player-${index}`, index).animal);
  assert.equal(new Set(mounts).size, 12);
});


test('each boss has one untimed group mission', () => {
  assert.deepEqual(adventure.BOSSES.map(boss => boss.choices.map(choice => choice.id)), [
    ['somersault'], ['handstand'], ['morning-walk'], ['ball-juggling'], ['bottle-flip'], ['victory-jump'],
  ]);
  assert(adventure.BOSSES.every(boss => !('durationSeconds' in boss.choices[0])));
});

test('both old A/B save histories migrate without losing progress, while new completions require the current task', () => {
  const oldChoices = [
    ['balance', 'seated-balance'], ['shoulders', 'arms'], ['heel-raise', 'seated-feet'],
    ['chair-sit', 'seated-reach'], ['step-touch', 'seated-steps'], ['breathing', 'walk'],
  ];
  for (const variant of [0, 1]) {
    const raw = { version: 1, events: [] };
    adventure.BOSSES.forEach((boss, index) => {
      for (let i = 0; i < 6; i++) raw.events.push({ id: 's' + raw.events.length, type: 'exercise', exerciseId: 'squats', date: '2026-10-31' });
      raw.events.push({ id: 'b' + index, type: 'boss', bossId: boss.id, choiceId: oldChoices[index][variant], date: '2026-10-31' });
    });
    const original = JSON.stringify(raw);
    const migrated = adventure.restore(original);
    assert.equal(adventure.progress(migrated).position, 60);
    assert.equal(adventure.progress(migrated).bossesDefeated, 6);
    assert.equal(adventure.progress(migrated).finished, true);
    assert.deepEqual(migrated.events.filter(event => event.type === 'boss').map(event => event.choiceId), adventure.BOSSES.map(boss => boss.choices[0].id));
    assert.equal(JSON.stringify(raw), original);
    assert.deepEqual(adventure.restore(JSON.stringify(migrated)), migrated);
  }
  const pending = reachCheckpoint(adventure.createState(), 6);
  assert.throws(() => adventure.resolveBoss(pending, 'troll', 'balance', '2026-10-26'));
  assert.throws(() => adventure.resolveBoss(pending, 'troll', 'seated-balance', '2026-10-26'));
  const invalid = JSON.parse(JSON.stringify(pending));
  invalid.events.push({ id: 'bad-boss', type: 'boss', bossId: 'troll', choiceId: 'arms', date: '2026-10-26' });
  assert.equal(adventure.restore(invalid), null, 'A legacy choice from a different boss cannot bypass the current gate');
});


function reachCastle(date = '2026-10-26') {
  let state = adventure.createState();
  for (const boss of adventure.BOSSES) {
    state = reachCheckpoint(state, boss.position, date);
    if (boss.id !== 'final') state = adventure.resolveBoss(state, boss.id, boss.choices[0].id, date, 'boss-' + boss.id);
  }
  return state;
}

test('the first five bosses block scoring; arriving at the castle unlocks it with zero points', () => {
  let state = adventure.createState();
  for (const boss of adventure.BOSSES.slice(0, -1)) {
    state = reachCheckpoint(state, boss.position);
    assert.equal(adventure.scoreTotals(state).points, 0);
    assert.equal(adventure.canScore(state, '2026-10-26'), false);
    assert.throws(() => adventure.recordScore(state, 'squats', '2026-10-26'), /Reach the castle/);
    const forged = JSON.parse(JSON.stringify(state));
    forged.events.push({ id: 'premature-points', type: 'score', exerciseId: 'squats', date: '2026-10-26' });
    assert.equal(adventure.restore(forged), null);
    state = adventure.resolveBoss(state, boss.id, boss.choices[0].id, '2026-10-26');
  }
  assert.equal(adventure.canScore(state, '2026-10-26'), false);
  state = reachCheckpoint(state, 60);
  assert.equal(adventure.progress(state).pendingBoss.id, 'final');
  assert.equal(adventure.progress(state).finished, false);
  assert.equal(adventure.progress(state).pointsUnlocked, true);
  assert.equal(adventure.progress(state).pointsUnlockedOn, '2026-10-26');
  assert.equal(adventure.scoreTotals(state).points, 0);
  assert.equal(adventure.canScore(state, '2026-10-26'), true);
});

test('post-arrival exercise units award one point while the final boss is still waiting', () => {
  let state = reachCastle();
  const journeyTotals = adventure.totals(state);
  for (const exercise of adventure.SCORING_EXERCISES) state = adventure.recordScore(state, exercise.id, '2026-10-26', 'point-' + exercise.id);
  assert.deepEqual(adventure.scoreTotals(state), { points: 4, squats: 15, pushups: 10, pullups: 5, running: 1 });
  assert.deepEqual(adventure.totals(state), journeyTotals);
  assert.equal(adventure.progress(state).position, 60);
  assert.equal(adventure.progress(state).bossesDefeated, 5);
  assert.equal(adventure.progress(state).pendingBoss.id, 'final');
  assert.equal(state.events.length, 69);
  assert.deepEqual(adventure.restore(JSON.stringify(state)), state);
});

test('the final boss can only open or be completed on October 31', () => {
  const state = reachCastle();
  assert.equal(adventure.isBossOpen('troll', '2026-10-26'), true);
  assert.equal(adventure.isBossOpen('final', '2026-10-30'), false);
  assert.equal(adventure.isBossOpen('final', '2026-10-31'), true);
  assert.equal(adventure.isBossOpen('final', '2026-11-01'), false);
  assert.equal(adventure.isBossOpen('missing', '2026-10-31'), false);
  for (const date of ['2026-10-26', '2026-10-30', '2026-11-01']) {
    assert.throws(() => adventure.resolveBoss(state, 'final', 'victory-jump', date), /31 October/);
    const forged = JSON.parse(JSON.stringify(state));
    forged.events.push({ id: 'early-final', type: 'boss', bossId: 'final', choiceId: 'victory-jump', date });
    assert.equal(adventure.restore(forged), null, 'Current-format saves cannot bypass the final date lock');
  }
});

test('points earned before the final survive completing and undoing the final boss', () => {
  let state = adventure.recordScore(reachCastle(), 'squats', '2026-10-27', 'p1');
  state = adventure.recordScore(state, 'running', '2026-10-30', 'p2');
  state = adventure.resolveBoss(state, 'final', 'victory-jump', '2026-10-31', 'final');
  assert.equal(adventure.progress(state).finished, true);
  assert.equal(adventure.scoreTotals(state).points, 2, 'The final gives no additional points');
  assert.equal(adventure.progress(state).pointsUnlockedOn, '2026-10-26');
  state = adventure.undo(state);
  assert.equal(adventure.progress(state).finished, false);
  assert.equal(adventure.progress(state).pendingBoss.id, 'final');
  assert.equal(adventure.canScore(state, '2026-10-30'), true);
  assert.equal(adventure.scoreTotals(state).points, 2);
  state = adventure.resolveBoss(state, 'final', 'victory-jump', '2026-10-31', 'final-again');
  state = adventure.recordScore(state, 'pullups', '2026-10-31', 'p3');
  assert.equal(adventure.scoreTotals(state).points, 3);
  assert.deepEqual(adventure.restore(JSON.stringify(state)), state);
});

test('daily points persist across days and cannot predate arrival or extend past the theme', () => {
  let state = reachCastle('2026-10-28');
  state = adventure.recordScore(state, 'squats', '2026-10-28', 'p1');
  state = adventure.recordScore(state, 'pushups', '2026-10-28', 'p2');
  state = adventure.recordScore(state, 'running', '2026-10-30', 'p3');
  const restored = adventure.restore(JSON.stringify(state));
  assert.deepEqual(adventure.scoreTotals(restored, '2026-10-28'), { points: 2, squats: 15, pushups: 10, pullups: 0, running: 0 });
  assert.equal(adventure.scoreTotals(restored, '2026-10-30').points, 1);
  assert.equal(adventure.scoreTotals(restored).points, 3);
  assert.equal(adventure.scoreTotals(restored, '2026-10-29').points, 0);
  assert.equal(adventure.canScore(restored, '2026-10-31'), true);
  for (const date of ['2026-10-25', '2026-10-27', '2026-11-01', '2026-02-30']) {
    assert.equal(adventure.canScore(restored, date), false);
    assert.throws(() => adventure.recordScore(restored, 'squats', date));
  }
  assert.throws(() => adventure.recordScore(restored, 'unknown', '2026-10-28'), /Unknown/);
  assert.throws(() => adventure.recordScore(restored, 'squats', '2026-10-28', 'p1'), /unique/);
});

test('undoing arrival relocks scoring, while undoing points leaves the pawn at the castle', () => {
  let state = adventure.recordScore(reachCastle(), 'running', '2026-10-27', 'p1');
  state = adventure.undo(state);
  assert.equal(adventure.scoreTotals(state).points, 0);
  assert.equal(adventure.progress(state).position, 60);
  assert.equal(adventure.canScore(state, '2026-10-27'), true);
  state = adventure.undo(state);
  assert.equal(adventure.progress(state).position, 59);
  assert.equal(adventure.progress(state).pointsUnlocked, false);
  assert.equal(adventure.canScore(state, '2026-10-27'), false);
  assert.throws(() => adventure.recordScore(state, 'squats', '2026-10-27'), /Reach the castle/);
  state = adventure.record(state, 'running', '2026-10-28');
  assert.equal(adventure.canScore(state, '2026-10-27'), false);
  assert.equal(adventure.canScore(state, '2026-10-28'), true);
});

test('old early-final saves reopen the final and preserve arrival, exercises and points', () => {
  const old = { version:1,events:[] };
  adventure.BOSSES.forEach((boss,index)=>{for(let n=0;n<6;n++)old.events.push({id:'legacy-step-'+old.events.length,type:'exercise',exerciseId:['squats','pushups','pullups','running'][n%4],date:'2026-10-26',...(n%4===3?{distanceKm:1}:{})});if(index<5)old.events.push({id:'legacy-boss-'+index,type:'boss',bossId:boss.id,choiceId:boss.choices[0].id,date:'2026-10-26'});});
  old.events.push({ id: 'old-final', type: 'boss', bossId: 'final', choiceId: 'breathing', date: '2026-10-26' });
  old.events.push({ id: 'p1', type: 'score', exerciseId: 'squats', date: '2026-10-27' });
  old.events.push({ id: 'p2', type: 'score', exerciseId: 'running', date: '2026-10-28' });
  const original = JSON.stringify(old);
  const migrated = adventure.restore(original);
  assert.equal(migrated.version, 3);
  assert.equal(adventure.progress(migrated).position, 60);
  assert.equal(adventure.progress(migrated).pendingBoss.id, 'final');
  assert.equal(adventure.progress(migrated).bossesDefeated, 5);
  assert.equal(adventure.scoreTotals(migrated).points, 2);
  assert.equal(adventure.totals(migrated).steps, 36);
  assert.equal(JSON.stringify(old), original);
  assert.deepEqual(adventure.restore(JSON.stringify(migrated)), migrated);
});

test('new running steps are 1 km while old 2 km and 2.5 km save entries keep their distance', () => {
  let state = adventure.record(adventure.createState(), 'running', '2026-10-26', 'new-run');
  assert.equal(adventure.totals(state).running, 1);
  assert.equal(adventure.progress(state).position, 1);
  assert.equal(state.events[0].distanceKm, 1);
  for (const version of [1, 2]) {
    const previous = { version, events: [{ id: 'two-km-run', type: 'exercise', exerciseId: 'running', distanceKm: 2, date: '2026-10-26' }] };
    const oldState = adventure.restore(previous);
    assert.equal(adventure.totals(oldState).running, 2);
    assert.equal(adventure.progress(oldState).position, 1);
    const continued = adventure.record(oldState, 'running', '2026-10-27', 'one-km-run');
    assert.equal(adventure.totals(continued).running, 3);
    assert.equal(adventure.progress(continued).position, 2);
    assert.deepEqual(adventure.restore(JSON.stringify(continued)), continued);
  }
  const legacy = { version: 1, events: [{ id: 'old-run', type: 'exercise', exerciseId: 'running', date: '2026-10-26' }] };
  const restored = adventure.restore(legacy);
  assert.equal(adventure.totals(restored).running, 2.5);
  state = adventure.record(restored, 'running', '2026-10-27', 'new-run');
  assert.equal(adventure.totals(state).running, 3.5);
  assert.equal(adventure.progress(state).position, 2);
  assert.equal(adventure.scoreTotals(state).points, 0);
  assert.deepEqual(adventure.restore(JSON.stringify(state)), state);
});


test('route upgrade preserves partial progress and completed checkpoints without inventing exercises or points',()=>{
 for(const count of [0,6,12,15,18,24,30,36]){
  const old={version:2,events:[]};
  for(let i=1;i<=count;i++){old.events.push({id:'step-'+i,type:'exercise',exerciseId:'squats',date:'2026-10-26'});if(i%6===0&&i<36){const b=adventure.BOSSES[i/6-1];old.events.push({id:'boss-'+i,type:'boss',bossId:b.id,choiceId:b.choices[0].id,date:'2026-10-26'});}}
  const upgraded=adventure.restore(old);assert(upgraded);
  assert.deepEqual(upgraded.events,old.events);assert.equal(adventure.totals(upgraded).steps,count);assert.equal(adventure.scoreTotals(upgraded).points,0);
  assert.equal(adventure.progress(upgraded).position,count+6*[18,24,30,36].filter(n=>n<=count).length);
  assert.deepEqual(adventure.restore(JSON.stringify(upgraded)),upgraded);
 }
});

test('map credits are bounded, tied to existing exercise checkpoints and removed with undo',()=>{
 const e={id:'step',type:'exercise',exerciseId:'squats',date:'2026-10-26'};
 for(const credits of [{missing:6},{step:5},{step:6},[]])assert.equal(adventure.restore({version:3,events:[e],stepCredits:credits}),null);
 let old={version:2,events:[]};for(let i=1;i<=18;i++){old.events.push({...e,id:'s'+i});if(i===6||i===12){const b=adventure.BOSSES[i/6-1];old.events.push({id:'b'+i,type:'boss',bossId:b.id,choiceId:b.choices[0].id,date:e.date});}}
 let state=adventure.restore(old);assert.equal(adventure.progress(state).pendingBoss.id,'dragon');
 state=adventure.undo(state);assert.equal(adventure.progress(state).position,17);assert.deepEqual(state.stepCredits,{});
 for(let i=0;i<7;i++)state=adventure.record(state,'squats',e.date,'new'+i);assert.equal(adventure.progress(state).pendingBoss.id,'dragon');
});
