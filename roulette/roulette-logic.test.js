const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('./roulette-logic.js');
const current = state => state.days[state.date];
const extra = (state, slot = 'extra:0') => R.slotTaskId(current(state), slot);
const roundTrip = state => R.restore(JSON.parse(JSON.stringify(state)));
const triple = () => R.combine(R.combine(R.spin(R.fresh(), 0), 'cardio', 0), 'mobility', 0);

test('21 example workouts retain their levels and instructions without a bonus task', () => {
  const tasks = Object.values(R.TASKS).flat();
  assert.equal(new Set(tasks.map(task => task.id)).size, 21);
  for (const [name, category] of Object.entries(R.TASKS)) {
    assert.equal(category.length, name === 'mobility' ? 3 : 9);
    assert.deepEqual([...new Set(category.map(task => task.level))].sort(), ['calm', 'spicy', 'steady']);
    for (const task of category) {
      assert(task.instructions.length >= 2);
      assert([2, 3, 4].includes(R.LEVELS[task.level].points));
      assert.equal(task.bonus, undefined);
    }
  }
  assert.equal(R.toggleBonus, undefined);
});
test('First draw per category is free and changing category does not alter existing workouts', () => {
  for (const category of Object.keys(R.CATEGORIES)) {
    const initial = R.fresh(), state = R.spin(R.chooseCategory(initial, category), .5);
    assert.equal(R.categoryFor(current(state).taskId), category);
    assert.equal(R.remaining(state), 5);
    assert.deepEqual(initial, R.fresh());
    assert.equal(current(R.chooseCategory(state, 'cardio')).taskId, current(state).taskId);
  }
});
test('Two additions make three unique workouts; a fourth is blocked before any change', () => {
  for (const category of Object.keys(R.CATEGORIES)) {
    const initial = R.spin(R.chooseCategory(R.fresh(), category), 0);
    const two = R.combine(initial, category, 0), three = R.combine(two, category, 0);
    assert.equal(R.taskIds(current(three)).length, 3);
    assert.equal(new Set(R.taskIds(current(three))).size, 3);
    assert(R.taskIds(current(three)).every(id => R.categoryFor(id) === category));
    assert.equal(current(three).taskId, current(initial).taskId);
    assert.equal(extra(three), extra(two));
    assert.equal(R.remaining(three), 5);
    assert.equal(R.nextExtraSlot(current(three)), null);
    const snapshot = JSON.stringify(three);
    assert.throws(() => R.combine(three, category, 0), /högst tre/);
    assert.equal(JSON.stringify(three), snapshot);
    assert.deepEqual(roundTrip(three), three);
    assert.equal(R.taskIds(current(two)).length, 2);
  }
});
test('Three categories sum their points only when the full round is completed; undo removes them', () => {
  let state = triple();
  const total = R.taskIds(current(state)).reduce((sum, id) => sum + R.LEVELS[R.getTask(id).level].points, 0);
  assert.equal(R.plannedPoints(current(state)), total);
  assert.equal(R.summary(state).total, 0);
  state = R.toggleCompleted(state);
  assert.equal(R.summary(state).total, total);
  assert.equal(R.dayPoints(current(roundTrip(state))), total);
  assert.equal(R.summary(state).days, 1);
  assert.throws(() => R.combine(state, 'strength', 0));
  assert.throws(() => R.replaceExtra(state, 'strength', 0, 'extra:1'));
  assert.throws(() => R.removeExtra(state, 'extra:1'));
  state = R.toggleCompleted(state);
  assert.equal(R.summary(state).total, 0);
  assert.equal(R.summary(state).days, 0);
});
test('All three parts share five rerolls and replacing one preserves the other two', () => {
  let state = triple();
  for (let index = 0; index < 5; index++) {
    const slot = ['primary', 'extra:0', 'extra:1'][index % 3];
    const before = R.taskEntries(current(state));
    state = slot === 'primary' ? R.spin(state, .5) : R.rerollExtra(state, .5, slot);
    for (const item of before) {
      if (item.slot === slot) assert.notEqual(R.slotTaskId(current(state), slot), item.id);
      else assert.equal(R.slotTaskId(current(state), item.slot), item.id);
    }
    assert.equal(R.remaining(state), 4 - index);
    assert.deepEqual(roundTrip(state), state);
  }
  assert.throws(() => R.spin(state, 0), /frispinn/);
  assert.throws(() => R.rerollExtra(state, 0, 'extra:1'), /frispinn/);
});
test('Same-category replacements never duplicate either of the other selected workouts', () => {
  let state = R.combine(R.combine(R.spin(R.fresh(), 0), 'strength', 0), 'strength', 0);
  for (const slot of ['extra:1', 'primary', 'extra:0']) {
    state = slot === 'primary' ? R.spin(state, 0) : R.rerollExtra(state, 0, slot);
    assert.equal(new Set(R.taskIds(current(state))).size, 3);
  }
});
test('Removing the middle workout preserves the third and retains that slot’s category history', () => {
  let state = triple();
  const third = extra(state, 'extra:1');
  state = R.removeExtra(state, 'extra:0');
  assert.equal(R.taskIds(current(state)).length, 2);
  assert.equal(extra(state, 'extra:1'), third);
  assert.equal(R.nextExtraSlot(current(state)), 'extra:0');
  assert.equal(R.remaining(state), 5);
  state = R.combine(roundTrip(state), 'cardio', 0);
  assert.equal(R.remaining(state), 4, 'Reusing the removed slot/category costs a frispinn');
  assert.equal(extra(state, 'extra:1'), third);
  state = R.removeExtra(state, 'extra:1');
  state = R.combine(roundTrip(state), 'strength', 0);
  assert.equal(R.remaining(state), 4, 'A new category in that slot still has its free first draw');
  state = R.removeExtra(state, 'extra:1');
  state = R.combine(roundTrip(state), 'mobility', 0);
  assert.equal(R.remaining(state), 3);
});
test('Switching back to a used category costs credit independently for each slot', () => {
  let state = triple();
  for (const category of ['cardio', 'mobility', 'strength']) state = R.spin(R.chooseCategory(state, category), 0);
  assert.equal(R.remaining(state), 4);
  state = R.replaceExtra(state, 'mobility', 0, 'extra:0');
  state = R.replaceExtra(state, 'cardio', 0, 'extra:0');
  assert.equal(R.remaining(state), 3);
  state = R.replaceExtra(state, 'strength', 0, 'extra:1');
  state = R.replaceExtra(roundTrip(state), 'mobility', 0, 'extra:1');
  assert.equal(R.remaining(state), 2);
});
test('Zero credit still allows both additional slots and categories not drawn for that slot', () => {
  let state = R.spin(R.fresh(), 0);
  for (let i = 0; i < 5; i++) state = R.spin(state, .4);
  state = R.combine(state, 'strength', 0);
  state = R.combine(state, 'strength', 0);
  assert.equal(R.remaining(state), 0);
  state = R.replaceExtra(state, 'mobility', 0, 'extra:1');
  assert.equal(R.remaining(state), 0);
  assert.throws(() => R.replaceExtra(state, 'strength', 0, 'extra:1'), /frispinn/);
  assert.equal(R.remaining(R.spin(R.changeDate(state, R.DATES[1]), 0)), 0);
});
test('Reload or revisiting a day never refreshes that day’s draw history or weekly credits', () => {
  let state = R.spin(R.fresh(), 0);
  const first = current(state).taskId;
  state = R.spin(R.changeDate(state, R.DATES[1]), .5);
  state = R.changeDate(roundTrip(state), R.DATES[0]);
  assert.equal(current(state).taskId, first);
  state = R.spin(state, .4);
  assert.equal(R.remaining(state), 4);
});
test('New rounds after one or two completed workouts share the daily limit of three', () => {
  for(const firstCount of [1,2]){
    let state=R.spin(R.fresh(),0);
    if(firstCount===2)state=R.combine(state,'cardio',0);
    state=R.toggleCompleted(state);const earned=R.summary(state).total;
    assert.equal(R.completedWorkouts(current(state)),firstCount);assert(R.canStartRound(current(state)));
    state=R.spin(R.chooseCategory(roundTrip(state),'mobility'),0);
    assert.equal(R.archivedWorkouts(current(state)),firstCount);assert.equal(R.summary(state).total,earned);
    assert.deepEqual(current(state).checkedSteps,[]);assert.equal(current(state).trainingStarted,false);
    if(firstCount===1){assert(R.nextExtraSlot(current(state)));state=R.combine(state,'strength',0);}
    assert.equal(R.nextExtraSlot(current(state)),null);
    assert.throws(()=>R.combine(state,'cardio',0),/högst tre/);
    const currentPoints=R.plannedPoints(current(state));state=R.toggleCompleted(state);
    assert.equal(R.completedWorkouts(current(state)),3);assert.equal(R.summary(state).total,earned+currentPoints);
    assert.equal(R.canStartRound(current(state)),false);assert.throws(()=>R.spin(roundTrip(state),0),/dagens tre pass/);
    state=R.toggleCompleted(state);assert.equal(R.summary(state).total,earned,'Undo affects only the latest round');
    state=R.toggleCompleted(state);assert.equal(R.completedWorkouts(current(state)),3,'Repeated completion does not double-count');
    const next=R.spin(R.changeDate(state,R.DATES[1]),0);assert.equal(R.taskIds(current(next)).length,1);
    const revisit=R.changeDate(roundTrip(next),R.DATES[0]);assert.throws(()=>R.spin(revisit,0),/dagens tre pass/);
  }
});
test('Three separate one-workout rounds stop at three, including after reload and category change', () => {
  let state=R.fresh();
  for(const category of ['strength','cardio','mobility']){
    state=R.toggleCompleted(R.spin(R.chooseCategory(roundTrip(state),category),0));
    assert.equal(current(state).checkedSteps.length,0);
  }
  assert.equal(R.completedWorkouts(current(state)),3);assert.equal(R.remaining(state),5);
  const snapshot=JSON.stringify(state);
  for(const category of Object.keys(R.CATEGORIES)){
    assert.equal(R.availableTasks(state,category).length,0);
    assert.throws(()=>R.spin(R.chooseCategory(state,category),0),/dagens tre pass/);
  }
  assert.equal(JSON.stringify(state),snapshot);
});
test('Three combined workouts close the day without spending credits or losing their checks', () => {
  let state=triple();state=R.setStepChecked(state,R.checklistItems(current(state))[0].key,true);
  state=R.toggleCompleted(state);const snapshot=JSON.stringify(state);
  assert.equal(R.completedWorkouts(current(state)),3);assert.equal(R.canStartRound(current(state)),false);
  assert.throws(()=>R.spin(state,0),/dagens tre pass/);assert.equal(JSON.stringify(state),snapshot);
  assert.equal(R.remaining(state),5);assert.equal(R.checklistSummary(current(roundTrip(state))).done,1);
});
test('Week totals include completed workouts only, with no bonus increment', () => {
  let state = R.fresh();
  for (const [i, category] of Object.keys(R.CATEGORIES).entries()) {
    state = R.changeDate(state, R.DATES[i]);
    state = R.toggleCompleted(R.spin(R.chooseCategory(state, category), i === 2 ? .4 : 0));
  }
  assert.deepEqual(R.summary(state), { days: 3, workoutPoints: 7, total: 7, remaining: 5 });
});
test('Previous two-pass storage migrates without losing selected tasks, completed rounds or frispinn', () => {
  const old = {version:1,date:R.DATES[0],category:'strength',days:{[R.DATES[0]]:{
    taskId:'s1',extraTaskId:'c1',rerolls:2,completed:true,bonus:true,
    primaryDraws:{strength:'s1'},extraDraws:{cardio:'c1'},extraDrawn:true,
    completedRounds:[{taskId:'m4',bonus:true}]
  }}};
  const state = R.restore(old);
  assert.deepEqual(R.taskIds(current(state)), ['s1','c1']);
  assert.equal(R.remaining(state), 3);
  assert.equal(R.summary(state).total, 8, 'Retired bonus points are excluded');
  assert.equal(current(state).bonus, undefined);
  assert.equal(R.spinCost(state, 'cardio', 'extra:0'), 1);
  assert.equal(R.completedWorkouts(current(state)),3);
  assert.throws(()=>R.combine(R.toggleCompleted(state),'mobility',0),/högst tre/);
  assert.equal(R.remaining(state),3);
  assert.equal(old.days[old.date].bonus, true, 'Migration leaves the input intact');
  const removed = R.restore({...old, days:{[old.date]:{taskId:'s1',completed:false,bonus:false,rerolls:1,extraDraws:{cardio:'c1'},extraDrawn:true}}});
  assert.equal(R.spinCost(removed, 'cardio', 'extra:0'), 1, 'Removed legacy slot retains its history');
});
test('Invalid tasks, duplicate combinations, fourth slots and corrupted histories fail restoration', () => {
  const state = triple();
  for (const changes of [
    {extraSlots:[{taskId:current(state).taskId,draws:{strength:current(state).taskId}}]},
    {extraSlots:[{taskId:'unknown',draws:{}}]},
    {extraSlots:[null]},
    {extraSlots:[{draws:{}},{draws:{}},{draws:{}}]},
    {extraSlots:[{taskId:'c1',draws:{}}]},
    {extraSlots:[{draws:{strength:'c1'}}]},
    {primaryDraws:{}},
    {completedRounds:[{taskId:'s1',extraTaskIds:['c1','m1','s2']}]},
    {completedRounds:[{taskId:'s1',extraTaskIds:['s1']}]},
    {completedRounds:[{taskId:'unknown'}]},
    {completedRounds:{}}
  ]) {
    const bad = structuredClone(state); Object.assign(current(bad), changes);
    assert.throws(() => R.restore(bad));
  }
  for (const raw of [null, {}, {...state,date:'2026-11-01'}, {...state,category:'other'}, {...state,days:[]}, {...state,days:{[state.date]:{taskId:'s1',rerolls:6,completed:false}}}]) assert.throws(() => R.restore(raw));
});
test('Invalid draws and edits fail without changing the state', () => {
  const state = triple(), snapshot = JSON.stringify(state);
  for (const value of [-1,1,NaN,Infinity]) {
    assert.throws(() => R.spin(state,value));
    assert.throws(() => R.rerollExtra(state,value,'extra:1'));
  }
  assert.throws(() => R.changeDate(state,'2026-10-19'));
  assert.throws(() => R.chooseCategory(state,'other'));
  assert.throws(() => R.spinCost(state,'strength','extra:2'));
  assert.throws(() => R.combine(R.fresh(),'cardio',0));
  assert.throws(() => R.toggleCompleted(R.fresh()));
  assert.equal(JSON.stringify(state),snapshot);
});
test('Every wheel stop lands on the selected segment after arbitrary previous rotations', () => {
  for (const count of [3,8,9]) for (let current=0; current<3000; current+=143) for (let index=0; index<count; index++) {
    const next=R.landingRotation(current,index,5,count);
    assert(next>=current+1800); assert.equal((next+index*(360/count))%360,0);
  }
});

