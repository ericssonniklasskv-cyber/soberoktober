(() => {
  const list = document.querySelector('#bingo-people');
  const status = document.querySelector('#bingo-directory-status');
  const dialog = document.querySelector('#bingo-public-dialog');
  const node = (tag, text, cls) => { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; };
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  function openBoard(person, board) {
    document.querySelector('#bingo-public-name').textContent = person.display_name;
    document.querySelector('#bingo-public-stats').textContent = `${person.completed_cells.length}/25 rutor · ${person.score.total_points} poäng${person.is_eliminated ? ' · Utslagen' : ''}`;
    const done = new Set(person.completed_cells);
    document.querySelector('#bingo-public-grid').replaceChildren(...board.map((task, index) => {
      const cell = node('div', '', `bingo-cell${done.has(index) ? ' is-done' : ''}`);
      cell.append(node('span', `${index + 1}${done.has(index) ? ' ✓' : ''}`, 'bingo-cell-number'), node('span', task.description || task.label, 'bingo-cell-copy'));
      cell.setAttribute('aria-label', `${task.description || task.label}: ${done.has(index) ? 'klar' : 'inte klar'}`);
      return cell;
    }));
    dialog.showModal();
  }
  async function init() {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) throw Error('Konfigurationen kunde inte läsas.');
      const config = await response.json();
      const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      await client.auth.getSession();
      const { data, error } = await client.rpc('get_bingo_directory');
      if (error) throw error;
      status.textContent = data.enabled ? (data.participants.length ? '' : 'Ingen bricka ännu. Snart är vi igång!') : 'Tävlingsbingot är förberett och öppnar efter aktivering, den 5 oktober kl. 00.01. Testbrickor räknas inte här.';
      list.replaceChildren(...data.participants.map(person => {
        const button = node('button', '', `bingo-person${person.is_current_user ? ' is-me' : ''}`);
        button.type = 'button';
        button.append(node('strong', `${person.display_name}${person.is_current_user ? ' · Du' : ''}`), node('span', `${person.completed_cells.length}/25 rutor · ${person.score.total_points} poäng${person.is_eliminated ? ' · Utslagen' : ''}`));
        button.addEventListener('click', () => openBoard(person, data.board));
        return button;
      }));
    } catch (error) {
      status.textContent = 'Brickorna kunde inte laddas. Försök igen om en stund.';
      console.error('BingoBingo kunde inte laddas', error);
    }
  }
  void init();
})();
