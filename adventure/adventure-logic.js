(function attachSoberAdventure(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SoberAdventure = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSoberAdventure() {
  const BOARD_SIZE = 60;
  const START_DATE = '2026-10-26';
  const END_DATE = '2026-10-31';
  const FINAL_BOSS_DATE = END_DATE;
  const SAVE_VERSION = 3;
  // Bound local save size while leaving ample room for the scoring phase.
  const MAX_EVENTS = 10000;
  const EXERCISES = Object.freeze([
    Object.freeze({ id: 'squats', label: 'Squats', reps: 15, provisional: true }),
    Object.freeze({ id: 'pushups', label: 'Armhävningar', reps: 10, provisional: true }),
    Object.freeze({ id: 'pullups', label: 'Pull-ups', reps: 5, provisional: true }),
    Object.freeze({ id: 'running', label: 'Löpning', distanceKm: 1, provisional: true }),
  ]);
  const EXERCISE_BY_ID = new Map(EXERCISES.map((item) => [item.id, item]));
  const SCORING_EXERCISES = Object.freeze(EXERCISES.map(exercise => Object.freeze({
    ...exercise, ...(exercise.distanceKm ? { distanceKm: 1 } : {}), points: 1,
  })));
  const SCORING_BY_ID = new Map(SCORING_EXERCISES.map(exercise => [exercise.id, exercise]));
  const BOSSES = Object.freeze([
    {
      id: 'troll', position: 6, name: 'Attraktiva Öl-Orcen', title: 'Bron över frestelsen',
      story: "Efter att ha tagit dig igenom hela Beer o' forest blir du stoppad av en väldigt attraktiv öl-orc som spänner biceps och räcker fram en skummande bägare.",
      dialogue: [
        "Lugn i stormen, snygging – ingen passerar de här bicepsen utan en bägare öl.",
        "Du har ju kämpat hela vägen hit, så en liten skål med mig har du väl förtjänat?",
      ],
      challengeStory: "Orcen har tränat varenda muskel utom förmågan att följa något som rullar. En kunglig kullerbytta får hans ögon att gå i kors och ger dig chansen att smita förbi.",
      choices: [['somersault', 'Rulla förbi som en legend!', 'Attraktiva Öl-Orcen tror att han spärrat vägen. Motbevisa honom med en kunglig kullerbytta! Filma ditt mästerverk på ett mjukt underlag och skicka klippet i gruppen.']]
    },
    {
      id: 'witch', position: 12, name: 'Sexiga vin-gnomen', title: 'Källarens lockrop',
      story: "När du når slutet av Boulevard of wine glider Sexiga vin-gnomen fram ur dimman och blockerar gatan med ett vinglas i handen.",
      dialogue: [
        "Men titta, du har gått hela boulevarden utan att bjuda mig på en enda skål.",
        "Jag har sparat mitt bästa rödvin och min sämsta bortförklaring åt just dig.",
      ],
      challengeStory: "Vin-gnomen sveper in vägen i en förtrollad vindimma som bara går att se igenom upp och ner. När du försöker stå på händer vänds hennes magi mot henne och stigen blir synlig.",
      choices: [['handstand', 'Vänd upp och ner på Sexiga vin-gnomen!', 'Dags att se världen från ett nyktert perspektiv — upp och ner! Gör ditt bästa försök att stå på händer, gärna med stöd. Filma försöket och skicka klippet i gruppen. Hjältemodet sitter i försöket!']]
    },
    {
      id: 'dragon', position: 24, name: 'Shotsdraken', title: 'Den lilla skålen',
      story: "Du har precis tagit dig igenom Ravine of shots när marken skakar och Shotsdraken landar framför utgången med en bricka glödande shots.",
      dialogue: [
        "Stopp, lilla benmänniska – här betalar man tullen med en shot.",
        "Den bränner bara lite mer än dina lår gjorde på vägen hit.",
      ],
      challengeStory: "Shotsdraken kan spruta eld hela natten, men i morgonljuset blir han löjligt sömnig. En tidig morgonpromenad tar dig förbi ravinens utgång medan han ligger och snarkar över sin shotbricka.",
      choices: [['morning-walk', 'Morgonpigg drakdräpare!', 'Medan Shotsdraken fortfarande snarkar tar du täten. Ge dig ut på en tidig morgonpromenad och skicka en bild eller ett klipp i gruppen. Morgonfrilla uppmuntras!']]
    },
    {
      id: 'sphinx', position: 36, name: 'Proseccohäxan', title: 'Spegelgrottan',
      story: "Efter klättringen genom The prosecco mountains når du ett bergspass där Proseccohäxan svävar framför dig och fyller luften med gyllene bubblor.",
      dialogue: [
        "Utsikten är gratis, älskling, men vägen vidare kostar ett glas prosecco.",
        "Jag har kylt flaskan med bergsmagi och förberett en väldigt trovärdig ursäkt.",
      ],
      challengeStory: "Häxan stänger bergspasset med en vägg av förtrollade bubblor. Tio kickar med en boll spräcker hennes bubbelmagi och öppnar en väg vidare.",
      choices: [['ball-juggling', 'Tio kickar mot bubbelmagin!', 'Fram med bollen — nu ska Proseccohäxan få se på bollkänsla! Kicka bollen 10 gånger, filma din uppvisning och skicka klippet i gruppen. Låt jublet börja!']]
    },
    {
      id: 'kraken', position: 48, name: 'Nattklubbsgollum', title: 'Dansgolvets dimma',
      story: "Du har dansat dig igenom The last dance och ser äntligen utgången, men Nattklubbsgollum sitter på huk framför dörren och kramar sitt dyrbara drinkglas.",
      dialogue: [
        "Inte gå än, nej nej, festen har ju precis börjat, min dyrbaraste.",
        "Vi har sparat den allra sista drinken åt dig och vi delar inte med vem som helst.",
      ],
      challengeStory: "Gollum vägrar släppa sin dyrbara drink och flytta sig från dörren. Men en riktigt cool bottle flip med en vattenflaska får honom att glömma glaset för ett ögonblick – precis tillräckligt länge för att du ska kunna smita förbi.",
      choices: [['bottle-flip', 'En bottle flip från en annan värld!', 'Fram med en vattenflaska! Sätt den coolaste bottle flip du kan hitta på, filma mästerverket och skicka klippet i gruppen. Nattklubbsgollum ska tappa hakan!']]
    },
    {
      id: 'final', position: 60, name: 'Bakrusbaronen', title: 'Sista frestelsen', opensOn: FINAL_BOSS_DATE,
      story: "Till sist står du framför portarna till Hangover castle, där Bakrusbaronen kliver ner från sin tron och höjer ett glas whisky framför mållinjen.",
      dialogue: [
        "Se där, en äkta soktoberian som nästan har klarat hela riket.",
        "Nog har du förtjänat att fira med en whisky efter allt slit och alla märkliga uppdrag?",
      ],
      challengeStory: "Baronen har förtrollat den sista porten så att den bara öppnas av äkta, nykter segerglädje. Ditt allra finaste glädjeskutt bryter hans sista knep och visar att en sann soktoberian kan fira segern utan whisky.",
      choices: [['victory-jump', 'En sann soktoberians segerskutt!', 'Du har tagit dig genom Frestelsernas rike och stått emot frestelserna. Nu vill vi se ditt allra finaste glädjeskutt! Filma segerögonblicket och skicka klippet i gruppen. En sann soktoberian landar äventyret med stil!']]
    },
  ].map((boss) => Object.freeze({
    id: boss.id, position: boss.position, name: boss.name, title: boss.title, story: boss.story, opensOn: boss.opensOn,
    dialogue: Object.freeze(boss.dialogue),
    challengeStory: boss.challengeStory,
    choices: Object.freeze(boss.choices.map(([id, title, detail]) => Object.freeze({ id, title, detail }))),
  })));
  // Read old local demo saves without exposing the retired A/B tasks as new choices.
  const LEGACY_CHOICES = Object.freeze({
    troll: Object.freeze(['balance', 'seated-balance']),
    witch: Object.freeze(['shoulders', 'arms']),
    dragon: Object.freeze(['heel-raise', 'seated-feet']),
    sphinx: Object.freeze(['chair-sit', 'seated-reach']),
    kraken: Object.freeze(['step-touch', 'seated-steps']),
    final: Object.freeze(['breathing', 'walk']),
  });
  const BOSS_BY_ID = new Map(BOSSES.map((boss) => [boss.id, boss]));

  function validDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }
  function validId(id) { return typeof id === 'string' && id.length > 0 && id.length <= 200; }
  function freshId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `adv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
  function freezeState(events, stepCredits = {}, shortcutChoice = null, rideChoice = null, icecreamChoice = null, returnRideChoice = null, returnRideEscaped = false) { const kept = Object.fromEntries(Object.entries(stepCredits).filter(([id]) => events.some(e => e.id === id))); return Object.freeze({ version: SAVE_VERSION, events: Object.freeze(events), stepCredits: Object.freeze(kept), ...(shortcutChoice ? { shortcutChoice } : {}), ...(rideChoice ? { rideChoice } : {}), ...(icecreamChoice ? { icecreamChoice } : {}), ...(returnRideChoice ? { returnRideChoice, returnRideEscaped } : {}) }); }
  function createState() { return freezeState([]); }
  function applySequence(events, stepCredits = {}) {
    let position = 0;
    let pendingBoss = null;
    let pointsUnlockedOn = null;
    const completedBossIds = [], bonusPositions = [], setbackPositions = [];
    for (const event of events) {
      if (event.type === 'exercise') {
        if (pendingBoss || position >= BOARD_SIZE) return null;
        const credit = Object.hasOwn(stepCredits, event.id) ? stepCredits[event.id] : 0;
        position += 1 + credit;
        if (credit === 6 && !BOSSES.slice(2).some(boss => boss.position === position)) return null;
        if (credit === 1) { if (![22, 29].includes(position)) return null; bonusPositions.push(position); }
        // Each setback cancels only its own arrival step. Training stays recorded.
        if (credit === -1) { if (![32,43].includes(position) || setbackPositions.includes(position)) return null; setbackPositions.push(position); }
        const checkpoint = BOSSES.find((boss) => boss.position === position);
        if (checkpoint) pendingBoss = checkpoint;
        if (position === BOARD_SIZE) pointsUnlockedOn = event.date;
      } else if (event.type === 'boss') {
        if (!pendingBoss || event.bossId !== pendingBoss.id || !isBossOpen(event.bossId, event.date)) return null;
        if (!pendingBoss.choices.some((choice) => choice.id === event.choiceId)) return null;
        completedBossIds.push(pendingBoss.id);
        pendingBoss = null;
      } else if (event.type === 'score') {
        if (!pointsUnlockedOn || (pendingBoss && pendingBoss.id !== 'final') || position !== BOARD_SIZE
          || event.date < pointsUnlockedOn || event.date < START_DATE || event.date > END_DATE) return null;
      } else return null;
    }
    return { position, pendingBoss, completedBossIds, pointsUnlockedOn, bonusPositions, setbackPositions };
  }
  function restore(raw) {
    let value = raw;
    if (typeof raw === 'string') { try { value = JSON.parse(raw); } catch (_) { return null; } }
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, 2, SAVE_VERSION].includes(value.version)
      || !Array.isArray(value.events) || value.events.length > MAX_EVENTS) return null;
    const ids = new Set(); const events = [];
    const shortcutChoice = value.shortcutChoice ?? null, rideChoice = value.rideChoice ?? null, icecreamChoice = value.icecreamChoice ?? null;
    const returnRideChoice=value.returnRideChoice??null, returnRideEscaped=value.returnRideEscaped??false;
    if (returnRideChoice!==null&&!['take','keep'].includes(returnRideChoice) || typeof returnRideEscaped!=='boolean' || returnRideEscaped&&returnRideChoice!=='take') return null;
    if (icecreamChoice !== null && !['take', 'keep'].includes(icecreamChoice)) return null;
    if (rideChoice !== null && !['take', 'keep'].includes(rideChoice)) return null;
    if (shortcutChoice !== null && !['take', 'keep'].includes(shortcutChoice)) return null;
    let stepCredits = {};
    if (value.version === SAVE_VERSION) {
      if (value.stepCredits !== undefined && (!value.stepCredits || typeof value.stepCredits !== 'object' || Array.isArray(value.stepCredits))) return null;
      stepCredits = Object.fromEntries(Object.entries(value.stepCredits || {}));
      if (Object.entries(stepCredits).some(([id, steps]) => ![-1, 1, 6].includes(steps) || (steps === -1 && icecreamChoice !== 'take' && !(returnRideChoice === 'take' && returnRideEscaped)) || (steps === 1 && shortcutChoice !== 'take' && rideChoice !== 'take') || !value.events.some(e => e?.id === id && e.type === 'exercise'))) return null;
    } else {
      // Preserve already reached checkpoints from the original 36-tile route.
      let steps = 0;
      stepCredits = Object.fromEntries(value.events.filter(e => e?.type === 'exercise' && [18,24,30,36].includes(++steps)).map(e => [e.id, 6]));
    }
    if (Object.values(stepCredits).filter(steps => steps === 1).length > 2 || Object.values(stepCredits).filter(steps => steps === -1).length > 2) return null;
    for (const event of value.events) {
      if (!event || typeof event !== 'object' || Array.isArray(event) || !validId(event.id)
        || ids.has(event.id) || !validDate(event.date)) return null;
      if (event.type === 'exercise' && EXERCISE_BY_ID.has(event.exerciseId)) {
        const exercise = EXERCISE_BY_ID.get(event.exerciseId);
        // Keep earlier 2 km and 2.5 km registrations intact; new steps use 1 km.
        const distanceKm = exercise.distanceKm ? (event.distanceKm === undefined ? 2.5 : event.distanceKm) : undefined;
        if (exercise.distanceKm && distanceKm !== 1 && distanceKm !== 2 && distanceKm !== 2.5) return null;
        events.push(Object.freeze({ id: event.id, type: 'exercise', exerciseId: event.exerciseId, date: event.date,
          ...(exercise.distanceKm ? { distanceKm } : {}) }));
      } else if (event.type === 'score' && SCORING_BY_ID.has(event.exerciseId)) {
        events.push(Object.freeze({ id: event.id, type: 'score', exerciseId: event.exerciseId, date: event.date }));
      } else if (event.type === 'boss' && BOSS_BY_ID.has(event.bossId) && typeof event.choiceId === 'string') {
        const boss = BOSS_BY_ID.get(event.bossId);
        const choice = boss.choices.find((item) => item.id === event.choiceId);
        if (!choice && !LEGACY_CHOICES[boss.id].includes(event.choiceId)) return null;
        if (value.version === 1 && boss.id === 'final' && event.date < FINAL_BOSS_DATE) {
          // Reopen an early final from the old demo without discarding its earned points.
          const arrived = applySequence(events, stepCredits);
          if (!arrived || arrived.pendingBoss?.id !== 'final') return null;
        } else {
          events.push(Object.freeze({ id: event.id, type: 'boss', bossId: event.bossId, choiceId: choice ? choice.id : boss.choices[0].id, date: event.date }));
        }
      } else return null;
      ids.add(event.id);
    }
    const sequence = applySequence(events, stepCredits);
    if (!sequence || sequence.bonusPositions.some(tile => tile === 22 ? shortcutChoice !== 'take' : rideChoice !== 'take')) return null;
    if (sequence.setbackPositions.some(tile=>tile===32?icecreamChoice!=='take':returnRideChoice!=='take'||!returnRideEscaped)) return null;
    if (returnRideChoice==='take'&&!returnRideEscaped&&(sequence.position!==44||sequence.pendingBoss)) return null;
    return freezeState(events, stepCredits, shortcutChoice, rideChoice, icecreamChoice, returnRideChoice, returnRideEscaped);
  }
  function checked(state) { const result = restore(state); if (!result) throw new TypeError('Invalid adventure state'); return result; }
  function append(state, event) {
    const current = checked(state);
    if (current.events.length >= MAX_EVENTS) throw new RangeError('Event limit reached');
    if (!validId(event.id) || current.events.some((item) => item.id === event.id)) throw new TypeError('Event id must be unique and non-empty');
    const candidate = [...current.events, Object.freeze(event)];
    const stepCredits = { ...current.stepCredits };
    // Undoing an exercise never resets the one-time decision. Restore the same
    // single bonus when its arrival exercise is recorded again, without stacking.
    if (event.type === 'exercise' && ((current.shortcutChoice === 'take' && progress(current).position === 20) || (current.rideChoice === 'take' && progress(current).position === 27))) stepCredits[event.id] = 1;
    // If the arrival exercise was undone, reattach the same single setback.
    // A normal revisit to 33 already has its debit and never applies it again.
    const setbacks=applySequence(current.events,stepCredits).setbackPositions;
    if (event.type === 'exercise' && current.icecreamChoice === 'take' && progress(current).position === 32 && !setbacks.includes(32)) stepCredits[event.id] = -1;
    if (event.type === 'exercise' && current.returnRideChoice === 'take' && current.returnRideEscaped && progress(current).position === 43 && !setbacks.includes(43)) stepCredits[event.id] = -1;
    if (!applySequence(candidate, stepCredits)) throw new TypeError('Event is not allowed in the current adventure state');
    return freezeState(candidate, stepCredits, current.shortcutChoice, current.rideChoice, current.icecreamChoice, current.returnRideChoice, current.returnRideEscaped);
  }
  function record(state, exerciseId, date, id = freshId()) {
    if (!EXERCISE_BY_ID.has(exerciseId)) throw new TypeError('Unknown exercise');
    if (!validDate(date)) throw new TypeError('Date must be a valid YYYY-MM-DD date');
    if (state.returnRideChoice==='take'&&!state.returnRideEscaped) throw new TypeError('Complete the escape mission before recording another exercise');
    const progressNow = progress(state);
    if (progressNow.pendingBoss) throw new TypeError('Resolve the boss before recording another exercise');
    if (progressNow.finished) throw new TypeError('The board is complete');
    const exercise = EXERCISE_BY_ID.get(exerciseId);
    return append(state, { id, type: 'exercise', exerciseId, date, ...(exercise.distanceKm ? { distanceKm: exercise.distanceKm } : {}) });
  }
  function chooseShortcut(state, choice, date) {
    const current = checked(state);
    if (!validDate(date) || date < START_DATE || date > END_DATE) throw new TypeError('Shortcut is only available during the theme');
    if (!['take', 'keep'].includes(choice)) throw new TypeError('Unknown shortcut choice');
    if (current.shortcutChoice) throw new TypeError('Shortcut choice is already saved');
    if (progress(current).position !== 21 || progress(current).pendingBoss) throw new TypeError('Shortcut is only available at tile 21');
    const credits = { ...current.stepCredits };
    if (choice === 'take') credits[current.events.findLast(event => event.type === 'exercise').id] = 1;
    return checked(freezeState(current.events, credits, choice, current.rideChoice, current.icecreamChoice, current.returnRideChoice, current.returnRideEscaped));
  }
  function chooseRide(state, choice, date) {
    const current = checked(state);
    if (!validDate(date) || date < START_DATE || date > END_DATE) throw new TypeError('Ride is only available during the theme');
    if (!['take', 'keep'].includes(choice)) throw new TypeError('Unknown ride choice');
    if (current.rideChoice) throw new TypeError('Ride choice is already saved');
    if (progress(current).position !== 28 || progress(current).pendingBoss) throw new TypeError('Ride is only available at tile 28');
    const credits = { ...current.stepCredits };
    if (choice === 'take') credits[current.events.findLast(event => event.type === 'exercise').id] = 1;
    return checked(freezeState(current.events, credits, current.shortcutChoice, choice, current.icecreamChoice, current.returnRideChoice, current.returnRideEscaped));
  }
  function chooseIcecream(state, choice, date) {
    const current = checked(state);
    if (!validDate(date) || date < START_DATE || date > END_DATE) throw new TypeError('Icecream is only available during the theme');
    if (!['take', 'keep'].includes(choice)) throw new TypeError('Unknown icecream choice');
    if (current.icecreamChoice) throw new TypeError('Icecream choice is already saved');
    const now = progress(current);
    if (now.position !== 33 || now.pendingBoss) throw new TypeError('Icecream is only available at tile 33');
    const credits = { ...current.stepCredits };
    if (choice === 'take') credits[current.events.findLast(event => event.type === 'exercise').id] = -1;
    return checked(freezeState(current.events, credits, current.shortcutChoice, current.rideChoice, choice, current.returnRideChoice, current.returnRideEscaped));
  }
  function chooseReturnRide(state, choice, date) {
    const current=checked(state),p=progress(current);
    if (!validDate(date)||date<START_DATE||date>END_DATE) throw new TypeError('Return ride is only available during the theme');
    if (!['take','keep'].includes(choice)) throw new TypeError('Unknown return ride choice');
    if (current.returnRideChoice) throw new TypeError('Return ride choice is already saved');
    if (p.position!==44||p.pendingBoss) throw new TypeError('Return ride is only available at tile 44');
    return checked(freezeState(current.events,current.stepCredits,current.shortcutChoice,current.rideChoice,current.icecreamChoice,choice,false));
  }
  function completeReturnRide(state,date) {
    const current=checked(state),p=progress(current);
    if (!validDate(date)||date<START_DATE||date>END_DATE) throw new TypeError('Escape is only available during the theme');
    if (current.returnRideChoice!=='take'||current.returnRideEscaped||p.position!==44||p.pendingBoss) throw new TypeError('No escape mission is pending');
    const credits={...current.stepCredits};credits[current.events.findLast(e=>e.type==='exercise').id]=-1;
    return checked(freezeState(current.events,credits,current.shortcutChoice,current.rideChoice,current.icecreamChoice,current.returnRideChoice,true));
  }
  function isBossOpen(bossId, date) {
    const boss = BOSS_BY_ID.get(bossId);
    return !!boss && validDate(date) && (!boss.opensOn || date === boss.opensOn);
  }
  function resolveBoss(state, bossId, choiceId, date, id = freshId()) {
    if (!validDate(date)) throw new TypeError('Date must be a valid YYYY-MM-DD date');
    if (!isBossOpen(bossId, date)) throw new TypeError('The final boss opens on 31 October');
    const current = checked(state); const p = applySequence(current.events, current.stepCredits);
    if (!p.pendingBoss || p.pendingBoss.id !== bossId || !p.pendingBoss.choices.some((choice) => choice.id === choiceId)) {
      throw new TypeError('Boss or choice is not available');
    }
    return append(current, { id, type: 'boss', bossId, choiceId, date });
  }
  function canScore(state, date) {
    if (!validDate(date) || date < START_DATE || date > END_DATE) return false;
    const current = progress(state);
    return current.pointsUnlocked && date >= current.pointsUnlockedOn;
  }
  function recordScore(state, exerciseId, date, id = freshId()) {
    if (!SCORING_BY_ID.has(exerciseId)) throw new TypeError('Unknown scoring exercise');
    if (!validDate(date)) throw new TypeError('Date must be a valid YYYY-MM-DD date');
    if (!progress(state).pointsUnlocked) throw new TypeError('Reach the castle before recording points');
    if (!canScore(state, date)) throw new TypeError('Points must be dated after unlocking and within the theme');
    return append(state, { id, type: 'score', exerciseId, date });
  }
  function undo(state) {
    const current = checked(state);
    if(current.returnRideChoice==='take'&&!current.returnRideEscaped)throw new TypeError('Complete the escape mission before undo');
    return freezeState(current.events.slice(0, -1), current.stepCredits, current.shortcutChoice, current.rideChoice, current.icecreamChoice, current.returnRideChoice, current.returnRideEscaped);
  }
  function progress(state) {
    const current = checked(state); const p = applySequence(current.events, current.stepCredits);
    return Object.freeze({ position: p.position, completedBossIds: Object.freeze(p.completedBossIds), pendingBoss: p.pendingBoss, finished: p.position === BOARD_SIZE && !p.pendingBoss, pointsUnlocked: p.position === BOARD_SIZE, pointsUnlockedOn: p.pointsUnlockedOn, steps: p.position, bossesDefeated: p.completedBossIds.length });
  }
  function totals(state, date) {
    const current = checked(state);
    if (date !== undefined && !validDate(date)) throw new TypeError('Date must be a valid YYYY-MM-DD date');
    const result = { steps: 0, squats: 0, pushups: 0, pullups: 0, running: 0 };
    for (const event of current.events) {
      if (event.type !== 'exercise' || (date !== undefined && event.date !== date)) continue;
      const exercise = EXERCISE_BY_ID.get(event.exerciseId); result.steps += 1;
      if (exercise.distanceKm) result.running += event.distanceKm;
      else result[event.exerciseId] += exercise.reps;
    }
    return Object.freeze(result);
  }
  function scoreTotals(state, date) {
    const current = checked(state);
    if (date !== undefined && !validDate(date)) throw new TypeError('Date must be a valid YYYY-MM-DD date');
    const result = { points: 0, squats: 0, pushups: 0, pullups: 0, running: 0 };
    for (const event of current.events) {
      if (event.type !== 'score' || (date !== undefined && event.date !== date)) continue;
      const exercise = SCORING_BY_ID.get(event.exerciseId);
      result.points += exercise.points;
      if (exercise.distanceKm) result.running += exercise.distanceKm;
      else result[event.exerciseId] += exercise.reps;
    }
    return Object.freeze(result);
  }
  function stableHash(value) {
    let hash = 2166136261;
    for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  const ANIMALS = Object.freeze(['räv', 'älg', 'hare', 'utter', 'grävling', 'igelkott', 'lodjur', 'björn', 'bäver', 'uggla', 'ekorre', 'varg']);
  const COLORS = Object.freeze(['koppar', 'blåbär', 'mossa', 'plommon', 'solgul', 'korall', 'silver', 'turkos']);
  function avatarFor(identity, index) {
    const hash = stableHash(identity);
    const slot = Number.isInteger(index) && index >= 0 ? index : hash;
    return Object.freeze({ animal: ANIMALS[slot % ANIMALS.length], color: COLORS[Math.floor(slot / ANIMALS.length) % COLORS.length], name: `Äventyraren ${slot + 1}` });
  }
  return Object.freeze({ BOARD_SIZE, START_DATE, END_DATE, FINAL_BOSS_DATE, SAVE_VERSION, MAX_EVENTS, EXERCISES, SCORING_EXERCISES, BOSSES, createState, record, chooseShortcut, chooseRide, chooseIcecream, chooseReturnRide, completeReturnRide, recordScore, canScore, isBossOpen, resolveBoss, undo, restore, progress, totals, scoreTotals, stableHash, avatarFor });
}));