test('Strength has one checkbox per exercise and set, including the three-exercise leg day', () => {
  const expected = {calm:[2,2],steady:[3,3],spicy:[5,3]};
  for (const task of R.TASKS.strength) {
    const [exercises,sets] = task.id === 's7c' ? [3,3] : expected[task.level], steps = R.checklistItems({taskId:task.id});
    assert.equal(task.exercises.length,exercises);assert.equal(task.sets,sets);
    assert.equal(steps.length,exercises*sets);
    for (const text of task.exercises) assert.equal(steps.filter(step=>step.text===text).length,sets);
    assert.equal(new Set(steps.map(step=>step.key)).size,steps.length);
    assert(R.checklistNotes(task.id).includes('Eller motsvarande övningar på gym.'));
    assert(task.instructions.includes('Eller motsvarande övningar på gym.'));
    assert(!steps.some(step=>/Vila|gym|knä går/.test(step.text)),'Advice is separate from actual exercises');
  }
  const base=R.TASKS.strength[0];
  assert.deepEqual(base.exercises,['15 squats.','10 armhävningar.']);
  assert.equal(R.checklistItems({taskId:base.id})[0].lead,'Övning 1 av 2 · Set 1 av 2');
});
test('Cardio uses calm walks, easy jogs and harder intervals; jogging has an alternative form', () => {
  for (const task of R.TASKS.cardio) {
    const steps=R.checklistItems({taskId:task.id});
    if(task.level==='calm'){
      assert.equal(steps.length,1);assert(/lugn promenad/.test(steps[0].text));
      assert(!/jogg|cykel|dansa/.test(steps[0].text));
    }else{
      assert(task.instructions.includes('Eller motsvarande i annan konditionsform, till exempel simning eller cykling.'));
      assert(R.checklistNotes(task.id).some(text=>text.includes('annan konditionsform')));
      assert(!steps.some(step=>step.text.includes('annan konditionsform')));
      if(task.level==='steady'){assert.equal(steps.length,1);assert.equal(steps[0].text,(task.title==='Hitta joggen'?'Jogga i bra tempo i ':'Jogga lugnt i ')+parseInt(task.duration)+' minuter.');}
      else assert(steps.some(step=>/hård jogg|ansträngande tempo/.test(step.text)));
    }
  }
  assert.equal(R.checklistItems({taskId:'c4c'}).filter(step=>step.lead?.startsWith('Intervall')).length,6);
  assert.equal(R.checklistItems({taskId:'c7b'}).filter(step=>step.lead?.startsWith('Intervall')).length,3);
});
test('Mobility has exactly 10, 20 and 30 minutes with a participant-chosen Youtube video', () => {
  assert.deepEqual(R.TASKS.mobility.map(task=>task.duration),['10 min','20 min','30 min']);
  for(const task of R.TASKS.mobility){
    const steps=R.checklistItems({taskId:task.id});assert.equal(steps.length,1);
    assert(steps[0].text.includes('valfri Youtubevideo'));
    assert(steps[0].text.includes(parseInt(task.duration)+' minuter'));
    assert(R.checklistNotes(task.id).some(text=>text.includes('Välj själv')));
  }
});
test('Three selected mobility workouts block rerolls without mutating checks or spending credit', () => {
  let state=R.combine(R.combine(R.spin(R.chooseCategory(R.fresh(),'mobility'),0),'mobility',0),'mobility',0);
  state=R.setStepChecked(state,R.checklistItems(current(state))[0].key,true);
  const snapshot=JSON.stringify(state);
  for(const slot of ['primary','extra:0','extra:1']){
    assert.equal(R.availableTasks(state,'mobility',slot).length,0);
    assert.throws(()=>slot==='primary'?R.spin(state,0):R.rerollExtra(state,0,slot),/Alla pass/);
  }
  assert.equal(JSON.stringify(state),snapshot);assert.equal(R.remaining(state),5);
  const changed=R.replaceExtra(state,'cardio',0,'extra:0');
  assert.equal(R.remaining(changed),5);assert.equal(R.availableTasks(changed,'mobility','primary').length,1);
  assert.equal(R.remaining(R.spin(changed,0)),4);
  const removed=R.removeExtra(state,'extra:1');
  assert.equal(R.availableTasks(removed,'mobility','primary').length,1);
  const complete=R.toggleCompleted(state);assert.throws(()=>R.spin(complete,0),/dagens tre pass/);
  assert.equal(R.summary(complete).total,R.plannedPoints(current(complete)));
});
test('Old v2 workouts, checks, histories and completed points survive the new catalog', () => {
  const old={version:2,date:R.DATES[0],category:'strength',days:{[R.DATES[0]]:{
    taskId:'s1',rerolls:2,completed:false,primaryDraws:{strength:'s1'},
    checkedSteps:['s1:0:0'],trainingStarted:true,completedRounds:[{taskId:'m7',extraTaskIds:['c3']}]
  }}};
  const snapshot=JSON.stringify(old), state=R.restore(old);
  assert.equal(state.version,R.VERSION);assert.equal(current(state).taskId,'s1');
  assert.deepEqual(current(state).checkedSteps,['s1:0:0']);assert.equal(R.checklistSummary(current(state)).total,3);
  assert.equal(R.getTask('s1').instructions[0],'3 varv: 10 squats + 10 utfall totalt.');
  assert.equal(R.getTask('m7').duration,'35 min');assert.equal(R.summary(state).total,6);assert.equal(R.remaining(state),3);
  const next=R.spin(state,0);assert.equal(current(next).taskId,'s1b');assert.equal(R.remaining(next),2);
  assert.deepEqual(current(next).checkedSteps,[]);assert.equal(R.summary(next).total,6);
  assert.deepEqual(roundTrip(next),next);assert.equal(JSON.stringify(old),snapshot);
});
test('All current and archived checklists have unique keys and keep advice separate', () => {
  const ids=[...Object.values(R.TASKS).flat().map(task=>task.id),...['s','c','m'].flatMap(prefix=>Array.from({length:8},(_,i)=>prefix+(i+1)))];
  for(const id of ids){
    const steps=R.checklistItems({taskId:id});assert(steps.length>0&&steps.length<=15);
    assert.equal(new Set(steps.map(step=>step.key)).size,steps.length);
    assert(!steps.some(step=>R.checklistNotes(id).includes(step.text)));
  }
  assert.equal(R.checklistItems({taskId:'s1'}).length,3);
});
test('Checking steps saves progress without awarding points or spending credit, and is reversible', () => {
  let state = triple(); const initial = structuredClone(state), items = R.checklistItems(current(state));
  state = R.setStepChecked(state, items[0].key, true);
  assert.deepEqual(current(state).checkedSteps, [items[0].key]);
  assert.equal(R.checklistSummary(current(state)).done, 1);
  assert.equal(R.summary(state).total, 0);
  assert.equal(R.remaining(state), 5);
  assert.deepEqual(roundTrip(state), state);
  assert.deepEqual(initial, triple());
  state = R.setStepChecked(state, items[0].key, true);
  assert.equal(R.checklistSummary(current(state)).done, 1, 'Repeated checks do not duplicate progress');
  for (const item of items) state = R.setStepChecked(state, item.key, true);
  assert(R.checklistSummary(current(state)).allDone);
  assert.equal(R.summary(state).total, 0, 'All checks alone do not award points');
  state = R.toggleCompleted(state);
  assert.equal(R.summary(state).total, R.plannedPoints(current(state)));
  assert.throws(()=>R.setStepChecked(state,items[0].key,false),/Ångra/);
  state = R.setStepChecked(R.toggleCompleted(state), items[0].key, false);
  assert.equal(current(state).completed, false);
  assert.equal(R.summary(state).total, 0);
  assert.equal(R.checklistSummary(current(state)).done, items.length - 1);
});
test('Completion accepts no or partial checks and never fills unchecked steps', () => {
  for(const checkedCount of [0,1]){
    let state=triple(),items=R.checklistItems(current(state));
    if(checkedCount)state=R.setStepChecked(state,items[0].key,true);
    const beforeChecks=[...current(state).checkedSteps];state=R.toggleCompleted(state);
    assert.equal(current(state).completed,true);assert.deepEqual(current(state).checkedSteps,beforeChecks);
    assert.equal(R.checklistSummary(current(state)).done,checkedCount);assert.equal(R.summary(state).total,R.plannedPoints(current(state)));
    assert.deepEqual(roundTrip(state),state);
    state=R.toggleCompleted(state);assert.deepEqual(current(state).checkedSteps,beforeChecks);assert.equal(R.summary(state).total,0);
  }
  const legacy=R.restore({version:1,date:R.DATES[0],category:'strength',days:{[R.DATES[0]]:{taskId:'s1',rerolls:0,completed:true}}});
  assert(R.checklistSummary(current(legacy)).allDone,'Older completed checklists retain their saved behavior');
});
test('Replacement or removal clears only the affected workout’s checks; a new round clears all checks', () => {
  let state = triple();
  for (const item of R.checklistItems(current(state))) state = R.setStepChecked(state, item.key, true);
  const originalSteps = current(state).checkedSteps;
  const replaced = R.replaceExtra(state, 'strength', .4, 'extra:0');
  assert.deepEqual(current(replaced).checkedSteps, originalSteps.filter(key => !key.startsWith(current(state).extraSlots[0].taskId + ':')));
  assert.equal(R.checklistItems(current(replaced)).filter(item => item.slot === 'extra:0' && current(replaced).checkedSteps.includes(item.key)).length, 0);
  const removed = R.removeExtra(state, 'extra:1');
  assert.deepEqual(current(removed).checkedSteps, originalSteps.filter(key => !key.startsWith(current(state).extraSlots[1].taskId + ':')));
  const primary = R.spin(state, .5);
  assert.deepEqual(current(primary).checkedSteps, originalSteps.filter(key => !key.startsWith(current(state).taskId + ':')));
  const completed = R.toggleCompleted(R.spin(R.fresh(),0)), nextRound = R.spin(completed, .5);
  assert.deepEqual(current(nextRound).checkedSteps, []);
  assert.equal(R.summary(nextRound).total, R.plannedPoints(current(completed)));
  assert.equal(R.checklistSummary(current(R.changeDate(state, R.DATES[1]))).done, 0, 'Other days have separate progress');
});
test('Invalid checklist keys and corrupt progress fail without mutating the round', () => {
  const state = triple(), key = R.checklistItems(current(state))[0].key;
  for (const input of ['unknown:0','s1:99','c1:1']) assert.throws(() => R.setStepChecked(state,input,true));
  assert.throws(() => R.setStepChecked(state,key,'true'));
  assert.throws(() => R.setStepChecked(R.fresh(),key,true));
  for (const checkedSteps of [null,{},[key,key],['unknown:0'],[true]]) {
    const bad = structuredClone(state); current(bad).checkedSteps = checkedSteps;
    assert.throws(() => R.restore(bad));
  }
  const incomplete = structuredClone(state); current(incomplete).completed = true;
  assert.equal(R.restore(incomplete).days[state.date].completed,true,'A completed round may have unchecked optional steps');
  assert.deepEqual(current(state).checkedSteps, []);
});

