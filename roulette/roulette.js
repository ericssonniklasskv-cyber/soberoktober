(() => {
  'use strict';
  const R = window.SoberRoulette;
  const feature = document.querySelector('#roulette-dialog');
  const launch = document.querySelector('#training-roulette');
  const opener = document.querySelector('#open-roulette');
  if (!feature || !launch || !opener) return;
  const $ = selector => feature.querySelector(selector);
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const accessStates = ['loading-state', 'signed-out-state', 'error-state'];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let client, session, state, storageKey, subscription, epoch = 0;
  let live = false, revision = 0, liveToday = '', liveTimer;
  const requestedDate = new URLSearchParams(location.search).get('roulette-date');
  let busy = false, rotation = 0, animation = null, operation = 0, flashTimer = null;
  let phase = 'choose', mode = 'primary', viewCategory = 'strength', introTimer = null, winnerTaskId = null;
  let checklistFingerprint = '', resultScroll = 0;
  const categoryComments = Object.freeze({
    strength: 'ooh, big man? Big muscles?',
    cardio: 'Lean och jävligt snärt, sånt gillar vi',
    mobility: 'Aha.... Du valde rörlighet? Var handlar du dina trosor?'
  });
  const flashMessages = Object.freeze({ strength: 'Liten penis', cardio: 'Stor penis', mobility: 'gay' });
  const dateLabel = date => Number(date.slice(-2)) + ' oktober';
  function hideFlash() {
    clearTimeout(flashTimer); flashTimer = null;
    $('#spin-flash').hidden = true; $('#winner-flash').hidden = true; $('#checklist-flash').hidden = true; $('#completed-flash').hidden = true;
  }
  function showFlash(selector, category, anchor) {
    hideFlash();
    if (motion.matches || !feature.open) return;
    const flash = $(selector);
    flash.textContent = flashMessages[category];
    flash.dataset.category = category;
    if (anchor) {
      const target = anchor.getBoundingClientRect(), card = flash.closest('#result-card, #checklist-view, #completed-view').getBoundingClientRect();
      flash.style.top = (target.top - card.top + target.height / 2) + 'px';
    }
    flash.hidden = false;
    flashTimer = setTimeout(hideFlash, 180);
  }
  function cancelIntro() { clearTimeout(introTimer); introTimer = null; }
  function cancelSpin() { cancelIntro(); hideFlash(); operation++; animation?.cancel(); animation = null; busy = false; }
  function showAccess(id) {
    cancelSpin();
    $('#access-panel').hidden = false; $('#sandbox').hidden = true; $('.roulette-navigation').hidden = true;
    accessStates.forEach(name => $('#' + name).hidden = name !== id);
    state = null; storageKey = null;
    document.querySelector('#roulette-open-label').textContent = 'Öppna Spinn The Wheel';
    document.querySelector('#roulette-steps').disabled = id === 'loading-state';
    document.querySelector('#roulette-steps').setAttribute('aria-pressed', 'false');
    document.querySelector('#roulette-steps-label').textContent = 'Hoppar Spinn the wheel men har gått 10 000 steg idag - 1 poäng';
    document.querySelector('#roulette-steps-status').textContent = '';
    if (feature.open && id === 'signed-out-state') feature.close();
  }
  function persist(next) {
    if (!session || !storageKey || !state) return false;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      state = next; $('#storage-status').textContent = ''; return true;
    } catch {
      $('#storage-status').textContent = 'Testet kunde inte sparas. Tillåt lokal lagring och försök igen.'; return false;
    }
  }
  function updateFromStorage() {
    if (live) return Boolean(state);
    try {
      const raw = localStorage.getItem(storageKey) ?? localStorage.getItem(storageKey.replace(':v4:', ':v3:')) ?? localStorage.getItem(storageKey.replace(':v4:', ':v2:')) ?? localStorage.getItem(storageKey.replace(':v4:', ':v1:'));
      state = raw === null ? R.fresh() : R.restore(JSON.parse(raw)); return true;
    }
    catch { $('#storage-status').textContent = 'Testdata kunde inte läsas. Nollställ ditt test för att börja om.'; return false; }
  }
  async function saveOperation(action, payload, localNext) {
    if (!live) return persist(localNext());
    const token = epoch;
    const before = state;
    if (action === 'check') state = R.setStepChecked(state, payload.key, payload.checked);
    const optimistic = state;
    busy = true; render();
    try {
      const { data, error } = await client.rpc('my_training_roulette', {
        p_action: action, p_date: state.date, p_payload: { ...payload, revision }
      });
      if (token !== epoch || !session) return false;
      if (error) {
        if (error.code === '40001') await loadLiveState(state.date);
        else state = before;
        throw error;
      }
      state = R.restore(data.state); revision = data.revision; liveToday = data.today;
      $('#storage-status').textContent = '';
      if (action === 'complete' || action === 'undo' || action === 'steps') window.dispatchEvent(new Event('roulette-result-changed'));
      return true;
    } catch (error) {
      if (token === epoch && state === optimistic) state = before;
      throw error;
    } finally { if (token === epoch) { busy = false; render(); } }
  }
  async function loadLiveState(date) {
    const token = epoch;
    const { data, error } = await client.rpc('my_training_roulette', { p_action: 'get', p_date: date || null });
    if (token !== epoch) return;
    if (error) throw error;
    state = R.restore(data.state); revision = data.revision; liveToday = data.today;
  }
  function buildWheel(taskId = null) {
    const svgNode = (tag, attrs, text) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      if (text !== undefined) el.textContent = text;
      return el;
    };
    const polar = angle => [250 + 218 * Math.cos(angle * Math.PI / 180), 250 + 218 * Math.sin(angle * Math.PI / 180)];
    const parts = [svgNode('circle', { cx: 250, cy: 250, r: 248, fill: '#f7ecd0' }), svgNode('circle', { cx: 250, cy: 250, r: 236, fill: '#b7c09d' })];
    const tasks = R.TASKS[viewCategory], sector = 360 / tasks.length;
    tasks.forEach((task, i) => {
      const start = polar(-90 - sector / 2 + i * sector), end = polar(-90 + sector / 2 + i * sector), level = R.LEVELS[task.level];
      parts.push(svgNode('path', { d: `M250 250 L${start.join(' ')} A218 218 0 0 1 ${end.join(' ')} Z`, fill: level.color, stroke: '#fcf7e4', 'stroke-width': 2 }));
      const group = svgNode('g', { transform: `rotate(${i * sector} 250 250)` });
      group.append(svgNode('text', { x: 250, y: 84, class: 'wheel-label' }, viewCategory === 'mobility' ? task.duration : level.label), svgNode('text', { x: 250, y: 122, class: 'wheel-value' }, level.points), svgNode('text', { x: 250, y: 140, class: 'wheel-unit' }, 'POÄNG'));
      parts.push(group);
    });
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16;
      parts.push(svgNode('circle', { cx: 250 + 235 * Math.sin(angle), cy: 250 - 235 * Math.cos(angle), r: 3.5, fill: '#fff8df' }));
    }
    $('#wheel-segments').replaceChildren(...parts);
    const index = tasks.findIndex(task => task.id === taskId);
    rotation = index >= 0 ? R.landingRotation(0, index, 0, tasks.length) : 0;
    $('#roulette-wheel').style.transform = `rotate(${rotation}deg)`;
  }
  const roundMinutes = day => R.taskIds(day).reduce((sum, id) => sum + Number.parseInt(R.getTask(id).duration, 10), 0);
  const roundLabel = day => R.taskIds(day).length + ' pass · ca ' + roundMinutes(day) + ' min · ' + R.plannedPoints(day) + ' testpoäng';
  function resumePhase() {
    const day = state?.days[state.date];
    return !day ? 'choose' : day.completed ? 'completed' : day.trainingStarted || R.checklistSummary(day).done ? 'checklist' : 'result';
  }
  function renderResult() {
    const day = state.days[state.date];
    if (!day) return;
    const entries = R.taskEntries(day), progress = R.checklistSummary(day);
    $('#result-title').textContent = entries.length === 1 ? 'Ditt lottade pass' : 'Din träningsrunda';
    $('#round-meta').textContent = roundLabel(day);
    $('#combined-workouts').replaceChildren(...entries.map(({ id, slot }, index) => {
      const task = R.getTask(id), level = R.LEVELS[task.level], card = node('article', undefined, 'workout-piece');
      const meta = node('div', undefined, 'result-meta');
      meta.append(node('span', 'Pass ' + (index + 1) + ' · ' + R.CATEGORIES[R.categoryFor(id)].label), node('span', task.duration + ' · ' + level.points + ' p'));
      card.append(meta, node('h4', task.title), node('p', level.label, 'workout-level'));
      const details = node('details', undefined, 'workout-details'), instructions = node('ol', undefined, 'result-instructions');
      details.append(node('summary', 'Visa instruktioner'));
      instructions.append(...task.instructions.map(text => node('li', text))); details.append(instructions); card.append(details);
      const edit = node('details', undefined, 'workout-edit'); edit.append(node('summary', 'Ändra pass'));
      const options = node('div', undefined, 'workout-options');
      const change = node('button', 'Välj annan kategori', 'subtle-button'); change.type = 'button'; change.dataset.changeCategory = slot; change.disabled = busy || day.completed;
      const hasAlternative = R.availableTasks(state, R.categoryFor(id), slot).length > 0;
      const reroll = node('button', 'Snurra igen · 1 frispinn', 'subtle-button'); reroll.type = 'button'; reroll.dataset.reroll = slot; reroll.disabled = busy || day.completed || R.remaining(state) === 0 || !hasAlternative;
      reroll.setAttribute('aria-label', 'Snurra om pass ' + (index + 1) + ' med ett frispinn');
      options.append(change, reroll);
      if (!hasAlternative && !day.completed) options.append(node('p', 'Alla pass i kategorin är redan valda. Byt kategori eller ta bort ett pass för att kunna snurra igen.', 'workout-help'));
      if (index > 0) {
        const remove = node('button', 'Ta bort passet', 'subtle-button'); remove.type = 'button'; remove.dataset.removeExtra = slot; remove.disabled = busy || day.completed;
        remove.setAttribute('aria-label', 'Ta bort pass ' + (index + 1) + ': ' + task.title); options.append(remove);
      }
      if (!R.remaining(state)) options.append(node('p', 'Frispinnen är slut. En ny kategori för den här passdelen kan fortfarande vara gratis.', 'workout-help'));
      edit.append(options); card.append(edit); return card;
    }));
    $('#show-checklist').disabled = busy;
    $('#show-checklist strong').textContent = day.trainingStarted || progress.done ? 'Fortsätt träningsrundan' : 'Starta träningsrundan';
    $('#show-checklist small').textContent = progress.done ? progress.done + ' av ' + progress.total + ' moment klara' : entries.length > 1 ? 'Visa alla pass tillsammans i en checklista' : 'Bocka av dina moment under träningen';
    $('#combine-button').hidden = !R.nextExtraSlot(day);
    $('#combine-button').firstChild.textContent = 'Kombinera med ett pass till · ' + (R.archivedWorkouts(day) + entries.length) + '/' + R.MAX_WORKOUTS + ' pass idag ';
    $('#combine-button').disabled = busy;
    $('#completed-points').textContent = 'Rundan är klar · ' + R.plannedPoints(day) + ' testpoäng';
    $('#completed-meta').textContent = R.taskIds(day).map(id => R.getTask(id).title).join(' + ');
    const completedToday = R.completedWorkouts(day);
    $('#new-round-button').hidden = !R.canStartRound(day);
    $('#new-round-button').disabled = busy || !R.canStartRound(day);
    $('#completed-limit').textContent = completedToday + ' av 3 pass klara idag.' + (completedToday < R.MAX_WORKOUTS ? ' Du kan göra ' + (R.MAX_WORKOUTS - completedToday) + ' pass till.' : ' Dagens pass är klara. Kom tillbaka nästa dag.');
  }
  function renderChecklist() {
    const day = state.days[state.date];
    if (!day) return;
    const entries = R.taskEntries(day), items = R.checklistItems(day);
    const fingerprint = storageKey + '/' + state.date + '/' + entries.map(item => item.id).join(',');
    if (fingerprint !== checklistFingerprint) {
      $('#checklist-workouts').replaceChildren(...entries.map(({ id }, index) => {
        const task = R.getTask(id), group = node('fieldset', undefined, 'checklist-workout');
        const legend = node('legend');
        legend.append(node('span', 'Pass ' + (index + 1) + ' · ' + R.CATEGORIES[R.categoryFor(id)].label + ' · ' + task.duration, 'checklist-workout-meta'), node('strong', task.title, 'checklist-workout-title'));
        const count = node('p', undefined, 'checklist-workout-count'); count.dataset.taskProgress = id;
        group.append(legend, count);
        R.checklistNotes(id).forEach(text => group.append(node('p', text, 'checklist-guidance')));
        items.filter(item => item.taskId === id).forEach(item => {
          const label = node('label', undefined, 'checklist-item'), input = node('input');
          input.type = 'checkbox'; input.dataset.checkStep = item.key;
          const copy = node('span', undefined, 'checklist-item-copy');
          if (item.lead) copy.append(node('strong', item.lead, 'checklist-item-lead'));
          copy.append(node('span', item.text)); label.append(input, copy); group.append(label);
        });
        return group;
      }));
      checklistFingerprint = fingerprint;
    }
    // Update existing controls to retain keyboard focus and scroll while checking off.
    const checked = new Set(day.checkedSteps || []), progress = R.checklistSummary(day);
    $('#checklist-workouts').querySelectorAll('[data-check-step]').forEach(input => {
      input.checked = checked.has(input.dataset.checkStep);
      input.disabled = day.completed;
      input.closest('label').dataset.checked = String(input.checked);
    });
    $('#checklist-workouts').querySelectorAll('[data-task-progress]').forEach(count => {
      const steps = items.filter(item => item.taskId === count.dataset.taskProgress);
      count.textContent = steps.filter(item => checked.has(item.key)).length + ' av ' + steps.length + ' moment klara';
    });
    $('#checklist-progress-text').textContent = progress.done + ' av ' + progress.total + ' moment klara';
    $('#checklist-progress').max = progress.total; $('#checklist-progress').value = progress.done;
    const minutes = entries.reduce((sum, item) => sum + Number.parseInt(R.getTask(item.id).duration, 10), 0);
    $('#checklist-meta').textContent = entries.length + ' pass · ca ' + minutes + ' min · ' + R.plannedPoints(day) + ' testpoäng';
    const exceedsDailyLimit = R.archivedWorkouts(day) + entries.length > R.MAX_WORKOUTS;
    $('#checklist-complete').disabled = busy || (!day.completed && exceedsDailyLimit);
    $('#checklist-complete').textContent = entries.length === 1 ? '✓ Jag har klarat passet' : '✓ Jag har klarat hela rundan';
    $('.checklist-finish').hidden = day.completed;
    $('#checklist-complete').setAttribute('aria-pressed', String(day.completed));
    $('#checklist-hint').textContent = day.completed ? 'Rundan är klar. Du kan ångra klarmarkeringen i avslutningsvyn.' : exceedsDailyLimit ? 'Du har nått dagens gräns på tre pass.' : progress.allDone ? 'Alla moment är bockade. Klarmarkera för att registrera dina ' + R.plannedPoints(day) + ' testpoäng.' : 'Checklistan är frivillig. Klarmarkera när du har gjort passet. Dina bockar sparas automatiskt.';
  }
  function render() {
    if (!state) return;
    const day = state.days[state.date];
    if (phase !== 'intro') cancelIntro();
    feature.dataset.phase = phase;
    $('.roulette-navigation').hidden = false;
    $('#category-intro').hidden = phase !== 'intro';
    $('#category-intro-message').textContent = phase === 'intro' ? categoryComments[viewCategory] : '';
    $('#back-to-categories').hidden = phase === 'choose' || phase === 'checklist' || phase === 'completed' || phase === 'result';
    $('#back-to-categories').disabled = false;
    $('#back-to-categories').textContent = day?.completed ? '← Välj ett nytt pass' : '← Välj annan kategori';
    $('#return-result').hidden = phase !== 'choose' || !day;
    $('#return-result').disabled = busy;
    $('#back-from-checklist').hidden = phase !== 'checklist';
    $('#category-step').hidden = phase !== 'choose';
    $('#wheel-step').hidden = phase !== 'wheel' && phase !== 'winner';
    $('#wheel-play').hidden = phase === 'winner';
    $('#wheel-winner').hidden = phase !== 'winner';
    if (phase === 'winner' && winnerTaskId) {
      const task = R.getTask(winnerTaskId), level = R.LEVELS[task.level];
      $('#winner-title').textContent = task.title;
      $('#winner-meta').textContent = level.label + ' · ' + task.duration + ' · ' + level.points + ' testpoäng';
      $('#continue-result').textContent = R.taskIds(day).length > 1 ? 'Visa mina pass →' : 'Visa mitt pass →';
    }
    $('#result-card').hidden = phase !== 'result';
    $('#checklist-view').hidden = phase !== 'checklist';
    $('#completed-view').hidden = phase !== 'completed';
    $('#cancel-extra').hidden = mode === 'primary' || phase === 'result' || phase === 'intro' || phase === 'winner' || phase === 'completed' || phase === 'checklist';
    $('#cancel-extra').disabled = busy;
    $('#roulette-dialog-title').textContent = phase === 'checklist' ? (day?.completed ? 'Din genomförda runda' : 'Dags att träna') : phase === 'completed' ? 'Rundan är klar' : phase === 'choose' ? (mode !== 'primary' ? 'Vad vill du kombinera ditt pass med?' : 'Vad är herrn sugen på för pass idag?') : phase === 'intro' ? R.CATEGORIES[viewCategory].label : phase === 'winner' ? 'Ditt pass är lottat!' : phase === 'wheel' ? R.CATEGORIES[viewCategory].label + ' · låt hjulet välja' : 'Din träningsrunda';
    $('#selection-caption').textContent = mode !== 'primary' && day ? 'Dina valda pass: ' + R.taskIds(day).map(id => R.getTask(id).title).join(' + ') + '. Välj kategori för ' + (R.slotTaskId(day, mode) ? 'ett annat pass.' : 'ett pass till.') : day?.completed ? 'Dina klara pass och testpoäng sparas. Välj kategori för ett nytt pass.' : 'Välj den träning du känner för idag.';
    $('.category-picker').querySelectorAll('button').forEach(button => { button.disabled = busy; button.setAttribute('aria-pressed', 'false');
      let badge = button.querySelector('.category-cost');
      if (!badge) { badge = node('span', undefined, 'category-cost'); button.append(badge); }
      const categoryCost = R.spinCost(state, button.dataset.category, mode);
      badge.textContent = categoryCost ? '1 frispinn' : 'Gratis';
      if (categoryCost && !R.remaining(state)) { badge.textContent = 'Frispinn slut'; button.disabled = true; }
      if (!R.availableTasks(state, button.dataset.category, mode).length) { badge.textContent = 'Alla pass valda'; button.disabled = true; } });
    const cost = R.spinCost(state, viewCategory, mode), hasAlternative = R.availableTasks(state, viewCategory, mode).length > 0;
    $('#spin-button').disabled = busy || (cost > 0 && R.remaining(state) === 0) || !hasAlternative;
    $('#spin-button').textContent = busy ? 'Hjulet bestämmer…' : cost ? 'Snurra igen · 1 frispinn' : mode !== 'primary' ? 'Snurra ett pass till · gratis' : 'Snurra mitt pass · gratis';
    $('#wheel-title').textContent = R.CATEGORIES[viewCategory].label;
    $('#stage-date').textContent = dateLabel(state.date);
    $('#spin-caption').textContent = !hasAlternative ? 'Alla pass i kategorin är redan valda. Välj en annan kategori eller ta bort ett pass.' : cost ? (R.remaining(state) ? 'Ett nytt pass inom ' + R.CATEGORIES[viewCategory].label.toLowerCase() + ' använder 1 frispinn.' : 'Frispinnen är slut. Välj en kategori du inte har snurrat idag.') : 'Första snurret inom ' + R.CATEGORIES[viewCategory].label.toLowerCase() + (mode !== 'primary' ? ' för extra passet' : '') + ' är gratis.';
    $('#free-spin-count').textContent = R.remaining(state) + '/5';
    $('#sandbox').setAttribute('aria-busy', String(busy));
    $('#reset-test').disabled = busy;
    renderResult();
    if (phase === 'checklist') renderChecklist();
    const previousPoints = (day?.completedRounds || []).reduce((sum, round) => sum + R.plannedPoints(round), 0);
    $('#previous-points').hidden = !previousPoints;
    $('#previous-points').textContent = 'Tidigare klara pass idag: ' + previousPoints + ' testpoäng.';
    const score = R.summary(state);
    $('#week-points').textContent = score.total; $('#week-completed').textContent = score.days + ' av 7 dagar';
    $('#week-days').replaceChildren(...R.DATES.map(date => {
      const item = state.days[date], button = node('button', undefined, 'week-day');
      button.type = 'button'; button.dataset.date = date; button.disabled = busy;
      if (live) button.hidden = date !== liveToday && date !== window.SoberOctoberCalendar.shiftDate(liveToday, -1);
      button.setAttribute('aria-pressed', String(date === state.date));
      button.append(node('span', Number(date.slice(-2)) + ' okt'), node('strong', (state.steps || []).includes(date) ? '1 p · steg' : R.dayPoints(item) ? R.dayPoints(item) + ' p' : item ? 'Lottat' : '–'));
      return button;
    }));
    const progress = day ? R.checklistSummary(day) : null;
    document.querySelector('#roulette-invite').textContent = day?.completed ? 'Dagens runda är klar · ' + R.plannedPoints(day) + ' testpoäng!' : day && (day.trainingStarted || progress.done) ? 'Fortsätt din träningsrunda · ' + progress.done + ' av ' + progress.total + ' moment klara' : day ? 'Din träningsrunda väntar på dig!' : 'Dagens Spinn The Wheel!';
    document.querySelector('#roulette-launch-summary').textContent = day ? roundLabel(day) : 'Välj kondition, styrka eller rörlighet. Ditt pass väntar ett snurr bort.';
    if (live) {
      $('#reset-test').hidden = true;
      $('.roulette-test-tools summary').textContent = 'Dagens och gårdagens pass · veckopoäng';
      $('.roulette-test-tools p').textContent = '12–18 oktober · högst tre pass per dag';
      const past = state.date !== liveToday;
      const readOnly = !window.SoberRouletteLive.active() || state.date < window.SoberOctoberCalendar.shiftDate(liveToday, -1);
      $('#new-round-button').hidden ||= past;
      $('#combine-button').hidden ||= past;
      $('#spin-button').disabled ||= past;
      feature.querySelectorAll('[data-reroll],[data-change-category],[data-remove-extra]').forEach(button => button.disabled ||= past);
      $('#checklist-complete').disabled ||= readOnly;
      $('#undo-completion').disabled = readOnly || busy;
      feature.querySelectorAll('[data-check-step]').forEach(input => input.disabled ||= readOnly || busy);
      if (past) $('.category-picker').querySelectorAll('button').forEach(button => button.disabled = true);
      const text = document.createTreeWalker(feature, NodeFilter.SHOW_TEXT);
      while (text.nextNode()) text.currentNode.nodeValue = text.currentNode.nodeValue.replace(/testpoäng/g, 'poäng');
      document.querySelector('#roulette-invite').textContent = document.querySelector('#roulette-invite').textContent.replace(/testpoäng/g, 'poäng');
      document.querySelector('#roulette-launch-summary').textContent = document.querySelector('#roulette-launch-summary').textContent.replace(/testpoäng/g, 'poäng');
    }
    const stepsSelected = (state.steps || []).includes(state.date);
    document.querySelector('#roulette-open-label').textContent = stepsSelected ? 'Byt till Spinn The Wheel' : day?.completed ? 'Visa min runda' : day ? 'Fortsätt min runda' : 'Öppna Spinn The Wheel';
    const pastDate = live && state.date !== liveToday;
    const stepsReadOnly = live && (!window.SoberRouletteLive.active() || state.date < window.SoberOctoberCalendar.shiftDate(liveToday, -1));
    const stepButton = document.querySelector('#roulette-steps');
    stepButton.setAttribute('aria-pressed', String(stepsSelected));
    stepButton.disabled = busy || stepsReadOnly || R.dayPoints(day) > 0;
    document.querySelector('#roulette-steps-label').textContent = stepsSelected ? '10 000 steg registrerade - 1 poäng · klicka för att ångra' : 'Hoppar Spinn the wheel men har gått 10 000 steg ' + (pastDate ? dateLabel(state.date) : 'idag') + ' - 1 poäng';
    document.querySelector('#roulette-steps-status').textContent = R.dayPoints(day) > 0 ? 'Du har valt roulette för den här dagen.' : stepsSelected ? 'Stegen är dagens val. Klicka ur dem för att köra roulette istället.' : '';
    $('#roulette-steps-view').hidden = !stepsSelected;
    $('#roulette-undo-steps').disabled = busy || stepsReadOnly;
    if (stepsSelected) {
      ['#category-step','#category-intro','#wheel-step','#result-card','#checklist-view','#completed-view'].forEach(id => $(id).hidden = true);
      $('.roulette-navigation').hidden = true;
      $('#roulette-dialog-title').textContent = 'Dagens steg är klara';
      document.querySelector('#roulette-invite').textContent = '10 000 steg är klara · 1 poäng!';
      document.querySelector('#roulette-launch-summary').textContent = 'Klicka ur stegen ovanför om du vill köra Spinn The Wheel istället.';
    }
    updateHeaderHeight();
  }
  function updateHeaderHeight() {
    if (feature.open) feature.style.setProperty('--roulette-header-height', $('.roulette-modal-head').offsetHeight + 'px');
  }
  new ResizeObserver(updateHeaderHeight).observe($('.roulette-modal-head'));
  function choose(category) {
    if (!state || busy || phase !== 'choose' || !updateFromStorage()) return;
    try {
      if (mode === 'primary' && !live && !persist(R.chooseCategory(state, category))) return;
      viewCategory = category; $('#spin-status').textContent = ''; phase = 'intro'; render(); feature.scrollTop = 0;
      $('#category-intro-message').focus({ preventScroll: true });
      const token = epoch, myOperation = operation;
      introTimer = setTimeout(() => {
        introTimer = null;
        if (!state || !feature.open || phase !== 'intro' || token !== epoch || myOperation !== operation) return;
        phase = 'wheel'; buildWheel(); render(); feature.scrollTop = 0;
        $('#spin-button').focus({ preventScroll: true });
      }, 3200);
    } catch (error) { $('#storage-status').textContent = error.message; }
  }
  async function spin() {
    if (!state || !session || busy || !updateFromStorage()) return;
    const startingOperation = operation;
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    try {
      if (!await saveOperation('draw', { category: viewCategory, slot: mode }, () => mode !== 'primary' ? R.slotTaskId(state.days[state.date], mode) ? R.replaceExtra(state, viewCategory, random, mode) : R.combine(state, viewCategory, random) : R.spin(R.chooseCategory(state, viewCategory), random))) return;
    }
    catch (error) { $('#spin-status').textContent = error.message; return; }
    if (startingOperation !== operation || !feature.open) return;
    const token = epoch, myOperation = ++operation;
    busy = true; render(); $('#spin-status').textContent = 'Ödet jobbar på saken.';
    showFlash('#spin-flash', viewCategory);
    const day = state.days[state.date], taskId = R.slotTaskId(day, mode);
    const previous = rotation;
    rotation = R.landingRotation(rotation, R.TASKS[viewCategory].findIndex(task => task.id === taskId), 5, R.TASKS[viewCategory].length);
    const wheel = $('#roulette-wheel'); wheel.style.transform = `rotate(${rotation}deg)`;
    if (!motion.matches) {
      animation = wheel.animate([{ transform: `rotate(${previous}deg)` }, { transform: `rotate(${rotation}deg)` }], { duration: 2200, easing: 'cubic-bezier(.13,.65,.16,1)' });
      try { await animation.finished; } catch { return; }
    }
    if (myOperation !== operation || token !== epoch || !state || !feature.open) return;
    hideFlash(); animation = null; busy = false;
    winnerTaskId = taskId; phase = 'winner'; render();
    $('#winner-title').focus({ preventScroll: true });
    showFlash('#winner-flash', viewCategory);
  }
  opener.addEventListener('click', () => {
    delete feature.dataset.choiceReturn;
    if (state && updateFromStorage()) { mode = 'primary'; phase = resumePhase(); render(); }
    feature.showModal(); document.body.classList.add('roulette-modal-open'); updateHeaderHeight();
    if (state && phase === 'checklist') $('#checklist-progress-text').focus({ preventScroll: true });
    if (state && phase === 'completed') $('#completed-title').focus({ preventScroll: true });
    if (state && phase === 'choose') $('#roulette-dialog-title').focus({ preventScroll: true });
  });
  async function toggleSteps() {
    if (busy) return;
    if (!state || !session) { document.querySelector('#auth-trigger')?.click(); return; }
    if (!updateFromStorage()) return;
    const checked = !(state.steps || []).includes(state.date);
    try {
      if (await saveOperation('steps', { checked }, () => R.setSteps(state, checked))) {
        phase = resumePhase(); render();
        if (feature.open) $('#roulette-dialog-title').focus({preventScroll:true});
      }
    } catch (error) {
      document.querySelector('#roulette-steps-status').textContent = error.message;
      $('#roulette-steps-feedback').textContent = error.message;
    }
  }
  document.querySelector('#roulette-steps').addEventListener('click', toggleSteps);
  $('#roulette-undo-steps').addEventListener('click', toggleSteps);
  $('#close-roulette').addEventListener('click', () => feature.close());
  feature.addEventListener('close', () => {
    cancelSpin(); document.body.classList.remove('roulette-modal-open');
    if (state) { mode = 'primary'; phase = resumePhase(); render(); }
    opener.focus();
  });
  feature.addEventListener('click', event => {
    if (event.target !== feature) return;
    const bounds = feature.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) feature.close();
  });
  function showCategories(slot = 'primary') {
    if (!state) return;
    cancelSpin(); if (!updateFromStorage()) return;
    feature.dataset.choiceReturn = 'true';
    mode = slot; phase = 'choose'; render(); feature.scrollTop = 0;
    $('#roulette-dialog-title').focus({ preventScroll: true });
  }
  $('#back-to-categories').addEventListener('click', () => showCategories(phase === 'result' ? 'primary' : mode));
  $('#return-result').addEventListener('click', () => { mode = 'primary'; phase = state.days[state.date]?.completed ? 'completed' : 'result'; render(); feature.scrollTop = 0; $(phase === 'completed' ? '#completed-title' : '#result-card').focus({ preventScroll: true }); });
  $('.category-picker').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (button) choose(button.dataset.category); });
  $('#spin-button').addEventListener('click', spin);
  $('#continue-result').addEventListener('click', () => {
    if (!state || busy || phase !== 'winner') return;
    hideFlash(); mode = 'primary'; phase = 'result'; render();
    feature.scrollTop = 0; $('#result-card').focus({ preventScroll: true });
  });
  $('#show-checklist').addEventListener('click', async () => {
    if (busy || !state || !updateFromStorage()) return;
    try { if (!await saveOperation('start', {}, () => R.startTraining(state))) return; }
    catch (error) { $('#result-feedback').textContent = error.message; return; }
    hideFlash(); resultScroll = feature.scrollTop; mode = 'primary'; phase = 'checklist'; render();
    $('#checklist-feedback').textContent = ''; feature.scrollTop = 0;
    $('#roulette-dialog-title').focus({ preventScroll: true });
  });
  $('#back-from-checklist').addEventListener('click', () => {
    hideFlash(); phase = 'result'; render(); feature.scrollTop = resultScroll;
    if (state.days[state.date]?.completed) { phase = 'completed'; render(); $('#completed-title').focus({ preventScroll: true }); }
    else $('#show-checklist').focus({ preventScroll: true });
  });
  $('#checklist-workouts').addEventListener('change', async event => {
    const input = event.target.closest('[data-check-step]');
    if (!input || !state || busy) return;
    if (!updateFromStorage()) { renderChecklist(); $('#checklist-feedback').textContent = 'Dina bockar kunde inte läsas. Försök igen.'; return; }
    const wasCompleted = state.days[state.date]?.completed;
    try {
      if (await saveOperation('check', { key: input.dataset.checkStep, checked: input.checked }, () => R.setStepChecked(state, input.dataset.checkStep, input.checked))) {
        render();
        $('#checklist-feedback').textContent = wasCompleted && !state.days[state.date].completed ? 'Rundan är avmarkerad. Dina övriga bockar finns kvar.' : '';
      } else {
        renderChecklist(); $('#checklist-feedback').textContent = 'Din markering kunde inte sparas. Försök igen.';
      }
    } catch (error) { renderChecklist(); $('#checklist-feedback').textContent = error.message; }
  });
  $('#combine-button').addEventListener('click', () => {
    if (busy || !state || !updateFromStorage()) return;
    const slot = R.nextExtraSlot(state.days[state.date]);
    if (!slot) { render(); return; }
    mode = slot; phase = 'choose'; render(); feature.scrollTop = 0; $('#roulette-dialog-title').focus({ preventScroll: true });
  });
  $('#cancel-extra').addEventListener('click', () => { mode = 'primary'; phase = 'result'; render(); });
  $('#combined-workouts').addEventListener('click', async event => {
    const remove = event.target.closest('[data-remove-extra]');
    if (remove) {
      if (busy || !state || !updateFromStorage()) return;
      try { if (await saveOperation('remove', { slot: remove.dataset.removeExtra }, () => R.removeExtra(state, remove.dataset.removeExtra))) render(); }
      catch (error) { $('#result-feedback').textContent = error.message; }
      return;
    }
    const change = event.target.closest('[data-change-category]');
    if (change) { showCategories(change.dataset.changeCategory); return; }
    const button = event.target.closest('[data-reroll]');
    if (!button || busy || !state || !updateFromStorage()) return;
    mode = button.dataset.reroll;
    const taskId = R.slotTaskId(state.days[state.date], mode); viewCategory = R.categoryFor(taskId);
    phase = 'wheel'; buildWheel(taskId); render(); feature.scrollTop = 0; $('#spin-button').focus({ preventScroll: true });
  });
  $('#checklist-complete').addEventListener('click', async () => {
    if (busy || !state || !updateFromStorage()) return;
    const day = state.days[state.date];
    if (!day || day.completed) return;
    try {
      if (await saveOperation('complete', {}, () => R.toggleCompleted(state))) {
        phase = 'completed'; render(); feature.scrollTop = 0;
        $('#completed-title').focus({ preventScroll: true });
        showFlash('#completed-flash', R.categoryFor(day.taskId), $('#completed-title'));
      }
    } catch (error) { $('#checklist-feedback').textContent = error.message; }
  });
  $('#undo-completion').addEventListener('click', async () => {
    if (busy || !state || !updateFromStorage() || !state.days[state.date]?.completed) return;
    try {
      if (await saveOperation('undo', {}, () => R.toggleCompleted(state))) {
        phase = 'checklist'; render(); feature.scrollTop = 0;
        $('#checklist-feedback').textContent = 'Klarmarkeringen är ångrad. Dina bockar finns kvar.';
        $('#roulette-dialog-title').focus({ preventScroll: true });
      }
    } catch (error) { $('#completed-feedback').textContent = error.message; }
  });
  $('#roulette-login').addEventListener('click', () => {
    feature.close(); document.querySelector('#auth-trigger')?.click();
  });
  $('#completed-home').addEventListener('click', () => feature.close());
  $('#new-round-button').addEventListener('click', () => { if (state && updateFromStorage() && R.canStartRound(state.days[state.date])) showCategories('primary'); });
  $('#review-round').addEventListener('click', () => { phase = 'checklist'; render(); feature.scrollTop = 0; $('#roulette-dialog-title').focus({ preventScroll: true }); });
  $('#week-days').addEventListener('click', async event => {
    const button = event.target.closest('[data-date]');
    if (!button || busy || !state || !updateFromStorage()) return;
    try {
      if (live) await loadLiveState(button.dataset.date);
      else if (!persist(R.changeDate(state, button.dataset.date))) return;
      mode = 'primary'; phase = resumePhase(); render();
    } catch (error) { $('#storage-status').textContent = error.message; }
  });
  $('#reset-test').addEventListener('click', () => {
    if (live) return;
    if (!state || busy || !window.confirm('Nollställ dina lokala testpass, testpoäng och frispinn?')) return;
    if (persist(R.fresh())) { mode = 'primary'; phase = 'choose'; render(); }
  });
  function onStorage(event) {
    if (!state || (event.key !== storageKey && event.key !== null)) return;
    const wasChecklist = phase === 'checklist';
    cancelSpin(); if (updateFromStorage()) { mode = 'primary'; phase = wasChecklist && state.days[state.date] && !state.days[state.date].completed ? 'checklist' : resumePhase(); render(); }
  }
  function onMotionChange() { if (motion.matches) { hideFlash(); animation?.finish(); } }
  window.addEventListener('storage', onStorage); motion.addEventListener('change', onMotionChange);
  window.addEventListener('pagehide', event => {
    cancelSpin(); if (!event.persisted) { subscription?.unsubscribe(); window.removeEventListener('storage', onStorage); motion.removeEventListener('change', onMotionChange); }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) void refreshSession(); });
  async function handleSession(nextSession, token) {
    if (token !== epoch) return;
    session = nextSession;
    if (!session) { if (token === epoch) showAccess('signed-out-state'); return; }
    if (live && !window.SoberRouletteLive.active() && !window.SoberRouletteLive.isDate(requestedDate)) { state = null; return; }
    const { data: profile, error } = await client.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle();
    if (token !== epoch) return;
    if (error) throw error;
    if (!profile?.display_name) { showAccess('signed-out-state'); return; }
    storageKey = 'soberoktober:roulette-test:v4:2026-10-12:' + session.user.id;
    state = R.fresh();
    if (live) await loadLiveState(window.SoberRouletteLive.isDate(requestedDate) ? requestedDate : null); else updateFromStorage();
    $('#roulette-identity').textContent = profile.display_name;
    $('#access-panel').hidden = true; $('#sandbox').hidden = false;
    viewCategory = state.category;
    phase = resumePhase();
    render();
    if (live && window.SoberRouletteLive.isDate(requestedDate) && !feature.open) {
      feature.showModal(); document.body.classList.add('roulette-modal-open');
    }
  }
  function loadError(token) {
    if (token !== epoch) return;
    showAccess('error-state');
    $('#load-error').textContent = 'Kontrollera anslutningen och försök igen. Din vanliga inloggning används även här.';
  }
  async function refreshSession() {
    const token = ++epoch;
    showAccess('loading-state');
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (token === epoch) await handleSession(data.session, token);
    } catch { loadError(token); }
  }
  async function init(sharedClient, config) {
    live = config.rouletteMode === 'server' || !localPreview(config);
    if (live && !window.SoberRouletteLive) return;
    client = sharedClient;
    syncActivation();
    const workoutNav = document.querySelector('.main-nav a[href="#dagens-pass"], .main-nav a[href="#competition-bingo"]');
    if (workoutNav && !launch.hidden) { workoutNav.href = '#training-roulette'; workoutNav.textContent = 'Spinn The Wheel'; }
    try {
      subscription = client.auth.onAuthStateChange((event, nextSession) => {
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        const token = ++epoch;
        showAccess(nextSession ? 'loading-state' : 'signed-out-state');
        // Never await another Supabase call from inside its auth callback.
        setTimeout(() => {
          if (token === epoch) void handleSession(nextSession, token).catch(() => loadError(token));
        }, 0);
      }).data?.subscription;
      await refreshSession();
    } catch { loadError(epoch); }
  }
  function syncActivation() {
    const enabled = !live || window.SoberRouletteLive.active() || window.SoberRouletteLive.isDate(requestedDate);
    const replaces = live && window.SoberRouletteLive.replacesToday(window.SoberOctoberCalendar.stockholmDate());
    launch.hidden = !enabled;
    document.body.classList.toggle(live ? 'roulette-live' : 'roulette-home-preview', live ? replaces : enabled);
    const note = document.querySelector('.roulette-local-note');
    if (live && note) note.hidden = true;
    if (live && replaces) {
      document.querySelector('#dagens-pass').hidden = true;
      document.querySelector('#competition-bingo').hidden = true;
      const summary = document.querySelector('#score-summary');
      if (summary && summary.parentElement !== launch) launch.append(summary);
    }
    if (live) {
      clearTimeout(liveTimer);
      const upcoming = [window.SoberRouletteLive.START_INSTANT, window.SoberRouletteLive.END_INSTANT].filter(time => time > Date.now());
      liveTimer = setTimeout(async () => {
        syncActivation();
        if (!enabled && window.SoberRouletteLive.active()) { await refreshSession(); return; }
        if (enabled && session && !busy && !document.hidden) {
          try {
            const before = liveToday;
            await loadLiveState(state?.date);
            if (before !== liveToday) await loadLiveState();
            phase = resumePhase(); render();
          } catch (error) { $('#storage-status').textContent = error.message; }
        }
      }, Math.min(60000, upcoming.length ? Math.min(...upcoming) - Date.now() + 25 : 60000));
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (live && !document.hidden) {
      syncActivation();
      if (session && !busy) void loadLiveState().then(() => { phase = resumePhase(); render(); }).catch(() => {});
    }
  });
  $('#retry-load').addEventListener('click', () => {
    if (client) void refreshSession();
  });
  function localPreview(config) {
    try {
      const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
      const api = new URL(config.supabaseUrl);
      return location.protocol === 'http:' && loopback(location.hostname) &&
        api.protocol === 'http:' && loopback(api.hostname) && api.port === '54321' &&
        !api.username && !api.password && api.pathname === '/' && !api.search && !api.hash;
    } catch { return false; }
  }
  window.SoberRouletteUI = Object.freeze({ init, refresh: refreshSession });
})();
