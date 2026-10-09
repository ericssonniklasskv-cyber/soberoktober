(() => {
  function create({ getClient, getPublicClient, isEntryVisible }) {
    const ui = {
      leaderboardList: document.querySelector('#leaderboard-list'),
      leaderboardSelf: document.querySelector('#leaderboard-self'),
      leaderboardStatus: document.querySelector('#leaderboard-status'),
      registeredLists: [...document.querySelectorAll('[data-registered-list]')],
      registeredCounts: [...document.querySelectorAll('[data-registered-count]')],
      registeredStatuses: [...document.querySelectorAll('[data-registered-status]')],
      leaderboardPreviewLists: [...document.querySelectorAll('[data-leaderboard-preview-list]')],
      leaderboardPreviewSelf: [...document.querySelectorAll('[data-leaderboard-preview-self]')],
      leaderboardPreviewStatuses: [...document.querySelectorAll('[data-leaderboard-preview-status]')],
      leaderboardPreviewLinks: [...document.querySelectorAll('[data-leaderboard-preview-link]')],
    };
    let latestLeaderboardRows = [];
    const pointsFormatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
    function renderRegistered(rows) {
      const participants = rows
        .map((row) => ({
          displayName: typeof row.display_name === 'string' ? row.display_name.trim() : '',
          eliminated: row.is_eliminated === true,
        }))
        .filter((row) => row.displayName);

      ui.registeredCounts.forEach((count) => { count.textContent = String(participants.length); });
      ui.registeredStatuses.forEach((status) => { status.textContent = ''; });
      ui.registeredLists.forEach((list) => {
        list.replaceChildren();
        if (!participants.length) {
          const empty = document.createElement('li');
          empty.className = 'registered-empty';
          empty.textContent = 'Inga anmälda ännu.';
          list.appendChild(empty);
          return;
        }

        participants.forEach(({ displayName, eliminated }) => {
          const item = document.createElement('li');
          item.className = 'registered-name';
          const name = document.createElement('span');
          name.textContent = displayName;
          item.appendChild(name);
          if (eliminated) {
            const badge = document.createElement('span');
            badge.className = 'registered-eliminated';
            badge.textContent = 'Utslagen';
            item.appendChild(badge);
          }
          list.appendChild(item);
        });
      });
    }

    async function loadRegistered() {
      const { data, error } = await getPublicClient().rpc('get_registered_participants');
      if (error) {
        console.error('Kunde inte läsa anmälda', error);
        ui.registeredStatuses.forEach((status) => {
          status.textContent = 'Listan kunde inte laddas just nu.';
        });
        return;
      }
      renderRegistered(data || []);
    }

    function createLeaderboardPreviewRow(entry) {
      const rank = Number(entry.rank_position);
      const days = Number(entry.completed_days);
      const row = document.createElement('li');
      row.className = `leaderboard-preview-row${rank <= 3 ? ` top-${rank}` : ''}${entry.is_current_user ? ' is-current' : ''}${entry.is_eliminated ? ' is-eliminated' : ''}`;

      const rankBadge = document.createElement('span');
      rankBadge.className = 'leaderboard-preview-rank';
      rankBadge.textContent = String(rank);

      const info = document.createElement('span');
      info.className = 'leaderboard-preview-info';
      const name = document.createElement('span');
      name.className = 'leaderboard-preview-name';

      if (rank === 1) {
        const crown = document.createElement('span');
        crown.className = 'leaderboard-preview-crown';
        crown.setAttribute('aria-hidden', 'true');
        crown.textContent = '♛';
        name.appendChild(crown);
      }

      const nameText = document.createElement('span');
      nameText.className = 'leaderboard-preview-name-text';
      nameText.textContent = entry.display_name;
      name.appendChild(nameText);

      if (entry.is_current_user) {
        const you = document.createElement('span');
        you.className = 'leaderboard-you';
        you.textContent = 'Du';
        name.appendChild(you);
      }

      const meta = document.createElement('span');
      meta.className = 'leaderboard-preview-meta';
      meta.textContent = `${pointsFormatter.format(Number(entry.total_points))} p · ${days} ${days === 1 ? 'dag' : 'dagar'}`;
      info.append(name, meta);
      if (entry.is_eliminated) {
        const eliminated = document.createElement('span');
        eliminated.className = 'leaderboard-eliminated';
        eliminated.textContent = 'UTSLAGEN';
        info.appendChild(eliminated);
      }
      row.append(rankBadge, info);
      return row;
    }

    function fillLeaderboardPreviewList(list, rows) {
      list.replaceChildren();
      if (!rows.length) {
        const empty = document.createElement('li');
        empty.className = 'leaderboard-preview-empty';
        empty.textContent = 'Topplistan vaknar när det första passet är sparat.';
        list.appendChild(empty);
        return;
      }
      rows.forEach((entry) => list.appendChild(createLeaderboardPreviewRow(entry)));
    }

    function renderLeaderboardPreviews(rows) {
      latestLeaderboardRows = rows;
      const topFive = rows.slice(0, 5);
      const current = rows.find((entry) => entry.is_current_user);
      const showOwnPlacement = current && Number(current.rank_position) > 5;

      ui.leaderboardPreviewStatuses.forEach((status) => { status.textContent = ''; });
      ui.leaderboardPreviewSelf.forEach((self) => {
        self.hidden = !showOwnPlacement;
        self.textContent = showOwnPlacement ? `Din placering: ${Number(current.rank_position)}` : '';
      });
      ui.leaderboardPreviewLists.forEach((list) => fillLeaderboardPreviewList(list, topFive));
      ui.leaderboardPreviewLinks.forEach((link) => {
        link.dataset.expanded = 'false';
        link.textContent = 'Se hela topplistan';
      });
    }

    function showLeaderboardPreviewError() {
      latestLeaderboardRows = [];
      ui.leaderboardPreviewSelf.forEach((self) => {
        self.hidden = true;
        self.textContent = '';
      });
      ui.leaderboardPreviewLinks.forEach((link) => {
        link.dataset.expanded = 'false';
        link.textContent = 'Se hela topplistan';
      });
      ui.leaderboardPreviewLists.forEach((list) => {
        const empty = document.createElement('li');
        empty.className = 'leaderboard-preview-empty';
        empty.textContent = 'Topplistan kunde inte laddas.';
        list.replaceChildren(empty);
      });
      ui.leaderboardPreviewStatuses.forEach((status) => {
        status.textContent = 'Försök igen om en stund.';
      });
    }

    function renderLeaderboard(rows) {
      renderLeaderboardPreviews(rows);
      ui.leaderboardList.replaceChildren();
      ui.leaderboardStatus.textContent = '';
      ui.leaderboardSelf.hidden = true;

      if (!rows.length) {
        const empty = document.createElement('li');
        empty.className = 'leaderboard-empty';
        empty.textContent = 'Topplistan vaknar när det första passet är sparat.';
        ui.leaderboardList.appendChild(empty);
        return;
      }

      rows.forEach((entry) => {
        const rank = Number(entry.rank_position);
        const days = Number(entry.completed_days);
        const row = document.createElement('li');
        row.className = `leaderboard-row${rank <= 3 ? ` top-${rank}` : ''}${entry.is_current_user ? ' is-current' : ''}${entry.is_eliminated ? ' is-eliminated' : ''}`;

        const rankBadge = document.createElement('span');
        rankBadge.className = 'leaderboard-rank';
        rankBadge.textContent = rank === 1 ? `♛ ${rank}` : String(rank);

        const name = document.createElement('span');
        name.className = 'leaderboard-name';
        const nameText = document.createElement('span');
        nameText.textContent = entry.display_name;
        name.appendChild(nameText);

        if (entry.is_current_user) {
          const you = document.createElement('span');
          you.className = 'leaderboard-you';
          you.textContent = 'Du';
          name.appendChild(you);
          ui.leaderboardSelf.textContent = `Din placering: ${rank}`;
          ui.leaderboardSelf.hidden = false;
        }

        if (entry.is_eliminated) {
          const eliminated = document.createElement('span');
          eliminated.className = 'leaderboard-eliminated';
          eliminated.textContent = 'UTSLAGEN';
          name.appendChild(eliminated);
        }

        const points = document.createElement('span');
        points.className = 'leaderboard-points';
        points.textContent = `${pointsFormatter.format(Number(entry.total_points))} p`;

        const completed = document.createElement('span');
        completed.className = 'leaderboard-days';
        completed.textContent = `${days} ${days === 1 ? 'dag' : 'dagar'}`;

        row.append(rankBadge, name, points, completed);
        ui.leaderboardList.appendChild(row);
      });
    }

    async function refreshLeaderboard() {
      const { data, error } = await getClient().rpc('get_leaderboard');

      if (error) {
        console.error('Kunde inte läsa topplistan', error);
        ui.leaderboardStatus.textContent = 'Topplistan kunde inte laddas just nu.';
        showLeaderboardPreviewError();
        return;
      }

      renderLeaderboard(data || []);
    }

    ui.leaderboardPreviewLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const panel = link.closest('.entry-leaderboard-preview');
        if (!panel || !isEntryVisible()) return;

        event.preventDefault();
        const expanded = link.dataset.expanded !== 'true';
        const list = panel.querySelector('[data-leaderboard-preview-list]');
        fillLeaderboardPreviewList(list, expanded ? latestLeaderboardRows : latestLeaderboardRows.slice(0, 5));
        link.dataset.expanded = String(expanded);
        link.textContent = expanded ? 'Visa topp 5' : 'Se hela topplistan';
      });
    });

    return Object.freeze({ loadRegistered, refreshLeaderboard });
  }
  window.SoberOctoberParticipants = Object.freeze({ create });
})();