test('Every interval and cooldown has its own stable checklist target', () => {
  for (const [id, count] of [['c2',5],['c4',6],['c8',5]]) {
    const items=R.checklistItems({taskId:id});
    assert.equal(items.filter(item=>item.lead?.startsWith('Intervall')).length,count);
    assert.equal(items[0].key,id+':0');
    assert.equal(new Set(items.map(item=>item.key)).size,items.length);
    assert.equal(items[1].lead,'Intervall 1 av '+count);
    assert.equal(items[count].lead,'Intervall '+count+' av '+count);
  }
  const c4=R.checklistItems({taskId:'c4'});
  assert.equal(c4.length,8);assert.equal(c4.at(-1).lead,'Nedvarvning');assert.equal(c4.at(-1).text,'Varva ner i 4 minuter.');
});
test('Legacy checked interval blocks expand without losing points or credits', () => {
  const old={version:1,date:R.DATES[0],category:'cardio',days:{[R.DATES[0]]:{taskId:'c4',rerolls:2,completed:true,checkedSteps:['c4:0','c4:1']}}};
  const snapshot=JSON.stringify(old),state=R.restore(old);
  assert.equal(state.version,R.VERSION);assert(R.checklistSummary(current(state)).allDone);
  assert.equal(current(state).checkedSteps.length,8);assert.equal(R.summary(state).total,4);assert.equal(R.remaining(state),3);
  assert.equal(JSON.stringify(old),snapshot);
  old.days[old.date].completed=false;old.days[old.date].checkedSteps=['c4:1'];
  const partial=R.restore(old);assert.equal(R.checklistSummary(current(partial)).done,7);assert.equal(R.summary(partial).total,0);
});
test('Starting training is saved for one, two and three workouts, and a new round starts fresh', () => {
  let state=R.spin(R.fresh(),0);
  for(let count=1;count<=3;count++){
    state=R.startTraining(state);assert.equal(current(roundTrip(state)).trainingStarted,true);assert.equal(R.summary(state).total,0);assert.equal(R.remaining(state),5);
    if(count<3)state=R.combine(state,'cardio',0);
  }
  assert.throws(()=>R.spin(R.toggleCompleted(state),.5),/dagens tre pass/);
  state=R.spin(R.toggleCompleted(R.startTraining(R.spin(R.fresh(),0))),.5);assert.equal(current(state).trainingStarted,false);assert.equal(current(state).checkedSteps.length,0);
  assert.throws(()=>R.startTraining(R.fresh()));
  const corrupt=structuredClone(state);current(corrupt).trainingStarted='yes';assert.throws(()=>R.restore(corrupt));
});

