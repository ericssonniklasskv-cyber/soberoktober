(() => {
  const logic = window.SoberOctoberCompetition;
  let client, data = null, onChange = async () => {}, busy = false, boundaryTimer;
  const editors = new Map();
  const dateToday = window.SoberOctoberCalendar.stockholmDate;
  const node = (tag, value, className) => {
    const el = document.createElement(tag);
    el.textContent = value;
    if (className) el.className = className;
    return el;
  };
  function setMessage(container, message) {
    container.querySelector('.bingo-status').textContent = message;
  }
  function render(container, date) {
    const grid = container.querySelector('.bingo-grid');
    if (!data || !grid) return;
    const score = data.score || {};
    container.querySelector('.bingo-stats').textContent = `${Object.keys(data.completed_cells || {}).length}/25 rutor · ${score.total_points || 0} poäng · ${(score.rows || []).length + (score.columns || []).length}/10 rader`;
    grid.replaceChildren(...data.board.map((task, index) => {
      const done = data.completed_cells?.[index];
      const cell = node('button', '', `bingo-cell${done ? ' is-done' : ''}`);
      cell.type = 'button';
      cell.setAttribute('aria-pressed', String(Boolean(done)));
      cell.append(node('span', `${index + 1}${done ? ' ✓' : ''}`, 'bingo-cell-number'), node('span', task.description || task.label, 'bingo-cell-copy'));
      if (done) cell.append(node('small', `Klar ${Number(done.slice(-2))} okt`, 'bingo-cell-date'));
      cell.disabled = busy || !data.enabled || !logic.isBingoDate(date) || date > dateToday();
      cell.addEventListener('click', async () => {
        if (done && done !== date) {
          setMessage(container, `Rutan registrerades ${Number(done.slice(-2))} oktober. Öppna den dagen i Min oktober för att avmarkera. Du kan upprepa aktiviteten nedan utan extra poäng.`);
          return;
        }
        if (done && !window.confirm('Avmarkera rutan och räkna om dina bingopoäng?')) return;
        await mutate(container, date, index, done ? 'uncomplete' : 'complete');
      });
      return cell;
    }));
    const repeat = container.querySelector('.bingo-repeat');
    repeat.textContent = `Jag har upprepat en klar aktivitet den ${Number(date.slice(-2))} oktober`;
    repeat.hidden = !Object.keys(data.completed_cells || {}).length;
    repeat.disabled = busy || !data.enabled || !logic.isBingoDate(date) || date > dateToday();
  }
  async function mutate(container, date, cell, action) {
    if (busy) return;
    busy = true;
    editors.forEach((d, el) => render(el, d));
    setMessage(container, 'Sparar…');
    try {
      const response = await client.rpc('my_competition_bingo', { p_action: action, p_date: date, p_cell: cell });
      if (response.error) throw response.error;
      data = response.data;
      document.dispatchEvent(new Event('soberoktober:bingo-saved'));
      const restored = Boolean(response.data.restored);
      let refreshFailed = false;
      try { await onChange(); } catch (_) { refreshFailed = true; }
      setMessage(container, action === 'uncomplete' ? 'Avmarkerat. Poängen är omräknade.' : action === 'repeat' ? 'Dagens aktivitet registrerad, utan extra poäng.' : `Snyggt! Du har nu ${data.score.total_points} bingopoäng.${restored ? ' Du är tillbaka i tävlingen!' : ''}${refreshFailed ? ' Sparat, men sammanfattningen behöver laddas om.' : ''}`);
      if (action === 'complete') {
        container.classList.remove('bingo-celebrate');
        void container.offsetWidth;
        container.classList.add('bingo-celebrate');
      }
    } catch (error) {
      setMessage(container, error.message || 'Bingot kunde inte sparas. Försök igen.');
    } finally {
      busy = false;
      editors.forEach((d, el) => render(el, d));
    }
  }
  function mount(container, date) {
    editors.set(container, date);
    if (!container.dataset.bingoMounted) {
      container.dataset.bingoMounted = 'true';
      const scroll = node('div', '', 'bingo-board-scroll');
      const grid = node('div', '', 'bingo-grid');
      scroll.append(grid);
      const repeat = node('button', 'Jag har upprepat en klar aktivitet idag', 'bingo-repeat');
      repeat.type = 'button';
      repeat.addEventListener('click', () => {
        const index = Number(Object.keys(data?.completed_cells || {})[0]);
        const day = editors.get(container);
        if (window.confirm(`Registrera en upprepad aktivitet den ${Number(day.slice(-2))} oktober, utan extra poäng?`)) void mutate(container, day, index, 'repeat');
      });
      container.append(node('p', '', 'bingo-stats'), node('p', 'Tryck på en ruta när aktiviteten är klar. Svep i brickan på en liten skärm.', 'bingo-hint'), scroll, repeat, node('p', '', 'bingo-status'));
      container.querySelector('.bingo-status').setAttribute('role', 'status');
    }
    render(container, date);
  }
  function syncMain() {
    const main = document.querySelector('#competition-bingo');
    if (!main) return;
    const shown = logic.active(data?.enabled);
    main.hidden = !shown;
    document.querySelector('#dagens-pass').hidden = shown;
    const workoutNav = document.querySelector('.main-nav a[href="#dagens-pass"], .main-nav a[href="#competition-bingo"]');
    if (workoutNav) {
      workoutNav.href = shown ? '#competition-bingo' : '#dagens-pass';
      workoutNav.textContent = shown ? 'Dagens bingo' : 'Dagens pass';
    }
    if (shown) mount(main.querySelector('.bingo-editor'), dateToday());
  }
  function scheduleBoundary() {
    clearTimeout(boundaryTimer);
    // Short clock check plus an exact start/end wake-up; no animation loop or aggressive API polling.
    const now = Date.now();
    const upcoming = [logic.START_INSTANT, logic.END_INSTANT].filter(t => t > now);
    boundaryTimer = setTimeout(async () => {
      syncMain();
      if (!document.hidden && client) await onChange().catch(() => {});
      scheduleBoundary();
    }, Math.min(60000, upcoming.length ? Math.min(...upcoming) - now + 50 : 60000));
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && client) { syncMain(); void onChange().catch(() => {}); }
  });
  window.SoberOctoberBingo = Object.freeze({
    init(existingClient, changed) { client = existingClient; onChange = changed; scheduleBoundary(); },
    setState(next) { data = next; syncMain(); editors.forEach((date, el) => render(el, date)); },
    state: () => data,
    active: () => logic.active(data?.enabled),
    mount,
    reset() { data = null; editors.clear(); syncMain(); },
  });
})();
