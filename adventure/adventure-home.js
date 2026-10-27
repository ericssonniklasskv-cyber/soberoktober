(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'soberoktober:adventure-home-preview:v1';
  const G = window.SoberAdventure;
  const basePoints = { guest: 138, mikeb: 157, jerka: 153, zellmani: 150, 'elliott-da-bomb': 146, nillebae: 144 };
  const baseDays = { guest: 21, mikeb: 24, jerka: 23, zellmani: 24, 'elliott-da-bomb': 22, nillebae: 23 };
  const defaultBonus = 'Ge en annan soktoberian en peppande hälsning i gruppen.';
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  let prefs = { role: 'participant', scope: 'month', bonuses: {}, completed: {}, times: {}, clock: 0 }, api, snapshot, expanded = false, knownIds = null;
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (object(value)) {
      prefs.role = value.role === 'admin' ? 'admin' : 'participant';
      prefs.scope = value.scope === 'week' ? 'week' : 'month';
      if (object(value.bonuses)) prefs.bonuses = value.bonuses;
      if (object(value.completed)) prefs.completed = value.completed;
      if (object(value.times)) prefs.times = value.times;
      if (Number.isSafeInteger(value.clock)) prefs.clock = value.clock;
    }
  } catch { /* The game and preview remain usable. */ }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stamp = () => (prefs.clock = Math.max(Date.now(), prefs.clock + 1));
  const bonusText = date => typeof prefs.bonuses[date] === 'string' && prefs.bonuses[date].trim() ? prefs.bonuses[date] : defaultBonus;
  const bonuses = id => object(prefs.completed[id]) ? prefs.completed[id] : {};
  const number = value => value.toLocaleString('sv-SE');
  const ownName = () => snapshot.participantId === 'guest' ? 'Testdeltagare' : snapshot.players.find(player => player.own).name.replace(/^Du \(|\)$/g, '');
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { $('home-status').textContent = 'Förhandsvisningen kunde inte sparas i webbläsaren.'; } }
  function openTools() { document.querySelector('.test-tools').open = true; $('test-participant').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('test-participant').focus({ preventScroll: true }); }
  function renderRanking() {
    const ownScores = G.scoreTotals(snapshot.state).points;
    const ownBonus = Object.keys(bonuses(snapshot.participantId)).filter(date => date >= G.START_DATE && date <= G.END_DATE).length;
    const rows = snapshot.players.map(player => {
      const id = player.own ? snapshot.participantId : player.id;
      const finalPoints = player.own ? ownScores + ownBonus : Object.keys(bonuses(id)).filter(date => date >= G.START_DATE && date <= G.END_DATE).length;
      return { ...player, id, displayName: player.own ? ownName() : player.name, points: (prefs.scope === 'month' ? basePoints[id] || 0 : 0) + finalPoints, finalPoints, days: prefs.scope === 'month' ? baseDays[id] || 0 : 0 };
    }).sort((a,b) => b.points - a.points || b.days - a.days || a.displayName.localeCompare(b.displayName, 'sv'));
    let rank = 0, previous = null;
    $('home-leaderboard-list').innerHTML = rows.map((row, index) => {
      if (!previous || previous.points !== row.points || previous.days !== row.days) rank = index + 1;
      previous = row;
      return `<li class="home-rank-row" data-own="${row.own}" data-participant="${row.id}" data-points="${row.points}"><span class="home-rank-number">${rank === 1 && row.points > 0 ? '<span aria-hidden="true">♛</span>' : rank}<span class="visually-hidden">Plats ${rank}</span></span>${api.pawnMarkup(row.mount, '', 60)}<div class="home-rank-person"><strong>${esc(row.displayName)}${row.own ? '<span class="home-you">DU</span>' : ''}</strong><small>${row.finalPoints} poäng under finalveckan</small></div><strong class="home-rank-points">${number(row.points)}<small>poäng</small></strong></li>`;
    }).join('');
    $('home-ranking-note').textContent = prefs.scope === 'month' ? 'Exempelpoäng för hela oktober. Dina lokala finalpoäng och bonusar läggs till direkt.' : 'Finalveckans testpoäng. Förflyttningar och bossuppdrag ger inga poäng.';
    document.querySelectorAll('[data-home-scope]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.homeScope === prefs.scope)));
  }
  function activityRows() {
    const own = snapshot.players.find(player => player.own);
    let position = 0;
    const entries = snapshot.state.events.map((event, index) => {
      let title, detail, icon;
      if (event.type === 'exercise') {
        position += 1 + (snapshot.state.stepCredits[event.id] || 0); const exercise = G.EXERCISES.find(item => item.id === event.exerciseId);
        const amount = exercise.reps ? exercise.reps + ' ' + exercise.label.toLowerCase() : event.distanceKm + ' km löpning';
        const setback = snapshot.state.stepCredits[event.id] === -1;
        title = ownName() + (setback ? ' upptäckte en glassfälla' : ' tränade sig framåt'); detail = amount + ' · Ruta ' + position + (setback ? ' · glassfälla −1 ruta' : '') + ' · 0 poäng'; icon = setback ? '↶' : '↗';
      } else if (event.type === 'boss') {
        const boss = G.BOSSES.find(item => item.id === event.bossId);
        title = ownName() + ' besegrade ' + boss.name; detail = 'Stod emot frestelsen · 0 poäng'; icon = '✦';
      } else {
        const exercise = G.SCORING_EXERCISES.find(item => item.id === event.exerciseId);
        title = ownName() + ' samlade 1 poäng'; detail = (exercise.reps ? exercise.reps + ' ' + exercise.label.toLowerCase() : exercise.distanceKm + ' km löpning') + ' · Poängjakten'; icon = '+';
      }
      return { id: event.id, date: event.date, order: Number.isFinite(prefs.times[event.id]) ? prefs.times[event.id] : 1000 + index, title, detail, icon, mount: own.mount, own: true };
    });
    Object.entries(bonuses(snapshot.participantId)).forEach(([date, value]) => entries.push({ id: 'bonus-' + date, date, order: object(value) && Number.isFinite(value.at) ? value.at : 20000, title: ownName() + ' klarade dagens bonus', detail: (typeof value === 'string' ? value : typeof value?.text === 'string' ? value.text : defaultBonus) + ' · +1 poäng', icon: '★', mount: own.mount, own: true }));
    snapshot.players.filter(player => !player.own).forEach((player,index) => entries.push({ id: 'example-' + player.id, date: snapshot.date, order: -index, title: player.name + (player.position ? ' tog sig till ruta ' + player.position : ' är redo på startlinjen'), detail: 'Exempelaktivitet · Frestelsernas rike', icon: '↗', mount: player.mount, own: false }));
    return entries.sort((a,b) => b.date.localeCompare(a.date) || b.order - a.order);
  }
  function renderActivity() {
    const entries = activityRows();
    $('home-activity-list').innerHTML = entries.slice(0, expanded ? 20 : 6).map(entry => `<li class="home-activity-row" data-type="${entry.id.startsWith('bonus-') ? 'bonus' : 'game'}" data-own="${entry.own}"><div class="home-activity-avatar">${api.pawnMarkup(entry.mount, '', 52)}<span aria-hidden="true">${entry.icon}</span></div><div><strong>${esc(entry.title)}</strong><p>${esc(entry.detail)}</p><small>${entry.date === snapshot.date ? 'I dag' : esc(entry.date)}${entry.own ? ' · Din testresa' : ''}</small></div></li>`).join('');
    $('home-more-activity').hidden = entries.length <= 6;
    $('home-more-activity').textContent = expanded ? 'Visa färre händelser ↑' : 'Visa fler händelser ↓';
  }
  function render(next) {
    let changed = false;
    if (knownIds) next.state.events.forEach((event, index) => {
      if (!knownIds.has(event.id) && !Number.isFinite(prefs.times[event.id])) { prefs.times[event.id] = stamp(); changed = true; }
    });
    knownIds = new Set(next.state.events.map(event => event.id));
    if (changed) persist();
    snapshot = next;
    const admin = prefs.role === 'admin';
    $('home-admin').hidden = !admin; $('home-admin').disabled = !admin;
    if (!admin && $('home-bonus-form') && $('detail-dialog').open) api.closeDialog('detail-dialog');
    $('test-role').value = prefs.role;
    $('home-username').textContent = ownName();
    const done = !!bonuses(snapshot.participantId)[snapshot.date];
    $('home-bonus-description').textContent = bonusText(snapshot.date);
    $('home-bonus-toggle').textContent = done ? '✓ Bonusen är klar · ångra' : 'Jag har klarat bonusen · +1 poäng';
    $('home-bonus-toggle').setAttribute('aria-pressed', String(done));
    $('home-bonus-label').textContent = done ? 'Dagens bonus är klar' : 'Dagens bonus';
    renderRanking(); renderActivity();
  }
  function showRules() {
    const content = api.detail('Så tar du dig genom riket.', 'REGLER OCH POÄNG · FINALVECKAN');
    content.innerHTML += `<ol class="home-rules"><li><strong>Träna dig fram till slottet.</strong>15 squats, 10 armhävningar, 5 pull-ups eller 1 km löpning flyttar dig en ruta. Resan och bossarna ger inga poäng.</li><li><strong>Stå emot frestelserna.</strong>Gör bossens uppdrag, dela i gruppen och klarmarkera för att fortsätta.</li><li><strong>Nå ruta 60. Lås upp poängjakten.</strong>Därefter ger nya 15 squats, 10 armhävningar, 5 pull-ups eller 1 km löpning 1 poäng per registrering.</li><li><strong>Final den 31 oktober.</strong>Bakrusbaronen öppnar först då. Samla poäng medan du väntar – och även efter segern, fram till kl. 23.59.59 svensk tid.</li></ol><p>Dagens bonus finns i spelpanelen. Topplistan visar hela oktober eller bara finalveckan.</p>`;
  }
  function showAccount() {
    const content = api.detail(ownName(), 'DITT KONTO · LOKAL FÖRHANDSVISNING');
    const own = snapshot.players.find(player => player.own);
    content.innerHTML += `<div class="home-account-pawn">${api.pawnMarkup(own.mount, '', 160)}</div><p>${snapshot.participantId === 'guest' ? 'Du kan välja bland de vanliga spelpjäserna.' : 'Din personliga pjäs är tilldelad för hela finalveckan.'}</p><div class="home-dialog-actions"><button type="button" id="home-account-pawn" class="primary-button">${snapshot.participantId === 'guest' ? 'Byt min pjäs' : 'Visa min pjäs igen ✦'}</button><button type="button" id="home-account-journey" class="text-button">Visa min resedagbok ↗</button><button type="button" id="home-account-switch" class="text-button">Byt testdeltagare ↗</button></div><p class="home-preview-note">Det här är ett lokalt kontoprov. Riktig inloggning och utloggning kopplas in inför en eventuell publicering.</p>`;
    $('home-account-pawn').addEventListener('click', () => { api.closeDialog('detail-dialog'); api.showOwnPawn(); });
    $('home-account-journey').addEventListener('click', () => { api.closeDialog('detail-dialog'); api.showJournal(); });
    $('home-account-switch').addEventListener('click', () => { api.closeDialog('detail-dialog'); openTools(); });
  }
  function showAdmin() {
    if (prefs.role !== 'admin') return;
    const content = api.detail('Admin · dagens bonus', 'ADMINFÖRHANDSVISNING · LOKALT');
    content.innerHTML += `<p>Prova hur bonusen visas inne i riket. Detta sparas bara i förhandsvisningen på 3002.</p><form id="home-bonus-form"><label for="home-admin-bonus">Bonus för ${esc(snapshot.date)}</label><textarea id="home-admin-bonus" rows="3" maxlength="240" required>${esc(bonusText(snapshot.date))}</textarea><button type="submit" class="primary-button">Spara dagens testbonus</button><p id="home-admin-status" role="status"></p></form>`;
    $('home-bonus-form').addEventListener('submit', event => {
      event.preventDefault(); if (prefs.role !== 'admin') return;
      const value = $('home-admin-bonus').value.trim(); if (!value) return;
      prefs.bonuses[snapshot.date] = value; persist(); render(api.snapshot());
      $('home-admin-status').textContent = 'Sparat i den lokala förhandsvisningen. Bonusen syns i riket.';
    });
  }
  function init(options) {
    api = options;
    $('home-account').addEventListener('click', showAccount);
    $('home-rules').addEventListener('click', showRules);
    $('home-admin').addEventListener('click', showAdmin);
    $('test-role').addEventListener('change', event => {
      prefs.role = event.target.value === 'admin' ? 'admin' : 'participant'; persist();
      if ($('detail-dialog').open) api.closeDialog('detail-dialog');
      render(api.snapshot());
    });
    document.querySelectorAll('[data-home-scope]').forEach(button => button.addEventListener('click', () => { prefs.scope = button.dataset.homeScope === 'week' ? 'week' : 'month'; persist(); render(api.snapshot()); }));
    $('home-more-activity').addEventListener('click', () => { expanded = !expanded; renderActivity(); });
    $('home-bonus-toggle').addEventListener('click', () => {
      const id = snapshot.participantId, date = snapshot.date;
      if (!object(prefs.completed[id])) prefs.completed[id] = {};
      if (prefs.completed[id][date]) delete prefs.completed[id][date]; else prefs.completed[id][date] = { text: bonusText(date), at: stamp() };
      persist(); render(api.snapshot());
      $('home-status').textContent = prefs.completed[id][date] ? 'Dagens testbonus är registrerad: +1 poäng.' : 'Bonusmarkeringen är ångrad.';
    });
    window.addEventListener('storage', event => {
      if (event.key !== KEY) return;
      try {
        const value = JSON.parse(event.newValue);
        if (object(value)) { prefs.role = value.role === 'admin' ? 'admin' : 'participant'; prefs.scope = value.scope === 'week' ? 'week' : 'month'; prefs.bonuses = object(value.bonuses) ? value.bonuses : {}; prefs.completed = object(value.completed) ? value.completed : {}; prefs.times = object(value.times) ? value.times : {}; prefs.clock = Number.isSafeInteger(value.clock) ? value.clock : 0; render(api.snapshot()); }
      } catch { /* Keep the current preview on a malformed cross-tab update. */ }
    });
  }
  function resetParticipant() { delete prefs.completed[api.snapshot().participantId]; persist(); }
  window.AdventureHome = Object.freeze({ init, render, resetParticipant });
})();