test('Saved previous-catalog checklists survive the updated workout instructions', () => {
  for (const id of ['s5b','s6b','s7b','s8b','c1b','c2b','c3b','c4b','c5b','c6b','c8b','c2c','c5c']) {
    const steps = R.checklistItems({taskId:id});
    const raw = {version:3,date:R.DATES[0],category:R.categoryFor(id),days:{[R.DATES[0]]:{
      taskId:id,rerolls:0,completed:true,checkedSteps:steps.map(step=>step.key)
    }}};
    const restored = R.restore(raw);
    assert.equal(R.checklistSummary(current(restored)).allDone,true);
    assert.equal(R.summary(restored).total,R.LEVELS[R.getTask(id).level].points);
    assert(!R.TASKS[R.categoryFor(id)].some(task=>task.id===id));
  }
});

test('Older pending rounds cannot complete or keep drawing after three archived workouts', () => {
  const raw={version:3,date:R.DATES[0],category:'strength',days:{[R.DATES[0]]:{taskId:'s1b',rerolls:2,completed:false,checkedSteps:[],completedRounds:[{taskId:'s2b',extraTaskIds:['c1b','m1b']}]}}};
  const state=R.restore(raw);assert.equal(R.archivedWorkouts(current(state)),3);assert.equal(R.nextExtraSlot(current(state)),null);
  assert.throws(()=>R.spin(state,0),/dagens tre pass/);assert.throws(()=>R.toggleCompleted(state),/högst tre/);
  assert.equal(R.remaining(state),3);assert.equal(R.summary(state).total,R.plannedPoints(current(state).completedRounds[0]));
});


