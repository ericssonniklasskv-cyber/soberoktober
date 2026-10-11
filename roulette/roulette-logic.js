/* Local roulette prototype. Nothing here awards real competition points. */
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SoberRoulette = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';
  const VERSION = 4, FREE_SPINS = 5, MAX_WORKOUTS = 3;
  const DATES = Array.from({ length: 7 }, (_, i) => '2026-10-' + (12 + i));
  const CATEGORIES = {
    strength: { label: 'Styrka', caption: 'Lite muskler. Mycket vilja.', icon: 'strength' },
    cardio: { label: 'Kondition', caption: 'Få upp pulsen. Hitta ditt tempo.', icon: 'cardio' },
    mobility: { label: 'Rörlighet', caption: 'Mindre stel. Mer människa.', icon: 'mobility' },
  };
  const LEVELS = {
    calm: { label: 'Lugn', points: 2, color: '#e2e9d5', ink: '#214b3b' },
    steady: { label: 'Medel', points: 3, color: '#f7ecd0', ink: '#214b3b' },
    spicy: { label: 'Utmaning', points: 4, color: '#ef8b4c', ink: '#173e2e' },
  };
  // All tasks and points are examples to evaluate the concept, not published rules.
  const task = (id, level, title, duration, instructions) => ({ id, level, title, duration, instructions });
  const ARCHIVED_TASKS = {
    strength: [
      task('s1', 'calm', 'Ben med besked', '10 min', ['3 varv: 10 squats + 10 utfall totalt.', 'Vila 60 sekunder mellan varven.']),
      task('s2', 'steady', 'Armhävningsklubben', '15 min', ['5 varv: 8 armhävningar + 20 sekunder planka.', 'Armhävningar på knä eller mot en bänk går också bra.']),
      task('s3', 'calm', 'Stolens hämnd', '10 min', ['3 varv: 12 sitt-och-stå från en stol + 12 höftlyft.', 'Ta det kontrollerat. Vila efter behov.']),
      task('s4', 'spicy', 'Hela kroppen tack', '25 min', ['5 varv: 15 squats, 10 armhävningar och 20 utfall totalt.', 'Vila 60–90 sekunder mellan varven.']),
      task('s5', 'steady', 'Bål utan bortförklaringar', '15 min', ['4 varv: 30 sekunder planka, 10 dead bugs totalt och 15 höftlyft.', 'Vila 45 sekunder mellan varven.']),
      task('s6', 'calm', 'Bänkpress utan bänkpress', '10 min', ['3 varv: 10 armhävningar mot en stabil bänk + 12 squats.', 'Välj en höjd som känns lagom.']),
      task('s7', 'spicy', 'Leg day, tydligen', '25 min', ['5 varv: 20 squats, 20 utfall totalt och 30 sekunder jägarvila.', 'Vila 90 sekunder mellan varven.']),
      task('s8', 'steady', 'Utegym utan ursäkt', '20 min', ['Välj tre övningar på ett utegym.', 'Gör 3 × 10 repetitioner av varje, med lagom motstånd.']),
    ],
    cardio: [
      task('c1', 'calm', 'Promenad med attityd', '25 min', ['Gå raskt i 25 minuter.', 'Håll ett tempo där du blir varm men kan prata.']),
      task('c2', 'steady', 'Jogga lite. Gå lite.', '25 min', ['5 minuter rask gång som uppvärmning.', 'Växla 2 minuter jogg och 2 minuter gång, fem gånger.']),
      task('c3', 'calm', 'Cykla bort soffan', '20 min', ['Cykla i 20 minuter i bekvämt tempo.', 'Motionscykel eller utomhus – båda räknas.']),
      task('c4', 'spicy', 'Intervaller, såklart', '30 min', ['Värm upp med 8 minuter lätt jogg eller rask gång.', '6 × 1 minut snabbare tempo + 2 minuter lugnt. Varva ner i 4 minuter.']),
      task('c5', 'steady', 'Trappor till himlen', '20 min', ['5 minuter gång som uppvärmning.', 'Gå i trappor i 15 minuter. Ta pauser och gå lugnt ner.']),
      task('c6', 'calm', 'Dansgolvet är ditt', '15 min', ['Dansa till dina favoritlåtar i 15 minuter.', 'Köket, vardagsrummet eller dansgolvet. Du väljer.']),
      task('c7', 'spicy', 'Långa vägen hem', '45 min', ['Gå raskt eller jogga lugnt i 45 minuter.', 'Välj ett jämnt tempo som du kan hålla hela vägen.']),
      task('c8', 'steady', 'Pulspromenaden', '30 min', ['Värm upp med 5 minuter lugn gång.', '5 × 3 minuter rask gång + 2 minuter lugn gång.']),
    ],
    mobility: [
      task('m1', 'calm', 'Hej då, kontorsrygg', '10 min', ['2 varv: 10 katt–ko, 10 bröstryggsrotationer totalt och 30 sekunder barnets position.', 'Rör dig lugnt inom ett bekvämt rörelseomfång.']),
      task('m2', 'steady', 'Höfterna ljuger inte', '20 min', ['3 varv: 60 sekunder höftböjarstretch per sida + 10 lugna 90/90-växlingar.', 'Avsluta med 2 minuter lugn andning.']),
      task('m3', 'calm', 'Axlar ner, tack', '10 min', ['2 varv: 10 axelcirklar åt varje håll, 10 väggänglar och 30 sekunder bröststretch per sida.', 'Ta det mjukt och utan att pressa.']),
      task('m4', 'spicy', 'Yoga med ambition', '30 min', ['Gör ett 30-minuters yogapass.', 'Följ ett pass du gillar och anpassa positionerna efter kroppen.']),
      task('m5', 'steady', 'Rörligare än igår', '20 min', ['Gör ett lugnt helkroppsflöde: axlar, bröstrygg, höfter och fotleder.', 'Ge varje område cirka 5 minuter.']),
      task('m6', 'calm', 'Fotleder får kärlek', '10 min', ['3 varv: 10 knä-mot-vägg per sida + 10 långsamma tåhävningar.', 'Avsluta med 30 sekunder vadstretch per sida.']),
      task('m7', 'spicy', 'Långsam söndag', '35 min', ['25 minuter lugn yoga eller rörlighetsflöde.', 'Avsluta med 10 minuter lugn promenad.']),
      task('m8', 'steady', 'Golvet kallar', '20 min', ['3 varv: 10 katt–ko, 10 90/90-växlingar och 10 bröstryggsrotationer totalt.', 'Avsluta med 5 minuter mjuk stretch.']),
    ],
  };
  // Versioned IDs preserve previously drawn workouts and their checked steps.
  const gymAlternative = 'Eller motsvarande övningar på gym.';
  const cardioAlternative = 'Eller motsvarande i annan konditionsform, till exempel simning eller cykling.';
  const strengthTask = (id, level, title, duration, exercises) => {
    const sets = level === 'calm' ? 2 : 3;
    const notes = [level === 'calm' ? 'Vila 30–60 sekunder mellan seten.' : level === 'steady' ? 'Vila 45–60 sekunder mellan seten.' : 'Vila 60–90 sekunder mellan seten.', ...(exercises.some(text => text.includes('armhävningar')) ? ['Armhävningar på knä går också bra.'] : []), gymAlternative];
    return { ...task(id, level, title, duration, [...exercises.map(text => sets + ' set: ' + text), ...notes]), sets, exercises, notes };
  };
  const cardioTask = (id, level, title, duration, steps) => {
    const notes = level === 'calm' ? ['Gå i lugnt och bekvämt tempo.'] : [cardioAlternative];
    return { ...task(id, level, title, duration, [...steps.map(step => step.text), ...notes]), steps, notes };
  };
  const mobilityTask = (id, level, minutes) => {
    const steps = [{ text: 'Följ en valfri Youtubevideo med yoga eller rörlighet i ' + minutes + ' minuter.' }];
    const notes = ['Välj själv en video du gillar. Anpassa rörelserna efter kroppen.'];
    return { ...task(id, level, minutes + ' minuter rörlighet', minutes + ' min', [...steps.map(step => step.text), ...notes]), steps, notes };
  };
  // Retain the previous catalog entries for already saved test rounds.
  ARCHIVED_TASKS.strength.push(
    strengthTask('s5b', 'steady', 'Bål utan bortförklaringar', '15 min', ['30 sekunder planka.', '10 dead bugs totalt.', '15 höftlyft.']),
    strengthTask('s6b', 'calm', 'Bänkpress utan bänkpress', '10 min', ['10 armhävningar.', '10 dead bugs totalt.']),
    strengthTask('s7b', 'spicy', 'Leg day, tydligen', '25 min', ['20 squats.', '10 bakåtutfall per sida.', '20 höftlyft.', '20 tåhävningar.', '45 sekunder jägarvila.']),
    strengthTask('s8b', 'steady', 'Pannben i tre delar', '20 min', ['15 squats.', '10 bakåtutfall per sida.', '10 armhävningar.']),
  );
  ARCHIVED_TASKS.cardio.push(
    cardioTask('c1b', 'calm', 'Promenad med attityd', '25 min', [{ text: 'Gå en lugn promenad i 25 minuter.' }]),
    cardioTask('c2b', 'steady', 'Lugn jogg, tack', '25 min', [{ lead: 'Uppvärmning', text: 'Gå i 5 minuter.' }, { text: 'Jogga lugnt i 15 minuter.' }, { lead: 'Nedvarvning', text: 'Gå i 5 minuter.' }]),
    cardioTask('c3b', 'calm', 'En sväng räcker', '20 min', [{ text: 'Gå en lugn promenad i 20 minuter.' }]),
    cardioTask('c4b', 'spicy', 'Intervaller, såklart', '30 min', [{ lead: 'Uppvärmning', text: 'Värm upp med 8 minuter lätt jogg eller rask gång.' }, ...Array.from({ length: 6 }, (_, i) => ({ lead: 'Intervall ' + (i + 1) + ' av 6', text: '1 minut snabbare jogg + 2 minuter lugn jogg.' })), { lead: 'Nedvarvning', text: 'Varva ner i 4 minuter.' }]),
    cardioTask('c5b', 'steady', 'Hitta joggen', '20 min', [{ lead: 'Uppvärmning', text: 'Gå i 3 minuter.' }, { text: 'Jogga lugnt i 14 minuter.' }, { lead: 'Nedvarvning', text: 'Gå i 3 minuter.' }]),
    cardioTask('c6b', 'calm', 'Lufta herrn', '15 min', [{ text: 'Gå en lugn promenad i 15 minuter.' }]),
    cardioTask('c8b', 'steady', 'Lugna vägen hem', '30 min', [{ lead: 'Uppvärmning', text: 'Gå i 5 minuter.' }, { text: 'Jogga lugnt i 20 minuter.' }, { lead: 'Nedvarvning', text: 'Gå i 5 minuter.' }]),
  );
  ARCHIVED_TASKS.cardio.push(
    cardioTask('c2c', 'steady', 'Lugn jogg, tack', '25 min', [{ text: 'Jogga lugnt i 25 minuter.' }]),
    cardioTask('c5c', 'steady', 'Hitta joggen', '20 min', [{ text: 'Jogga lugnt i 20 minuter.' }]),
  );
  const TASKS = {
    strength: [
      strengthTask('s1b', 'calm', 'Basen, tack', '10 min', ['15 squats.', '10 armhävningar.']),
      strengthTask('s2b', 'steady', 'Armhävningsklubben', '15 min', ['10 armhävningar.', '15 squats.', '30 sekunder planka.']),
      strengthTask('s3b', 'calm', 'Ben och rumpa, tack', '10 min', ['15 squats.', '15 höftlyft.']),
      strengthTask('s4b', 'spicy', 'Hela kroppen tack', '25 min', ['15 squats.', '10 armhävningar.', '10 bakåtutfall per sida.', '15 höftlyft.', '45 sekunder planka.']),
      strengthTask('s5c', 'steady', 'Bål utan bortförklaringar', '15 min', ['30 sekunder planka.', '10 omvända crunches.', '15 höftlyft.']),
      strengthTask('s6c', 'calm', 'Bänkpress utan bänkpress', '10 min', ['10 armhävningar.', '10 omvända crunches.']),
      strengthTask('s7c', 'spicy', 'Leg day, tydligen', '25 min', ['30 squats.', '20 utfall per sida.', '20 höftlyft.']),
      strengthTask('s8c', 'steady', 'Pannben i tre delar', '20 min', ['15 squats.', '10 utfall per sida.', '10 armhävningar.']),
      strengthTask('s9', 'spicy', 'Svett utan hantlar', '25 min', ['15 squats.', '10 armhävningar.', '10 bakåtutfall per sida.', '15 höftlyft.', '30 sekunder mountain climbers.']),
    ],
    cardio: [
      cardioTask('c1c', 'calm', 'Promenad med attityd', '30 min', [{ text: 'Gå en lugn promenad i 30 minuter.' }]),
      cardioTask('c2d', 'steady', 'Lugn jogg, tack', '30 min', [{ text: 'Jogga lugnt i 30 minuter.' }]),
      cardioTask('c3c', 'calm', 'En sväng räcker', '25 min', [{ text: 'Gå en lugn promenad i 25 minuter.' }]),
      cardioTask('c4c', 'spicy', 'Intervaller, såklart', '30 min', [{ lead: 'Uppvärmning', text: 'Värm upp med 8 minuter lätt jogg eller rask gång.' }, ...Array.from({ length: 6 }, (_, i) => ({ lead: 'Intervall ' + (i + 1) + ' av 6', text: '1 minut hård jogg + 2 minuter lugn jogg.' })), { lead: 'Nedvarvning', text: 'Varva ner i 4 minuter.' }]),
      cardioTask('c5d', 'steady', 'Hitta joggen', '35 min', [{ text: 'Jogga i bra tempo i 35 minuter.' }]),
      cardioTask('c6c', 'calm', 'Lufta herrn', '20 min', [{ text: 'Gå en lugn promenad i 20 minuter.' }]),
      cardioTask('c7b', 'spicy', 'Långa vägen hem', '45 min', [{ lead: 'Uppvärmning', text: 'Jogga lugnt i 10 minuter.' }, ...Array.from({ length: 3 }, (_, i) => ({ lead: 'Intervall ' + (i + 1) + ' av 3', text: '5 minuter jogg i ett ansträngande tempo + 5 minuter lugn jogg.' })), { lead: 'Nedvarvning', text: 'Varva ner i 5 minuter.' }]),
      cardioTask('c8c', 'steady', 'Lugna vägen hem', '30 min', [{ text: 'Jogga lugnt i 30 minuter.' }]),
      cardioTask('c9', 'spicy', 'Flåset får jobba', '30 min', [{ lead: 'Uppvärmning', text: 'Jogga lugnt i 5 minuter.' }, ...Array.from({ length: 4 }, (_, i) => ({ lead: 'Intervall ' + (i + 1) + ' av 4', text: '3 minuter jogg i ett ansträngande tempo + 2 minuter lugn jogg.' })), { lead: 'Nedvarvning', text: 'Varva ner med 5 minuter lugn jogg eller gång.' }]),
    ],
    mobility: [
      mobilityTask('m1b', 'calm', 10),
      mobilityTask('m2b', 'steady', 20),
      mobilityTask('m4b', 'spicy', 30),
    ],
  };
  const clone = state => JSON.parse(JSON.stringify(state));
  const getTask = id => [...Object.values(TASKS).flat(), ...Object.values(ARCHIVED_TASKS).flat()].find(item => item.id === id);
  const categoryFor = id => Object.keys(TASKS).find(key => [...TASKS[key], ...ARCHIVED_TASKS[key]].some(item => item.id === id));
  const fresh = () => ({ version: VERSION, date: DATES[0], category: 'strength', days: {} });
  const usedSpins = state => Object.values(state.days).reduce((total, day) => total + day.rerolls, 0);
  const remaining = state => FREE_SPINS - usedSpins(state);
  function extraIndex(slot) {
    if (slot === 'extra') return 0;
    if (/^extra:[01]$/.test(slot)) return Number(slot.slice(-1));
    throw Error('Välj en giltig passdel.');
  }
  function slotTaskId(day, slot = 'primary') {
    return slot === 'primary' ? day?.taskId : day?.extraSlots?.[extraIndex(slot)]?.taskId;
  }
  function taskEntries(day) {
    if (!day) return [];
    const extras = day.extraSlots || (day.extraTaskIds || (day.extraTaskId ? [day.extraTaskId] : [])).map(taskId => ({ taskId }));
    return [{ slot: 'primary', id: day.taskId }, ...extras.map((item, index) => ({ slot: 'extra:' + index, id: item.taskId }))].filter(item => item.id);
  }
  const taskIds = day => taskEntries(day).map(item => item.id);
  // These second instructions are guidance, not an additional exercise to complete.
  const GUIDANCE_TASKS = new Set(['s1','s2','s3','s4','s5','s6','s7','c1','c3','c6','c7','m1','m3','m4','m5']);
  const checklistNotes = id => getTask(id)?.notes || (GUIDANCE_TASKS.has(id) ? [getTask(id).instructions[1]] : []);
  const INTERVALS = Object.freeze({
    c2: { count: 5, text: '2 minuter jogg + 2 minuter gång.' },
    c4: { count: 6, text: '1 minut snabbare tempo + 2 minuter lugnt.', cooldown: 'Varva ner i 4 minuter.' },
    c8: { count: 5, text: '3 minuter rask gång + 2 minuter lugn gång.' }
  });
  function checklistItems(day) {
    return taskEntries(day).flatMap(({ slot, id }) => {
      const task = getTask(id);
      if (task.exercises) return task.exercises.flatMap((text, exercise) => Array.from({ length: task.sets }, (_, set) => ({
        key: id + ':exercise:' + exercise + ':set:' + set, taskId: id, slot,
        lead: 'Övning ' + (exercise + 1) + ' av ' + task.exercises.length + ' · Set ' + (set + 1) + ' av ' + task.sets, text
      })));
      if (task.steps) return task.steps.map((step, index) => ({ ...step, key: id + ':step:' + index, taskId: id, slot }));
      return task.instructions.flatMap((text, index) => {
        if (index === 1 && GUIDANCE_TASKS.has(id)) return [];
        if (index === 1 && INTERVALS[id]) {
          const interval = INTERVALS[id];
          const steps = Array.from({ length: interval.count }, (_, round) => ({
            key: id + ':1:' + round, taskId: id, slot,
            lead: 'Intervall ' + (round + 1) + ' av ' + interval.count, text: interval.text
          }));
          if (interval.cooldown) steps.push({ key: id + ':1:cooldown', taskId: id, slot, lead: 'Nedvarvning', text: interval.cooldown });
          return steps;
        }
        const rounds = text.match(/^(\d+) varv: (.+)$/);
        return rounds ? Array.from({ length: Number(rounds[1]) }, (_, round) => ({
          key: id + ':' + index + ':' + round, taskId: id, slot,
          lead: 'Varv ' + (round + 1) + ' av ' + rounds[1], text: rounds[2]
        })) : [{ key: id + ':' + index, taskId: id, slot, text }];
      });
    });
  }
  function checklistSummary(day) {
    const items = checklistItems(day), checked = new Set(day?.checkedSteps || (day?.completed ? items.map(item => item.key) : []));
    const done = items.filter(item => checked.has(item.key)).length;
    return { done, total: items.length, allDone: items.length > 0 && done === items.length };
  }
  function retainChecks(day) {
    const allowed = new Set(checklistItems(day).map(item => item.key));
    day.checkedSteps = (day.checkedSteps || []).filter(key => allowed.has(key));
  }
  function startTraining(state) {
    const next = clone(state), day = next.days[next.date];
    if (!day) throw Error('Snurra fram ett pass först.');
    day.trainingStarted = true;
    return next;
  }
  function setStepChecked(state, key, checked) {
    const next = clone(state), day = next.days[next.date], items = checklistItems(day);
    if (day?.completed) throw Error('Ångra klarmarkeringen innan du ändrar checklistan.');
    if (typeof checked !== 'boolean' || !items.some(item => item.key === key)) throw Error('Välj ett giltigt moment.');
    const selected = new Set(day.checkedSteps || (day.completed ? items.map(item => item.key) : []));
    if (checked) selected.add(key); else selected.delete(key);
    day.checkedSteps = items.filter(item => selected.has(item.key)).map(item => item.key);
    day.trainingStarted = true;
    return next;
  }
  const archivedWorkouts = day => (day?.completedRounds || []).reduce((total, round) => total + taskIds(round).length, 0);
  const completedWorkouts = day => archivedWorkouts(day) + (day?.completed ? taskIds(day).length : 0);
  const canStartRound = day => !!day?.completed && completedWorkouts(day) < MAX_WORKOUTS;
  function nextExtraSlot(day) {
    if (!day || day.completed || archivedWorkouts(day) + taskIds(day).length >= MAX_WORKOUTS) return null;
    for (let index = 0; index < MAX_WORKOUTS - 1; index++) {
      if (!day.extraSlots?.[index]?.taskId) return 'extra:' + index;
    }
    return null;
  }
  function validateHistory(raw, currentId) {
    if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) throw Error('Ogiltig kategorihistorik.');
    const history = { ...raw };
    for (const [category, id] of Object.entries(history)) {
      if (!CATEGORIES[category] || categoryFor(id) !== category) throw Error('Ogiltig kategorihistorik.');
    }
    if (currentId) {
      if (raw !== undefined && history[categoryFor(currentId)] !== currentId) throw Error('Ogiltig kategorihistorik.');
      history[categoryFor(currentId)] = currentId;
    }
    return history;
  }
  function validateIds(ids) {
    if (ids.length > MAX_WORKOUTS || new Set(ids).size !== ids.length || ids.some(id => !getTask(id))) throw Error('Ogiltiga kombinerade pass.');
  }
  function restore(raw) {
    if (!raw || ![1, 2, 3, VERSION].includes(raw.version) || !DATES.includes(raw.date) || !CATEGORIES[raw.category] || !raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) throw Error('Testdata är ogiltiga. Nollställ testet för att börja om.');
    const state = fresh(); state.date = raw.date; state.category = raw.category;
    for (const [date, day] of Object.entries(raw.days)) {
      if (!DATES.includes(date) || !getTask(day?.taskId) || !Number.isInteger(day.rerolls) || day.rerolls < 0 || day.rerolls > FREE_SPINS || typeof day.completed !== 'boolean') throw Error('Testdata är ogiltiga. Nollställ testet för att börja om.');
      const target = { taskId: day.taskId, rerolls: day.rerolls, completed: day.completed };
      if (day.trainingStarted !== undefined) {
        if (typeof day.trainingStarted !== 'boolean') throw Error('Ogiltig träningsvy.');
        target.trainingStarted = day.trainingStarted;
      }
      if (day.primaryDraws !== undefined) target.primaryDraws = validateHistory(day.primaryDraws, day.taskId);
      // Import the previous two-workout prototype without resetting draws or credits.
      let slots = day.extraSlots;
      if (slots === undefined) {
        slots = day.extraTaskId !== undefined || day.extraDraws !== undefined ? [{ ...(day.extraTaskId !== undefined ? { taskId: day.extraTaskId } : {}), draws: day.extraDraws }] : [];
      }
      if (!Array.isArray(slots) || slots.length > MAX_WORKOUTS - 1) throw Error('Ogiltiga kombinerade pass.');
      if (slots.length) target.extraSlots = slots.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item) || (item.taskId !== undefined && !getTask(item.taskId))) throw Error('Ogiltigt kombinerat pass.');
        return { ...(item.taskId ? { taskId: item.taskId } : {}), draws: validateHistory(item.draws, item.taskId) };
      });
      validateIds(taskIds(target));
      const allowedSteps = new Set(checklistItems(target).map(item => item.key));
      if (day.checkedSteps !== undefined) {
        const legacyIntervalKeys = new Set(taskIds(target).filter(id => INTERVALS[id]).map(id => id + ':1'));
        if (!Array.isArray(day.checkedSteps) || new Set(day.checkedSteps).size !== day.checkedSteps.length || day.checkedSteps.some(key => typeof key !== 'string' || (!allowedSteps.has(key) && !legacyIntervalKeys.has(key)))) throw Error('Ogiltig checklista.');
        const expanded = new Set(day.checkedSteps.flatMap(key => legacyIntervalKeys.has(key) ? [...allowedSteps].filter(step => step.startsWith(key + ':')) : [key]));
        target.checkedSteps = [...allowedSteps].filter(key => expanded.has(key));
        if (raw.version < VERSION && target.completed && !checklistSummary(target).allDone) throw Error('En klar runda har ofärdiga moment.');
      } else if (target.completed) target.checkedSteps = [...allowedSteps];
      if (day.completedRounds !== undefined) {
        if (!Array.isArray(day.completedRounds)) throw Error('Ogiltiga klara pass.');
        target.completedRounds = day.completedRounds.map(round => {
          if (!getTask(round?.taskId)) throw Error('Ogiltiga klara pass.');
          const ids = round.extraTaskIds === undefined ? (round.extraTaskId !== undefined ? [round.extraTaskId] : []) : round.extraTaskIds;
          if (!Array.isArray(ids)) throw Error('Ogiltiga klara pass.');
          validateIds([round.taskId, ...ids]);
          return { taskId: round.taskId, ...(ids.length ? { extraTaskIds: [...ids] } : {}) };
        });
      }
      // The retired +1 bonus is not included in this prototype's totals.
      state.days[date] = target;
    }
    if (usedSpins(state) > FREE_SPINS) throw Error('För många frispinn i testdata. Nollställ testet.');
    return state;
  }
  function changeDate(state, date) {
    if (!DATES.includes(date)) throw Error('Välj en dag i testveckan.');
    const next = clone(state); next.date = date;
    if (next.days[date]) next.category = categoryFor(next.days[date].taskId);
    return next;
  }
  function chooseCategory(state, category) {
    if (!CATEGORIES[category]) throw Error('Välj en giltig kategori.');
    const next = clone(state); next.category = category; return next;
  }
  function drawHistory(day, slot) {
    const history = { ...(slot === 'primary' ? day?.primaryDraws : day?.extraSlots?.[extraIndex(slot)]?.draws) };
    const id = slotTaskId(day, slot);
    if (id) history[categoryFor(id)] = id;
    return history;
  }
  function spinCost(state, category = state.category, slot = 'primary') {
    if (!CATEGORIES[category]) throw Error('Välj en giltig kategori.');
    return drawHistory(state.days[state.date], slot)[category] ? 1 : 0;
  }
  function checkDraw(state, category, slot, random) {
    if (!Number.isFinite(random) || random < 0 || random >= 1) throw Error('Ogiltigt slumpvärde.');
    const cost = spinCost(state, category, slot);
    if (cost && remaining(state) <= 0) throw Error('Veckans fem frispinn är slut. Välj en kategori du inte har snurrat idag.');
    return cost;
  }
  function availableTasks(state, category = state.category, slot = 'primary') {
    if (!CATEGORIES[category]) throw Error('Välj en giltig kategori.');
    const day = state.days[state.date], history = drawHistory(day, slot);
    if (archivedWorkouts(day) >= MAX_WORKOUTS || (day?.completed && !canStartRound(day))) return [];
    const others = day?.completed && slot === 'primary' ? [] : taskEntries(day).filter(item => item.slot !== slot && !(slot === 'extra' && item.slot === 'extra:0')).map(item => item.id);
    return TASKS[category].filter(task => task.id !== history[category] && !others.includes(task.id));
  }
  function drawPool(state, category, slot) {
    const tasks = availableTasks(state, category, slot);
    if (!tasks.length) throw Error('Alla pass i kategorin är redan valda. Välj en annan kategori eller ta bort ett pass.');
    return tasks;
  }
  function pickTask(tasks, random) {
    // Equal chance per available level, then equal chance per task within that level.
    const levels = Object.keys(LEVELS).filter(level => tasks.some(task => task.level === level));
    const position = random * levels.length, levelIndex = Math.floor(position);
    const choices = tasks.filter(task => task.level === levels[levelIndex]);
    return choices[Math.min(choices.length - 1, Math.floor((position - levelIndex) * choices.length))];
  }
  function spin(state, random) {
    const day = state.days[state.date];
    if (archivedWorkouts(day) >= MAX_WORKOUTS || (day?.completed && !canStartRound(day))) throw Error('Du har klarat dagens tre pass. Kom tillbaka nästa dag.');
    const cost = checkDraw(state, state.category, 'primary', random);
    const history = drawHistory(day, 'primary');
    const tasks = drawPool(state, state.category, 'primary');
    const id = pickTask(tasks, random).id;
    const next = clone(state), target = { ...next.days[next.date], taskId: id, rerolls: (day?.rerolls || 0) + cost, completed: false };
    target.primaryDraws = { ...history, [state.category]: id };
    if (day?.completed) {
      target.checkedSteps = [];
      target.trainingStarted = false;
      const extraTaskIds = taskIds(day).slice(1);
      target.completedRounds = [...(target.completedRounds || []), { taskId: day.taskId, ...(extraTaskIds.length ? { extraTaskIds } : {}) }];
      if (day.extraSlots) target.extraSlots = day.extraSlots.map((item, index) => ({ draws: drawHistory(day, 'extra:' + index) }));
    }
    retainChecks(target);
    next.days[next.date] = target;
    return next;
  }
  function drawExtra(state, category, random, slot) {
    const day = state.days[state.date];
    if (!day || day.completed) throw Error('Välj ett första pass och kombinera innan det är klart.');
    const index = extraIndex(slot), cost = checkDraw(state, category, slot, random), history = drawHistory(day, slot);
    const tasks = drawPool(state, category, slot);
    const next = clone(state), target = next.days[next.date];
    target.extraSlots ||= [];
    while (target.extraSlots.length <= index) target.extraSlots.push({ draws: {} });
    const taskId = pickTask(tasks, random).id;
    target.extraSlots[index] = { taskId, draws: { ...history, [category]: taskId } };
    target.rerolls += cost;
    retainChecks(target);
    return next;
  }
  function combine(state, category, random) {
    const slot = nextExtraSlot(state.days[state.date]);
    if (!slot) throw Error('Du kan göra högst tre pass per dag.');
    return drawExtra(state, category, random, slot);
  }
  function replaceExtra(state, category, random, slot = 'extra:0') {
    if (!slotTaskId(state.days[state.date], slot)) throw Error('Välj ett extra pass först.');
    return drawExtra(state, category, random, slot);
  }
  function rerollExtra(state, random, slot = 'extra:0') {
    const id = slotTaskId(state.days[state.date], slot);
    if (!id) throw Error('Det extra passet kan inte snurras om nu.');
    return replaceExtra(state, categoryFor(id), random, slot);
  }
  function removeExtra(state, slot = 'extra:0') {
    const day = state.days[state.date];
    if (!slotTaskId(day, slot) || day.completed) throw Error('Avmarkera passet innan du tar bort en del.');
    const next = clone(state);
    // Keep each slot's history even when removed; removal never refunds a draw.
    next.days[next.date].extraSlots[extraIndex(slot)] = { draws: drawHistory(day, slot) };
    retainChecks(next.days[next.date]);
    return next;
  }
  const plannedPoints = day => taskIds(day).reduce((total, id) => total + LEVELS[getTask(id).level].points, 0);
  function toggleCompleted(state) {
    const next = clone(state), day = next.days[next.date];
    if (!day) throw Error('Snurra fram ett pass först.');
    if (!day.completed && archivedWorkouts(day) + taskIds(day).length > MAX_WORKOUTS) throw Error('Du kan göra högst tre pass per dag.');
    day.completed = !day.completed;
    return next;
  }
  function completedRounds(day) {
    return [...(day?.completedRounds || []), ...(day?.completed ? [day] : [])];
  }
  function dayPoints(day) {
    return completedRounds(day).reduce((sum, round) => sum + plannedPoints(round), 0);
  }
  function summary(state) {
    const days = Object.values(state.days), completed = days.flatMap(completedRounds);
    const workoutPoints = completed.reduce((sum, round) => sum + plannedPoints(round), 0);
    return { days: days.filter(day => completedRounds(day).length).length, workoutPoints,
      total: workoutPoints, remaining: remaining(state) };
  }
  // Segment 0 is centered at 12 o'clock. The fixed pointer must land on the chosen task.
  function landingRotation(current, index, turns = 5, count = 8) {
    if (!Number.isInteger(count) || count < 2 || !Number.isInteger(index) || index < 0 || index >= count) throw Error('Ogiltigt hjulsegment.');
    const target = ((-index * (360 / count)) % 360 + 360) % 360;
    const offset = ((target - (current % 360)) % 360 + 360) % 360;
    return current + turns * 360 + offset;
  }
  return { VERSION, FREE_SPINS, MAX_WORKOUTS, DATES, CATEGORIES, LEVELS, TASKS, fresh, restore, getTask, categoryFor, taskIds, taskEntries, slotTaskId, checklistItems, checklistNotes, checklistSummary, startTraining, setStepChecked, nextExtraSlot, archivedWorkouts, completedWorkouts, canStartRound, remaining, spinCost, availableTasks, changeDate, chooseCategory, spin, combine, replaceExtra, rerollExtra, removeExtra, plannedPoints, dayPoints, toggleCompleted, summary, landingRotation };
});
