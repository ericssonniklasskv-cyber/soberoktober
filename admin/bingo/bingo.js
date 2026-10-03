(() => {
  const $ = (selector) => document.querySelector(selector);
  const accessStates = ['loading-state', 'signed-out-state', 'denied-state', 'error-state'];
  let client, session, state, busy = false, boardDirty = false, editorSignature = '';
  let sessionWork = Promise.resolve(), confirmation = null;
  const format = new Intl.NumberFormat('sv-SE');
  const dateText = day => new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', timeZone: 'Europe/Stockholm' }).format(new Date(day + 'T12:00:00+02:00'));
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function showAccess(id) {
    $('#access-panel').hidden = false;
    $('#sandbox').hidden = true;
    accessStates.forEach(name => $('#' + name).hidden = name !== id);
    if (id !== 'loading-state') state = null;
  }
  function setBusy(value) {
    busy = value;
    $('#sandbox').setAttribute('aria-busy', String(value));
    $('#sandbox').querySelectorAll('button').forEach(button => button.disabled = value);
    $('#test-date').disabled = value;
    if (!value && state) {
      $('#next-day').disabled = state.simulated_date >= '2026-10-12';
      $('#save-board').disabled = Object.keys(state.completed_cells).length > 0;
      $('.board-fields').querySelectorAll('fieldset').forEach(fieldset => {
        fieldset.disabled = Object.keys(state.completed_cells).length > 0;
      });
      $('.bingo-board').querySelectorAll('button').forEach(button => {
        button.disabled = !Object.hasOwn(state.completed_cells, button.dataset.cell) && (Boolean(state.elimination_date) || state.simulated_date > '2026-10-11');
      });
      $('#test-alcohol').disabled = Boolean(state.elimination_date);
    }
  }
  function renderEditor(force = false) {
    const signature = JSON.stringify(state.board);
    if (!force && signature === editorSignature) return;
    editorSignature = signature;
    boardDirty = false;
    const fields = state.board.map((task, index) => {
      const fieldset = node('fieldset', undefined, 'task-fieldset');
      fieldset.append(node('legend', 'Ruta ' + (index + 1)));
      [['label', 'Kortnamn', 'text', 60], ['description', 'Hela uppgiften', 'textarea', 240], ['base_amount', 'Mängd i rapporten', 'number'], ['unit', 'Enhet / övning', 'text', 64]].forEach(([key, caption, type, limit]) => {
        const label = node('label', caption);
        const field = node(type === 'textarea' ? 'textarea' : 'input');
        if (type !== 'textarea') field.type = type;
        field.name = key;
        field.id = 'task-' + index + '-' + key;
        field.value = task[key];
        field.required = true;
        if (limit) field.maxLength = limit;
        if (type === 'number') { field.min = '1'; field.max = '100000'; field.step = '1'; field.inputMode = 'numeric'; }
        label.append(field);
        fieldset.append(label);
      });
      return fieldset;
    });
    $('#board-fields').replaceChildren(...fields);
  }
  function render() {
    const score = state.score;
    $('#total-points').textContent = score.total_points;
    $('#cell-points').textContent = score.cell_points + ' / 25';
    $('#day-bonus-points').textContent = score.day_bonus_points + ' / 7';
    $('#line-points').textContent = score.line_points + ' / 10';
    $('#full-points').textContent = score.full_board_points + ' / 10';
    $('#board-progress').textContent = score.cell_points + ' av 25 klara';
    $('#score-caption').textContent = score.cell_points === 25 ? 'Alla 25 rutor klara!' : score.cell_points ? 'Varje ruta tar dig närmare bingo.' : 'Din första ruta väntar.';
    $('#test-date').value = state.simulated_date;
    $('#test-date').min = state.simulated_date;
    $('#restore-test').hidden = !state.elimination_date;
    const activeToday = state.activity_dates.includes(state.simulated_date);
    const yesterday = new Date(state.simulated_date + 'T12:00:00Z');
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const warning = state.simulated_date <= '2026-10-11' && yesterdayKey >= '2026-10-05' && !state.activity_dates.includes(yesterdayKey) && !activeToday;
    $('#competition-state').classList.toggle('eliminated', Boolean(state.elimination_date));
    $('#competition-state').textContent = state.elimination_date
      ? 'Utslagen i testet · ' + state.elimination_reason + ' · ' + dateText(state.elimination_date)
      : state.simulated_date > '2026-10-11' ? 'Bingoveckan är avslutad i testet.'
      : warning ? 'Du missade igår – en aktivitet idag håller dig kvar i testet.'
      : activeToday ? 'Dagens aktivitet är registrerad. Du är fortfarande med i testet.'
      : 'Du är fortfarande med i testet. Gör en aktivitet idag!';
    const nextCellPoints = activeToday ? 1 : 2;
    const buttons = state.board.map((task, index) => {
      const completed = Object.hasOwn(state.completed_cells, String(index));
      const inLine = score.rows.includes(Math.floor(index / 5)) || score.columns.includes(index % 5);
      const button = node('button', undefined, 'bingo-cell' + (completed ? ' completed' : '') + (inLine ? ' in-line' : ''));
      button.type = 'button';
      button.dataset.cell = index;
      button.title = task.description;
      button.setAttribute('aria-label', 'Ruta ' + (index + 1) + ': ' + task.description + (completed ? '. Klar. Klicka för att avmarkera.' : '. Markera som klar för ' + nextCellPoints + ' poäng.'));
      button.append(node('span', (index + 1) + (completed ? ' ✓' : ''), 'cell-number'), node('span', task.description, 'cell-label'), node('span', completed ? 'Klar · avmarkera' : '+' + nextCellPoints + ' poäng', 'cell-points'));
      return button;
    });
    $('#bingo-board').replaceChildren(...buttons);
    $('#line-status').textContent = score.rows.length + ' vågräta · ' + score.columns.length + ' lodräta rader klara';
    $('#task-list').replaceChildren(...state.board.map((task, index) => {
      const li = node('li', task.description, Object.hasOwn(state.completed_cells, String(index)) ? 'done' : '');
      if (Object.hasOwn(state.completed_cells, String(index))) li.append(node('small', '✓ Klar ' + dateText(state.completed_cells[index])));
      return li;
    }));
    const report = window.SoberOctoberBingo.createReport(state);
    $('#report-availability').textContent = report.final ? 'Avslutad · test' : 'Pågår · test';
    $('#report-kicker').textContent = report.final ? 'Slutrapport för bingoveckan · test' : 'Rapportutkast · test';
    $('#report-days').textContent = report.completedDays + ' / 7';
    $('#report-missed').textContent = report.missedDays;
    $('#report-streak').textContent = report.longestStreak;
    $('#report-status').textContent = score.total_points + ' bingopoäng · ' + score.cell_points + ' avklarade rutor · ' + score.day_bonus_points + ' dagliga extrapoäng · ' + score.line_points + ' rader' + (state.elimination_date ? ' · Utslagen: ' + state.elimination_reason : ' · Aktiv');
    $('#activity-days').replaceChildren(...report.days.map(day => {
      const label = day.state === 'completed' ? '✓ Klar' : day.state === 'missed' ? 'Missad' : 'Kommande';
      const item = node('div', undefined, 'activity-day ' + day.state);
      item.setAttribute('aria-label', dateText(day.date) + ': ' + label);
      item.append(node('strong', Number(day.date.slice(-2)) + ' okt'), node('span', label));
      return item;
    }));
    $('#exercise-totals').replaceChildren(...(report.exerciseTotals.length
      ? report.exerciseTotals.map(item => node('li', format.format(item.amount) + ' ' + item.unit))
      : [node('li', 'Klara en ruta så börjar din sammanfattning växa.')]));
    renderEditor();
    setBusy(busy);
  }
  async function runAction(action, payload = {}) {
    if (busy || !session || !state) return;
    if (action === 'complete' && boardDirty) {
      $('#save-status').textContent = 'Spara dina ändringar i testbrickan innan du markerar en ruta.';
      return;
    }
    const beforePoints = state.score.total_points;
    setBusy(true);
    $('#save-status').textContent = 'Sparar bara i testmiljön…';
    try {
      const { data, error } = await client.rpc('admin_bingo_test', { p_action: action, p_payload: payload });
      if (error) throw error;
      state = data;
      if (action === 'save_board') renderEditor(true);
      render();
      let message = 'Testet är sparat.';
      if (action === 'complete') {
        const gained = state.score.total_points - beforePoints;
        message = state.new_completion ? 'Snyggt! +' + gained + ' testpoäng' + '.'
          : state.new_activity ? 'Dagens aktivitet är registrerad. Rutan gav inga nya poäng.'
          : 'Rutan och dagens aktivitet är redan registrerade. Inga nya poäng.';
      }
      if (action === 'uncomplete') message = 'Rutan är avmarkerad. Testpoäng, radbonus och aktivitetsdagar har räknats om.';
      if (action === 'set_date') message = 'Testdatum: ' + dateText(state.simulated_date) + '.';
      if (action === 'reset') { message = 'Testet är nollställt. Dina uppgifter finns kvar.'; renderEditor(true); }
      if (action === 'save_board') { message = 'Testbrickan är sparad.'; $('#editor-status').textContent = message; }
      if (action === 'eliminate') message = 'Testdeltagaren är utslagen för alkohol.';
      if (action === 'restore') message = 'Testdeltagaren är aktiv igen. Tidigare testpoäng finns kvar.';
      $('#save-status').textContent = message;
      $('#save-status').classList.remove('celebrate');
      if (action === 'complete' && state.new_completion) {
        void $('#save-status').offsetWidth;
        $('#save-status').classList.add('celebrate');
      }
    } catch (error) {
      console.error('Bingotestet kunde inte sparas', error);
      const denied = error.code === '42501' && /Admin access required/i.test(error.message || '');
      if (denied) {
        showAccess('denied-state');
      } else {
        $('#save-status').textContent = error.message || 'Testet kunde inte sparas. Försök igen.';
        if (action === 'save_board') $('#editor-status').textContent = $('#save-status').textContent;
      }
    } finally { setBusy(false); }
  }
  function askConfirmation(action, title, copy) {
    if (busy) return;
    confirmation = action;
    $('#confirm-title').textContent = title;
    $('#confirm-copy').textContent = copy;
    $('#confirm-dialog').showModal();
    $('#cancel-confirm').focus();
  }
  $('#bingo-board').addEventListener('click', event => {
    const cell = event.target.closest('button[data-cell]');
    if (cell) void runAction(Object.hasOwn(state.completed_cells, cell.dataset.cell) ? 'uncomplete' : 'complete', { cell: Number(cell.dataset.cell) });
  });
  $('#date-form').addEventListener('submit', event => {
    event.preventDefault();
    if ($('#date-form').reportValidity()) void runAction('set_date', { date: $('#test-date').value });
  });
  $('#next-day').addEventListener('click', () => {
    const next = new Date(state.simulated_date + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    void runAction('set_date', { date: next.toISOString().slice(0, 10) });
  });
  $('#reset-test').addEventListener('click', () => askConfirmation('reset', 'Nollställ ditt bingotest?', 'Bara testmarkeringar, testpoäng och simulerad status återställs. Uppgifterna på brickan behålls. Riktiga resultat påverkas inte.'));
  $('#test-alcohol').addEventListener('click', () => askConfirmation('eliminate', 'Simulera utslagning för alkohol?', 'Det här slår bara ut din simulerade testdeltagare. Ditt riktiga konto och din tävlingsstatus påverkas inte.'));
  $('#restore-test').addEventListener('click', () => askConfirmation('restore', 'Återställ testdeltagaren?', 'Testdeltagaren blir aktiv igen. Gamla testpoäng behålls och tidigare missar slår inte direkt ut deltagaren på nytt.'));
  $('#cancel-confirm').addEventListener('click', () => { confirmation = null; $('#confirm-dialog').close(); });
  $('#confirm-dialog').addEventListener('cancel', () => { confirmation = null; });
  $('#accept-confirm').addEventListener('click', () => {
    const action = confirmation;
    confirmation = null;
    $('#confirm-dialog').close();
    if (action) void runAction(action);
  });
  $('#board-fields').addEventListener('input', () => {
    boardDirty = true;
    $('#editor-status').textContent = 'Osparade ändringar i testbrickan.';
  });
  $('#board-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('#board-form').reportValidity()) return;
    const board = [...$('#board-fields').querySelectorAll('fieldset')].map(fieldset => {
      const values = Object.fromEntries([...fieldset.querySelectorAll('input,textarea')].map(field => [field.name, field.value.trim()]));
      return { ...values, base_amount: Number(values.base_amount) };
    });
    void runAction('save_board', { board });
  });
  async function handleSession(nextSession) {
    showAccess('loading-state');
    session = nextSession;
    state = null;
    if (!session) { showAccess('signed-out-state'); return; }
    const { data: profile, error } = await client.from('profiles').select('is_admin,display_name').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!profile?.is_admin) { showAccess('denied-state'); return; }
    const { data, error: sandboxError } = await client.rpc('admin_bingo_test', { p_action: 'get', p_payload: {} });
    if (sandboxError) throw sandboxError;
    state = data;
    editorSignature = '';
    $('#admin-identity').textContent = profile.display_name || 'Admin';
    $('#access-panel').hidden = true;
    $('#sandbox').hidden = false;
    $('#save-status').textContent = '';
    render();
  }
  function loadError(error) {
    console.error('Bingotestet kunde inte laddas', error);
    showAccess('error-state');
    $('#load-error').textContent = 'Kontrollera anslutningen och försök igen. Om felet kvarstår behöver bingotestets databasinställning kontrolleras.';
  }
  async function init() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Konfigurationen saknas');
      const config = await response.json();
      if (!config.supabaseUrl || !config.supabasePublishableKey || !window.supabase) throw new Error('Ogiltig konfiguration');
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await handleSession(data.session);
      client.auth.onAuthStateChange((event, nextSession) => {
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        sessionWork = sessionWork.then(() => handleSession(nextSession)).catch(loadError);
      });
    } catch (error) { loadError(error); }
  }
  $('#retry-load').addEventListener('click', async () => {
    showAccess('loading-state');
    if (!client) { await init(); return; }
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await handleSession(data.session);
    } catch (error) { loadError(error); }
  });
  init();
})();