test('All categories have equal first-draw odds for every level and task', () => {
  for (const category of Object.keys(R.CATEGORIES)) {
    const initial = R.chooseCategory(R.fresh(), category), counts = {};
    for (let i = 0; i < 900; i++) {
      const id = current(R.spin(initial, (i + .5) / 900)).taskId;
      counts[id] = (counts[id] || 0) + 1;
    }
    for (const level of Object.keys(R.LEVELS)) {
      const tasks = R.TASKS[category].filter(task => task.level === level);
      assert.equal(tasks.reduce((sum, task) => sum + counts[task.id], 0), 300);
      for (const task of tasks) assert.equal(counts[task.id], 300 / tasks.length);
    }
  }
});
test('Rerolls and combinations keep levels balanced despite excluded workouts', () => {
  for (const category of ['strength', 'cardio']) {
    let state = R.spin(R.chooseCategory(R.fresh(), category), 0);
    state = R.combine(state, category, 0);
    for (const slot of ['primary', 'extra:0', 'extra:1']) {
      const pool = R.availableTasks(state, category, slot), counts = {};
      for (let i = 0; i < 900; i++) {
        const value = (i + .5) / 900;
        const next = slot === 'primary' ? R.spin(state, value) : slot === 'extra:0' ? R.replaceExtra(state, category, value, slot) : R.combine(state, category, value);
        const id = R.slotTaskId(current(next), slot);
        assert(pool.some(task => task.id === id));
        counts[id] = (counts[id] || 0) + 1;
      }
      for (const level of Object.keys(R.LEVELS)) {
        const tasks = pool.filter(task => task.level === level);
        assert.equal(tasks.reduce((sum, task) => sum + counts[task.id], 0), 300);
        for (const task of tasks) assert.equal(counts[task.id], 300 / tasks.length);
      }
    }
  }
});
test('When a level has no eligible workout, only the remaining levels can be drawn', () => {
  const state = R.spin(R.chooseCategory(R.fresh(), 'mobility'), 0), counts = {};
  for (let i = 0; i < 600; i++) {
    const task = R.getTask(current(R.spin(state, (i + .5) / 600)).taskId);
    counts[task.level] = (counts[task.level] || 0) + 1;
  }
  assert.deepEqual(counts, { steady: 300, spicy: 300 });
});
test('The added challenge workouts have the approved exercises, intervals and alternatives', () => {
  const strength = R.getTask('s9'), cardio = R.getTask('c9');
  assert.equal(strength.title, 'Svett utan hantlar');
  assert.equal(strength.level, 'spicy'); assert.equal(strength.duration, '25 min');
  assert.equal(strength.sets, 3); assert.equal(strength.exercises.length, 5);
  assert.equal(R.checklistItems({ taskId: strength.id }).length, 15);
  assert(strength.notes.includes('Eller motsvarande övningar på gym.'));
  assert.equal(cardio.title, 'Flåset får jobba');
  assert.equal(cardio.level, 'spicy'); assert.equal(cardio.duration, '30 min');
  assert.equal(cardio.steps.length, 6);
  assert.equal(cardio.steps.filter(step => step.lead.startsWith('Intervall')).length, 4);
  assert(cardio.notes.some(note => note.includes('annan konditionsform')));
  for (const task of [strength, cardio]) {
    const before = R.chooseCategory(R.fresh(), R.categoryFor(task.id));
    const state = R.spin(before, .99);
    assert.equal(current(state).taskId, task.id);
    assert.deepEqual(roundTrip(state), state);
    assert.equal(R.plannedPoints(current(state)), 4);
  }
});
