(async () => {
  'use strict';
  const G = window.SoberAdventure;
  const S = window.AdventureSprites;
  const B = window.AdventureBosses;
  const F = window.AdventureFinale;
  const A = window.AdventurePersonalPawns;
  const R = window.AdventureConnection ? await window.AdventureConnection : null;
  const H = R?.home || window.AdventureHome;
  const W = window.AdventureWelcome;
  const $ = id => document.getElementById(id);
  const KEY = 'soberoktober:final-adventure:v1';
  const PREFS = 'soberoktober:final-adventure-prefs:v1';
  const MOUNTS = [
    { id: 'fox', name: 'Kopparräven', color: '#db783b' },
    { id: 'bear', name: 'Honungsbjörnen', color: '#68826b' },
    { id: 'boar', name: 'Skogsvildsvinet', color: '#a27755' },
    { id: 'wolf', name: 'Månvargen', color: '#7b8696' },
    { id: 'deer', name: 'Guldhjorten', color: '#bc954e' },
    { id: 'rabbit', name: 'Vindharen', color: '#9b768a' },
  ];
  const ROSTER = [
    { id: 'guest', name: 'Testdeltagare', position: 0 },
    ...A.PROFILES.map((profile, index) => ({ id: profile.id, name: profile.username, position: [0, 0, 5, 12, 17][index] })),
  ];
  const CHAPTERS = ["Beer o' forest", 'Boulevard of wine', 'Ravine of shots', 'The prosecco mountains', 'The last dance', 'Hangover castle'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const BOSS_AUDIO = Object.freeze({
    troll: 'beer-orc', witch: 'wine-gnome', dragon: 'shots-dragon',
    sphinx: 'prosecco-witch', kraken: 'nightclub-gollum', final: 'hangover-baron',
  });
  const bossAudio = $('boss-audio');
  let audioGeneration = 0;
  let state = G.createState(), mountIndex = 0, participantId = 'guest', testDay = G.START_DATE, crowd = false;
  let geometry = null, selectedChoice = null, currentBoss = null;
  let bossPopupTimeout = 0, animationFrame = 0, treatCheckTimer = 0, shortcutCheckTimer = 0, rideCheckTimer = 0;
  const treatsShownThisVisit = new Set();
  const shortcutsShownThisVisit = new Set(), ridesShownThisVisit = new Set();
  const awaitingShortcut = () => G.progress(state).position === 21 && !state.shortcutChoice;
  const awaitingRide = () => G.progress(state).position === 28 && !state.rideChoice;
  const awaitingEncounter = () => awaitingShortcut() || awaitingRide();
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const formatAmount = (exercise, amount = 1) => exercise.distanceKm
    ? (exercise.distanceKm * amount).toLocaleString('sv-SE') + ' km löpning'
    : (exercise.reps * amount) + ' ' + exercise.label.toLowerCase();
  const exerciseLabel = (exercise, compact = false) => exercise.distanceKm
    ? (compact ? '' : 'Löpning ') + exercise.distanceKm.toLocaleString('sv-SE') + ' km'
    : compact && exercise.id === 'pushups' ? exercise.reps + ' armh.' : formatAmount(exercise);

  try {
    const raw = R ? null : localStorage.getItem(KEY);
    if (raw) {
      const restored = G.restore(raw);
      if (restored) state = restored;
      else $('storage-status').textContent = 'Den sparade testresan var skadad. Du börjar med en ny resa.';
    }
    const prefs = R ? {} : JSON.parse(localStorage.getItem(PREFS) || '{}');
    if (A.forId(prefs.participantId)) participantId = prefs.participantId;
    if (Number.isInteger(prefs.mountIndex) && prefs.mountIndex >= 0 && prefs.mountIndex < MOUNTS.length) mountIndex = prefs.mountIndex;
    if (/^2026-10-(26|27|28|29|30|31)$/.test(prefs.testDay || '')) testDay = prefs.testDay;
  } catch {
    $('storage-status').textContent = 'Sparning är inte tillgänglig. Resan finns kvar så länge sidan är öppen.';
  }
  function savePrefs() {
    if (R) return;
    try { localStorage.setItem(PREFS, JSON.stringify({ mountIndex, participantId, testDay })); } catch { /* Gameplay remains usable. */ }
  }
  function save(next, message = '') {
    if (R) throw new Error('Use the authenticated command to save.');
    state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      $('storage-status').textContent = 'Din resa sparas automatiskt i den här webbläsaren.';
    } catch {
      $('storage-status').textContent = 'Kunde inte spara. Dina steg finns kvar tills sidan stängs.';
    }
    render();
    if (message) $('feedback').textContent = message;
  }
  const ownProfile = () => A.forId(participantId);
  const ownMount = () => ownProfile()?.mount || MOUNTS[mountIndex];
  function pawnMarkup(mount, label = '', size = 128) {
    if (!mount.image) return S.riderSVG(mount.id, mount.color, label, size);
    return `<img class="personal-pawn" data-personal-pawn="${mount.id}" src="${mount.image}" alt="${esc(label || mount.name)}" width="${size}" height="${Math.round(size * .75)}" decoding="async">`;
  }
  function setPawn(node, mount, label, size) {
    const key = mount.id + '|' + label + '|' + size;
    if (node.dataset.pawnKey === key) return;
    node.innerHTML = pawnMarkup(mount, label, size); node.dataset.pawnKey = key;
  }
  function players() {
    if (R) return R.data.players.map(player => ({ id: player.id === R.data.profile.id ? 'you' : player.id, name: player.id === R.data.profile.id ? 'Du (' + player.name + ')' : player.name, position: player.position, own: player.id === R.data.profile.id, mount: A.forId(player.pawn_id)?.mount || {...MOUNTS[player.mount_index], color: '#' + (G.stableHash(player.id) % 0x999999 + 0x333333).toString(16).padStart(6,'0')} }));
    const profile = ownProfile();
    const own = { id: 'you', name: profile ? 'Du (' + profile.username + ')' : 'Du', position: G.progress(state).position, own: true, mount: ownMount() };
    return [own, ...ROSTER.filter(player => player.id !== participantId).map(player => ({
      ...player, position: crowd ? own.position : player.position, own: false,
      mount: A.forId(player.id)?.mount || MOUNTS[mountIndex],
    }))];
  }
  function feedback(message) { $('feedback').textContent = message; }

  function makeGeometry() {
    const mobile = matchMedia('(max-width:700px)').matches;
    const cols = mobile ? 3 : 6, width = mobile ? 440 : 1000;
    const rowStep = mobile ? 145 : 150;
    const x0 = mobile ? 80 : 90, xStep = mobile ? 140 : 164;
    const coords = [{ x: x0, y: 65 }];
    for (let position = 1; position <= G.BOARD_SIZE; position++) {
      const row = Math.floor((position - 1) / cols), col = (position - 1) % cols;
      coords.push({ x: x0 + ((row % 2) ? cols - 1 - col : col) * xStep, y: 190 + row * rowStep });
    }
    return { mobile, cols, width, height: coords.at(-1).y + 150, rowStep, coords };
  }
  function pathFor(coords) {
    return coords.map((point, index) => {
      if (!index) return `M${point.x},${point.y}`;
      const previous = coords[index - 1];
      if (point.x === previous.x && index > 1) {
        const bend = (point.x > geometry.width / 2 ? 1 : -1) * (geometry.mobile ? 64 : 80);
        return `C${point.x + bend},${previous.y + 25} ${point.x + bend},${point.y - 25} ${point.x},${point.y}`;
      }
      return `Q${(previous.x + point.x) / 2},${(previous.y + point.y) / 2 + (index > 1 ? 7 : 0)} ${point.x},${point.y}`;
    }).join(' ');
  }
  function scenery() {
    const { width, mobile, rowStep } = geometry;
    const rowsPerTile = rowStep / geometry.cols;
    let scenerySVG = '';
    for (let chapter = 0; chapter < 6; chapter++) {
      const chapterStart = chapter ? G.BOSSES[chapter - 1].position : 0;
      const chapterStep = (G.BOSSES[chapter].position - chapterStart) * rowsPerTile;
      const top = 107 + chapterStart * rowsPerTile;
      const shade = ['#a7b58b', '#b6a082', '#c69a74', '#c9bc87', '#a49baf', '#bb9d72'][chapter];
      scenerySVG += `<path d="M0 ${top - 20} Q${width / 3} ${top - 45} ${width} ${top - 15} V${top + chapterStep - 20} Q${width / 2} ${top + chapterStep + 10} 0 ${top + chapterStep - 12}Z" fill="${shade}" opacity=".14"/>`;
      scenerySVG += `<text x="${mobile ? 125 : 155}" y="${top + 9}" class="map-zone-kicker">KAPITEL ${ROMAN[chapter]}</text><text x="${mobile ? 125 : 155}" y="${top + 32}" class="map-zone-text">${CHAPTERS[chapter]}</text>`;
      const decorY = top + (mobile ? 150 : 70);
      if (chapter % 3 === 0) {
        for (let n = 0; n < (mobile ? 5 : 9); n++) {
          const x = mobile ? 12 + n * 95 : 25 + n * 114;
          scenerySVG += `<use href="#adv-tree" x="${x}" y="${decorY + ((n * 17) % 30)}" width="${mobile ? 40 : 53}" height="67" opacity=".55"/>`;
        }
      } else if (chapter % 3 === 1) {
        scenerySVG += `<ellipse cx="${width * .62}" cy="${decorY + 45}" rx="${mobile ? 65 : 115}" ry="27" fill="#a9bfb3" opacity=".55"/><path d="M${width * .62 - 40},${decorY + 43}q30-9 65 0m-45 12q25-5 45 0" fill="none" stroke="#d7dfc4" stroke-width="3"/>`;
        scenerySVG += `<use href="#adv-ruin" x="${width - (mobile ? 95 : 150)}" y="${decorY - 65}" width="75" height="75" opacity=".55"/>`;
      } else {
        scenerySVG += `<use href="#adv-mountain" x="${width - (mobile ? 150 : 260)}" y="${top - 13}" width="${mobile ? 125 : 210}" height="87" opacity=".5"/>`;
        if (chapter === 5) scenerySVG += `<use href="#adv-castle" x="${width / 2 - 55}" y="${decorY + 15}" width="110" height="105"/>`;
      }
      for (let n = 0; n < 5; n++) {
        const x = 35 + ((chapter * 167 + n * 113) % (width - 60));
        scenerySVG += `<path d="M${x} ${decorY - 30 + (n % 2) * 25}v8m-4-4h8" stroke="#a49f6f" stroke-width="1.5" opacity=".5"/>`;
      }
    }
    return scenerySVG;
  }
  function buildMap() {
    geometry = makeGeometry();
    const { width, height, coords } = geometry;
    const art = $('map-art');
    art.setAttribute('viewBox', `0 0 ${width} ${height}`);
    art.innerHTML = `<defs>
      <pattern id="adv-grain" width="23" height="29" patternUnits="userSpaceOnUse"><circle cx="3" cy="5" r=".6" fill="#73805b" opacity=".12"/><circle cx="17" cy="21" r=".6" fill="#fffaf0" opacity=".55"/></pattern>
      <symbol id="adv-tree" viewBox="0 0 50 75"><path d="M25 45v26" stroke="#83765c" stroke-width="4"/><path d="M25 2 7 32h10L2 51h46L34 32h9Z" fill="#829b72"/><path d="M25 5v45H6l14-21h-9Z" fill="#6d8a64"/></symbol>
      <symbol id="adv-mountain" viewBox="0 0 210 90"><path d="M3 87 64 4l36 43 26-32 80 72Z" fill="#9da68b"/><path d="m64 4-19 26 19-7 10 10 8-8 18 22Z" fill="#e8e6d0"/><path d="m126 15-13 16 15-4 15 7Z" fill="#efebd4"/></symbol>
      <symbol id="adv-ruin" viewBox="0 0 80 80"><path d="M10 73V16h15v11h14V8h21v22h10v43Z" fill="#a4a58c"/><path d="M29 73V49q11-15 22 0v24" fill="#d6d7bc"/><path d="M6 73h70M11 43h17m29-8h13M40 17h18" fill="none" stroke="#8f967c" stroke-width="3"/></symbol>
      <symbol id="adv-castle" viewBox="0 0 110 110"><path d="M9 99V39h20v12h10V24h31v27h12V39h20v60Z" fill="#9b9475" stroke="#7c7a5e" stroke-width="2"/><path d="m3 39 15-24 17 24M34 24 54 1l23 23m0 15 15-24 17 24" fill="#617854"/><path d="M42 99V79q13-17 26 0v20" fill="#5b684c"/><path d="M19 15V2l20 5-20 6" fill="#d4914f"/><path d="M8 100h94" stroke="#b8aa7b" stroke-width="7"/></symbol>
      </defs><rect width="100%" height="100%" fill="#eae7d0"/><rect width="100%" height="100%" fill="url(#adv-grain)"/>${scenery()}
      <path d="${pathFor(coords)}" fill="none" stroke="#c4bb92" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${pathFor(coords)}" fill="none" stroke="#f8efd1" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${pathFor(coords)}" fill="none" stroke="#d9caa0" stroke-width="2" stroke-dasharray="2 10"/>
      <path id="map-travelled" fill="none" stroke="#c48b4e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
      <text x="${coords[0].x + 80}" y="67" class="map-start-label">ÄVENTYRET BÖRJAR HÄR</text>
      <text x="${width / 2}" y="${height - 35}" text-anchor="middle" class="map-end-label">Hela vägen. Med huvudet klart.</text>`;
    $('map-tiles').replaceChildren();
    for (let position = 0; position <= G.BOARD_SIZE; position++) {
      const button = element('button', 'map-tile');
      button.type = 'button'; button.dataset.position = position;
      button.style.left = coords[position].x / width * 100 + '%';
      button.style.top = coords[position].y / height * 100 + '%';
      const bossIndex = G.BOSSES.findIndex(boss => boss.position === position);
      if (bossIndex >= 0) {
        button.classList.add('boss-tile'); button.dataset.number = 'BOSS ' + (bossIndex + 1);
        button.dataset.boss = G.BOSSES[bossIndex].id;
      } else if (position === 0) {
        button.classList.add('start-tile'); button.textContent = 'START';
      } else button.textContent = position;
      button.addEventListener('click', () => showTile(position));
      $('map-tiles').append(button);
    }
    $('map-pawns').replaceChildren();
    for (const player of players()) {
      const button = element('button', 'map-pawn');
      button.type = 'button'; button.dataset.player = player.id; button.dataset.own = player.own;
      button.addEventListener('click', () => showTile(players().find(item => item.id === player.id).position));
      $('map-pawns').append(button);
    }
    renderMap();
  }
  function renderMap() {
    if (!geometry) return;
    const progress = G.progress(state), allPlayers = players();
    for (const button of document.querySelectorAll('.map-tile')) {
      const position = Number(button.dataset.position);
      const boss = G.BOSSES.find(item => item.position === position);
      const completed = boss ? progress.completedBossIds.includes(boss.id) : position < progress.position;
      button.dataset.state = completed ? 'done' : position === progress.position ? 'current' : 'future';
      if (boss) {
        const locked = !G.isBossOpen(boss.id, testDay);
        button.dataset.locked = locked; button.dataset.number = locked ? '31 OKT' : 'BOSS ' + (G.BOSSES.indexOf(boss) + 1);
      }
      button.setAttribute('aria-label', `${position ? 'Ruta ' + position : 'Start'}${boss ? ', ' + boss.name : ''}${position === progress.position ? ', du är här' : ''}. ${allPlayers.filter(player => player.position === position).length} spelare.`);
    }
    $('map-travelled').setAttribute('d', pathFor(geometry.coords.slice(0, progress.position + 1)));
    document.querySelectorAll('.crowd-badge').forEach(button => button.remove());
    const groups = new Map();
    for (const player of allPlayers) {
      if (!groups.has(player.position)) groups.set(player.position, []);
      groups.get(player.position).push(player);
    }
    for (const [position, group] of groups) {
      const point = geometry.coords[position];
      const offsets = group.length === 1 ? [[0, 0]] : [[0, -9], [-21, 7], [21, 9]];
      group.forEach((player, index) => {
        const button = document.querySelector(`[data-player="${player.id}"]`);
        button.hidden = index >= 3; button.dataset.mount = player.mount.id; button.dataset.personal = !!player.mount.image;
        setPawn(button, player.mount, player.name + ' på ' + player.mount.name, 96);
        button.firstElementChild.style.transform = Math.floor(Math.max(0, position - 1) / geometry.cols) % 2 ? 'scaleX(-1)' : '';
        button.setAttribute('aria-label', `${player.name}, ${player.mount.name}, ${position ? 'ruta ' + position : 'start'}. Visa alla här.`);
        if (index < 3) {
          button.style.left = (point.x + offsets[index][0]) / geometry.width * 100 + '%';
          button.style.top = (point.y + offsets[index][1]) / geometry.height * 100 + '%';
        }
      });
      if (group.length > 3) {
        const badge = element('button', 'crowd-badge', '+' + (group.length - 3));
        badge.type = 'button'; badge.style.left = (point.x + 30) / geometry.width * 100 + '%';
        badge.style.top = (point.y + 13) / geometry.height * 100 + '%';
        badge.setAttribute('aria-label', group.length + ' spelare på samma ruta. Visa alla.');
        badge.addEventListener('click', () => showTile(position)); $('map-pawns').append(badge);
      }
    }
  }
  function centerMap(position = G.progress(state).position, smooth = true) {
    const top = geometry.coords[position].y / geometry.height * $('map-surface').getBoundingClientRect().height - $('map-scroll').clientHeight * .46;
    $('map-scroll').scrollTo({ top: Math.max(0, top), behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  }
  function render() {
    const progress = G.progress(state);
    const awaitingFinal = progress.pendingBoss?.id === 'final';
    const blockingBoss = !!progress.pendingBoss && !awaitingFinal;
    const finalOpen = G.isBossOpen('final', testDay);
    const today = progress.pointsUnlocked ? G.scoreTotals(state, testDay) : G.totals(state, testDay);
    const score = G.scoreTotals(state);
    const scoringAllowed = G.canScore(state, testDay);
    const exercises = progress.pointsUnlocked ? G.SCORING_EXERCISES : G.EXERCISES;
    const profile = ownProfile(), mount = ownMount();
    setPawn($('hero-rider'), mount, profile ? profile.username + ' – personlig pjäs' : 'Din följeslagare ' + mount.name, 160);
    $('mount-name').textContent = profile ? profile.username : mount.name;
    $('choose-avatar').hidden = !!profile; $('choose-avatar').disabled = !!profile;
    $('personal-pawn-lock').hidden = !profile;
    $('hero-passport').dataset.personal = !!profile;
    $('test-participant').value = participantId;
    $('test-day').value = testDay;
    $('crowd-test').textContent = crowd ? 'Sprid ut demosällskapet igen' : 'Samla demosällskapet på min ruta';
    $('exercise-panel').dataset.phase = progress.pointsUnlocked ? 'scoring' : 'journey';
    $('exercise-kicker').textContent = progress.pointsUnlocked ? progress.finished ? 'FINALEN ÄR KLAR · POÄNGJAKTEN FORTSÄTTER' : 'POÄNGJAKTEN ÄR ÖPPEN · FINAL 31 OKTOBER' : 'RESAN · 0 POÄNG';
    $('score-summary').hidden = !progress.pointsUnlocked;
    $('score-today').textContent = progress.pointsUnlocked ? today.points : 0;
    $('score-total').textContent = score.points;
    $('see-finish').hidden = !progress.finished || !finalOpen;
    const gate = $('gate-card'); gate.hidden = !progress.pendingBoss;
    if (awaitingFinal) {
      gate.innerHTML = `<h3>${finalOpen ? 'Finalen är öppen!' : 'Finalen väntar vid slottet.'}</h3><p>${finalOpen ? 'Bakrusbaronen väntar på ditt sista uppdrag. Du kan fortsätta samla poäng även efter mötet.' : 'Bakrusbaronen öppnar den 31 oktober. Samla poäng här medan du väntar på finaldagen.'}</p><button type="button" id="meet-boss" ${finalOpen ? '' : 'disabled'}>${finalOpen ? 'Möt Bakrusbaronen ✦' : 'Öppnar 31 oktober'}</button>`;
      $('meet-boss').addEventListener('click', () => showBoss(G.BOSSES.at(-1)));
    } else if (progress.pendingBoss) {
      gate.innerHTML = `<h3>${esc(progress.pendingBoss.name)} står i vägen.</h3><p>Klara bossens utmaning innan du kan registrera fler steg.</p><button type="button" id="meet-boss">Möt frestelsen ↗</button>`;
      $('meet-boss').addEventListener('click', () => showBoss(progress.pendingBoss));
    }
    if (awaitingShortcut()) {
      gate.hidden = false;
      gate.innerHTML = '<h3>En hemlig stig väntar.</h3><p>Du har hittat ett vägskäl på ruta 21. Välj din väg för att fortsätta.</p><button type="button" id="open-shortcut">Välj din väg ↗</button>';
      $('open-shortcut').disabled = !!R && (R.busy || !R.data.active || R.data.profile.status !== 'active');
      $('open-shortcut').onclick = showShortcut;
    }
    if (awaitingRide()) {
      gate.hidden = false;
      gate.innerHTML = '<h3>Vill herrn ha skjuts?</h3><p>En skum gubbe väntar på ditt svar på ruta 28.</p><button type="button" id="open-ride">Prata med gubben ↗</button>';
      $('open-ride').disabled = !!R && (R.busy || !R.data.active || R.data.profile.status !== 'active');
      $('open-ride').onclick = showRide;
    }
    $('exercise-title').innerHTML = progress.pointsUnlocked ? progress.finished ? 'Du stod emot.<br>Fortsätt samla poäng.' : 'Samla poäng<br>inför finalen.' : progress.pendingBoss ? 'Nu prövas <br>ditt pannben.' : 'Vad blir ditt <br>nästa steg?';
    $('exercise-intro').textContent = progress.pointsUnlocked
      ? scoringAllowed ? progress.finished ? 'Alla bossar är besegrade. Nya övningar ger 1 poäng per registrering fram till temats slut den 31 oktober.' : finalOpen ? 'Det är finaldag! Gör ditt sista bossuppdrag och fortsätt samla poäng fram till temats slut.' : 'Du har nått Hangover castle och poängjakten är upplåst. Nya övningar ger 1 poäng per registrering – resans övningar räknas inte in.'
        : 'Poängjakten öppnades den ' + Number(progress.pointsUnlockedOn.slice(8)) + ' oktober. Välj den dagen eller en senare testdag för att samla poäng.'
      : progress.pendingBoss ? 'Klara bossens uppdrag för att fortsätta resan. Poängjakten öppnas när du når Hangover castle på ruta 60.'
        : 'Varje registrering flyttar dig en ruta. Riket ger inga poäng – nå Hangover castle på ruta 60 för att öppna poängjakten.';
    for (const button of document.querySelectorAll('[data-exercise],[data-quick-exercise]')) {
      const compact = !!button.dataset.quickExercise;
      const exercise = exercises.find(item => item.id === (button.dataset.exercise || button.dataset.quickExercise));
      const label = exerciseLabel(exercise, compact);
      button.disabled = blockingBoss || awaitingEncounter() || (progress.pointsUnlocked && !scoringAllowed) || !!R && (R.busy || !R.data.active || R.data.profile.status !== 'active');
      button.querySelector('strong').textContent = label;
      button.setAttribute('aria-label', exerciseLabel(exercise) + (progress.pointsUnlocked ? ', registrera 1 poäng' : ', registrera en ruta'));
      button.querySelector('small').textContent = blockingBoss ? compact ? 'Bossen väntar' : 'Bossen måste besegras först'
        : progress.pointsUnlocked && !scoringAllowed ? 'Välj en senare testdag'
          : (progress.pointsUnlocked ? '+1 poäng' : '+1 ruta') + (compact ? '' : ' · I dag: ' + today[exercise.id].toLocaleString('sv-SE') + (exercise.distanceKm ? ' km' : ' st'));
    }
    $('quick-actions').hidden = blockingBoss || awaitingEncounter();
    $('quick-gate').hidden = !progress.pendingBoss && !awaitingEncounter();
    $('quick-gate').disabled = awaitingFinal && !finalOpen;
    $('quick-gate').textContent = awaitingFinal ? finalOpen ? 'Möt Bakrusbaronen ✦' : 'Finalen öppnar 31 oktober' : 'Möt frestelsen ↗';
    if (awaitingShortcut()) { $('quick-gate').textContent = 'Välj din väg på ruta 21 ↗'; $('exercise-title').innerHTML = 'Du har hittat<br>en hemlig stig.'; $('exercise-intro').textContent = 'Ett vägskäl väntar. Välj din väg innan du tar nästa steg.'; }
    if (awaitingRide()) { $('quick-gate').textContent = 'Prata med gubben på ruta 28 ↗'; $('exercise-title').innerHTML = 'Någon erbjuder<br>dig skjuts.'; $('exercise-intro').textContent = 'Tacka ja eller nej innan du tar nästa steg.'; }
    const nextBoss = G.BOSSES.find(boss => boss.position > progress.position);
    $('quick-status').textContent = progress.pointsUnlocked ? (progress.finished ? 'Finalen är klar · ' : 'Vid slottet · ') + today.points + ' poäng i dag' : progress.pendingBoss ? progress.pendingBoss.name + ' blockerar vägen.' : (progress.position ? 'Ruta ' + progress.position + ' · ' : '') + (nextBoss.position - progress.position) + ' steg till nästa boss.';
    $('undo-last').disabled = !state.events.length || !!R && (R.busy || !R.data.active || R.data.profile.status !== 'active');
    const chapter = Math.max(0, G.BOSSES.findIndex(boss => boss.position >= progress.position));
    $('chapter-nav').replaceChildren(...G.BOSSES.map((boss, index) => {
      const button = element('button', '', ROMAN[index] + ' · ' + CHAPTERS[index]);
      button.type = 'button'; button.dataset.active = index === chapter; button.dataset.done = progress.completedBossIds.includes(boss.id);
      button.addEventListener('click', () => centerMap(index ? G.BOSSES[index - 1].position + 1 : 1));
      return button;
    }));
    H.render(homeSnapshot());
    if (R) {
      if(!R.data.active) { $('exercise-intro').textContent = !R.data.enabled ? 'Frestelsernas rike är ännu inte aktiverat. Din sparade resa finns kvar.' : R.data.today < G.START_DATE ? 'Se dig omkring och lär känna din pjäs. Du kan börja registrera träning måndag 26 oktober kl. 00.00 svensk tid.' : 'Finalveckan är avslutad. Din resa och dina poäng finns kvar.'; }
      if (R.data.today < G.START_DATE) {
        $('exercise-kicker').textContent = 'START MÅNDAG 26 OKTOBER · KL. 00.00';
        if (awaitingShortcut()) {
      gate.hidden = false;
      gate.innerHTML = '<h3>En hemlig stig väntar.</h3><p>Du har hittat ett vägskäl på ruta 21. Välj din väg för att fortsätta.</p><button type="button" id="open-shortcut">Välj din väg ↗</button>';
      $('open-shortcut').disabled = !!R && (R.busy || !R.data.active || R.data.profile.status !== 'active');
      $('open-shortcut').onclick = showShortcut;
    }
    $('exercise-title').innerHTML = 'Din pjäs är redo.<br>Äventyret öppnar snart.';
        $('quick-status').textContent = 'Träningsstart måndag 26 oktober kl. 00.00 svensk tid.';
        document.querySelectorAll('[data-exercise] small,[data-quick-exercise] small').forEach(label => { label.textContent = 'Öppnar 26 okt · 00.00'; });
      }
      $('quick-gate').disabled ||= R.busy || !R.data.active;
      const defeat = $('defeat-boss'); if(defeat) defeat.disabled = R.busy || !R.data.active || R.data.profile.status !== 'active';
    }
    renderMap(); scheduleTreatCheck(); scheduleShortcutCheck(); scheduleRideCheck();
  }
  function showCastleArrival() {
    const content = detail('Du är framme vid slottet!', 'POÄNGJAKTEN ÄR UPPLÅST');
    content.append(element('p', '', 'Fem bossar är besegrade och du har nått Hangover castle. Nu kan du samla poäng: 15 squats, 10 armhävningar, 5 pull-ups eller 1 km löpning ger 1 poäng per ny registrering.'));
    content.append(element('p', '', G.isBossOpen('final', testDay) ? 'Det är den 31 oktober och Bakrusbaronen är redo för finalen!' : 'Bakrusbaronen öppnar den 31 oktober. Samla poäng medan du väntar – du behöver inte besegra honom för att börja.'));
    const start = element('button', 'primary-button', 'Börja samla poäng →'); start.type = 'button'; start.id = 'start-scoring';
    start.addEventListener('click', () => {
      closeDialog('detail-dialog');
      $('exercise-panel').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      document.querySelector('[data-exercise]:not(:disabled)')?.focus({ preventScroll: true });
    });
    content.append(start);
    if (G.isBossOpen('final', testDay)) {
      const meet = element('button', 'text-button', 'Möt Bakrusbaronen ✦'); meet.type = 'button'; meet.id = 'arrival-meet-final';
      meet.addEventListener('click', () => { closeDialog('detail-dialog'); showBoss(G.BOSSES.at(-1)); }); content.append(meet);
    }
  }
  function closeDialog(id) {
    if (id === 'boss-dialog') { stopBossAudio(); F.stop(); }
    $(id).close();
  }
  function renderBossAudio(playing, message = 'Valfritt · Lyssna på bossens berättelse.') {
    const button = $('boss-audio-toggle');
    if (!button) return;
    button.setAttribute('aria-pressed', String(playing));
    button.querySelector('[data-audio-icon]').textContent = playing ? '■' : '▶';
    button.querySelector('[data-audio-label]').textContent = playing ? 'Stoppa ljud' : 'Spela ljud';
    $('boss-audio-status').textContent = message;
  }
  function stopBossAudio(message) {
    audioGeneration++;
    bossAudio.pause();
    bossAudio.removeAttribute('src');
    bossAudio.load();
    renderBossAudio(false, message);
  }
  function toggleBossAudio(boss) {
    if ($('boss-audio-toggle').getAttribute('aria-pressed') === 'true') { stopBossAudio(); return; }
    const generation = ++audioGeneration;
    const failed = () => {
      if (generation !== audioGeneration) return;
      stopBossAudio('Ljudet kunde inte spelas. Tryck på Spela ljud för att försöka igen.');
    };
    // Assign and play only inside the click: no autoplay or download on card opening.
    bossAudio.src = '/adventure/audio/' + BOSS_AUDIO[boss.id] + '.m4a';
    renderBossAudio(true, 'Ljudet spelas. Du kan stoppa det när du vill.');
    try { bossAudio.play().catch(failed); } catch { failed(); }
  }
  bossAudio.addEventListener('ended', () => stopBossAudio('Klart! Tryck på Spela ljud om du vill lyssna igen.'));
  bossAudio.addEventListener('error', () => {
    if (bossAudio.hasAttribute('src')) stopBossAudio('Ljudet kunde inte spelas. Tryck på Spela ljud för att försöka igen.');
  });
  $('boss-dialog').addEventListener('cancel', () => { stopBossAudio(); F.stop(); });
  $('boss-dialog').addEventListener('close', () => { stopBossAudio(); F.stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopBossAudio(); F.stop(); } });
  window.addEventListener('pagehide', () => { stopBossAudio(); F.stop(); });
  function encounterScene(boss, mode = 'active') {
    const index = G.BOSSES.findIndex(item => item.id === boss.id);
    const mount = ownMount();
    const victorious = mode === 'victory' || mode === 'final';
    const tint = ['#809061', '#956579', '#c57945', '#b2a76b', '#81758d', '#ad915b'][index];
    const status = victorious ? 'FRESTELSEN BESEGRAD' : mode === 'active' ? 'EN FRESTELSE UTMANAR DIG' : mode === 'done' ? 'DU HAR STÅTT EMOT' : 'EN FRESTELSE VÄNTAR';
    return `<div class="boss-stage" data-mode="${mode}" style="--encounter-tint:${tint}" role="img" aria-label="${esc('Du på ' + mount.name + (victorious ? ' har besegrat ' : ' möter ') + boss.name)}">
      <svg class="encounter-landscape" viewBox="0 0 1000 430" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path d="M0 360 125 190 230 315 350 170 520 355 690 180 840 330 950 210 1000 360V430H0Z" fill="#a5ae80" opacity=".23"/><g fill="#6c835a" opacity=".42"><path d="m10 345 70-145 71 145h-38l58 62H0l57-62ZM185 365l43-98 47 98h-24l39 45H168l36-45Z"/><path d="m860 370 70-170 70 170h-34l34 60H850l43-60Z"/></g><path d="M0 376Q240 332 520 385T1000 370V430H0Z" fill="#7b855b" opacity=".2"/></svg>
      <div class="encounter-hud"><div class="fighter-tag player-tag"><small>ÄVENTYRAREN</small><strong>Du · ${esc(mount.name)}</strong></div><div class="fighter-tag enemy-tag"><small>BOSS ${index + 1} / 6</small><strong>${esc(boss.name)}</strong></div></div>
      <div class="encounter-enemy" data-boss="${boss.id}" aria-hidden="true">${B.bossSVG(boss.id)}</div>
      <div class="encounter-ground" aria-hidden="true"></div>
      <div class="encounter-rider" data-mount="${mount.id}" aria-hidden="true">${pawnMarkup(mount, '', 300)}</div>
      <span class="encounter-vs" aria-hidden="true">${victorious ? '✓' : 'VS'}</span>
      <span class="encounter-verdict" aria-hidden="true">${status}</span>
    </div>`;
  }
  function encounterStory(boss) {
    const dialogue = boss.dialogue.map(line => `<p>”${esc(line)}”</p>`).join('');
    return `<p class="boss-story">${esc(boss.story)}</p><blockquote class="boss-dialogue" aria-label="${esc(boss.name + ' säger')}">${dialogue}</blockquote><p class="boss-challenge-story">${esc(boss.challengeStory)}</p>`;
  }
  function canOpenBossCard(boss) {
    const completed = G.progress(state).completedBossIds;
    const next = G.BOSSES.find(item => !completed.includes(item.id));
    return !!boss && next?.id === boss.id && G.isBossOpen(boss.id, testDay);
  }
  function showBoss(boss) {
    clearTimeout(bossPopupTimeout);
    if (!G.isBossOpen(boss.id, testDay)) { feedback('Bakrusbaronen öppnar den 31 oktober. Nå slottet för att börja samla poäng under tiden.'); return; }
    if (!canOpenBossCard(boss)) { feedback('Ett bosskort i taget. Klara din nästa frestelse för att låsa upp följande boss.'); return; }
    stopBossAudio(); F.stop();
    document.querySelector('[data-close=boss-dialog]').setAttribute('aria-label', 'Stäng bosskortet');
    currentBoss = boss; selectedChoice = null;
    const progress = G.progress(state), active = progress.pendingBoss?.id === boss.id;
    const done = progress.completedBossIds.includes(boss.id);
    $('boss-dialog').dataset.mode = 'encounter';
    $('boss-dialog-content').innerHTML = `${encounterScene(boss, active ? 'active' : done ? 'done' : 'preview')}<div class="boss-dialog-copy"><div class="encounter-narrative"><p class="eyebrow">${done ? 'FRESTELSEN ÄR BESEGRAD' : active ? 'ALKOHOL ÄR BOSSENS PRIS FÖR PASSAGEN' : 'EN FRESTELSE LÄNGRE FRAM'} · RUTA ${boss.position}</p><h2 id="boss-dialog-title">${esc(boss.name)}</h2><section class="boss-audio-player" aria-label="Bossens ljud"><button type="button" class="boss-audio-toggle" id="boss-audio-toggle" aria-pressed="false" aria-describedby="boss-audio-status"><span class="boss-audio-icon" data-audio-icon aria-hidden="true">▶</span><span data-audio-label>Spela ljud</span></button><p id="boss-audio-status" role="status">Valfritt · Lyssna på bossens berättelse.</p></section>${encounterStory(boss)}<p class="sober-response">Du väljer en annan väg: stå emot och klara utmaningen.</p></div><div class="encounter-actions">${active ? '<p class="eyebrow">DITT UPPDRAG · GÖR OCH DELA I GRUPPEN</p><div class="challenge-panel boss-mission" id="challenge-panel"></div>' : `<p class="preview-note">${done ? 'Du har klarat den här utmaningen. Vägen är öppen.' : 'Den här bossen väntar på ruta ' + boss.position + '. Träna dig dit för att möta frestelsen.'}</p><button type="button" class="primary-button" id="back-to-map">Tillbaka till kartan</button>`}</div></div>`;
    $('boss-audio-toggle').addEventListener('click', () => toggleBossAudio(boss));
    if (active) selectChallenge(boss.choices[0]);
    else $('back-to-map').addEventListener('click', () => closeDialog('boss-dialog'));
    if (!$('boss-dialog').open) $('boss-dialog').showModal();
    $('boss-dialog').scrollTop = 0;
  }
  function selectChallenge(choice) {
    selectedChoice = choice;
    const arena = document.querySelector('.boss-stage');
    if (arena) { arena.dataset.action = 'stand-firm'; arena.querySelector('.encounter-verdict').textContent = 'DITT DRAG: STÅ EMOT'; }
    const panel = $('challenge-panel');
    panel.dataset.challenge = choice.id;
    panel.innerHTML = `<h3 class="mission-title">${esc(choice.title)}</h3><p class="mission-description">${esc(choice.detail)}</p><button type="button" class="primary-button" id="defeat-boss">Uppdraget är gjort och delat ✦</button><small class="challenge-note">Du delar själv i gruppen och bekräftar här när det är gjort.</small>`;
    $('defeat-boss').disabled = !!R && (R.busy || !R.data.active || R.data.profile.status !== 'active');
    $('defeat-boss').addEventListener('click', async () => {
      if (R) { if(await R.commit('boss',{boss_id:currentBoss.id,choice_id:selectedChoice.id})) showVictory(G.progress(state).finished); return; }
      try {
        const next = G.resolveBoss(state, currentBoss.id, selectedChoice.id, testDay);
        save(next, currentBoss.name + ' är besegrad. Vägen är öppen!');
        showVictory(G.progress(state).finished);
      } catch {
        closeDialog('boss-dialog'); feedback('Utmaningen kunde inte sparas. Öppna bosskortet och försök igen.');
      }
    });
  }
  function showVictory(final) {
    const progress = G.progress(state);
    if (final && (!G.isBossOpen('final', testDay) || !progress.finished)) return;
    stopBossAudio(); F.stop();
    $('boss-dialog').dataset.mode = final ? 'finale' : 'victory';
    document.querySelector('[data-close=boss-dialog]').setAttribute('aria-label', final ? 'Stäng firandet' : 'Stäng bosskortet');
    $('boss-dialog-content').innerHTML = final ? F.markup(pawnMarkup(ownMount(), '', 300), progress.bossesDefeated) : `${encounterScene(currentBoss, 'victory')}<div class="victory"><div class="victory-medal" aria-hidden="true">✦</div><p class="eyebrow">EN FRESTELSE MINDRE</p><h2 id="boss-dialog-title">Pannben: ${progress.bossesDefeated}.<br>Frestelserna: 0.</h2><p>Bossen kliver åt sidan. Din resa fortsätter — nästa ruta väntar på dig.</p><button type="button" class="primary-button" id="continue-journey">Vidare på äventyret →</button></div>`;
    $('continue-journey').addEventListener('click', () => {
      closeDialog('boss-dialog');
      const target = final ? document.querySelector('[data-exercise]:not(:disabled)') : matchMedia('(max-width:700px)').matches ? document.querySelector('[data-quick-exercise]:not(:disabled)') : document.querySelector('[data-exercise]:not(:disabled)');
      if (final) $('exercise-panel').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
    });
    if (!$('boss-dialog').open) $('boss-dialog').showModal();
    $('boss-dialog').scrollTop = 0;
    if (final) {
      $('confetti').replaceChildren(); F.start(); $('finale-sound').focus({ preventScroll: true });
    } else burst();
  }
  function burst() {
    $('confetti').replaceChildren();
    if (reducedMotion()) return;
    for (let n = 0; n < 32; n++) {
      const particle = element('i', 'game-confetti');
      particle.style.setProperty('--dx', Math.cos(n * 2.4) * (120 + (n % 6) * 35) + 'px');
      particle.style.setProperty('--dy', 160 + (n % 8) * 45 + 'px');
      particle.style.setProperty('--rotate', n * 67 + 'deg');
      particle.style.background = ['#ed8139', '#8aa278', '#d4b571', '#fff1c8'][n % 4];
      particle.style.animationDelay = (n % 5) * .025 + 's'; $('confetti').append(particle);
    }
    setTimeout(() => $('confetti').replaceChildren(), 2100);
  }
  function detail(title, kicker) {
    $('detail-content').className = 'detail-content';
    $('detail-content').innerHTML = `<p class="eyebrow">${esc(kicker)}</p><h2 id="detail-title">${esc(title)}</h2>`;
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
    return $('detail-content');
  }
  function addPlayerDetail(container, player) {
    const row = element('div', 'player-detail');
    row.innerHTML = pawnMarkup(player.mount, '', 96);
    const copy = element('div');
    copy.append(element('strong', '', player.name + ' · ' + player.mount.name), element('small', '', player.position ? 'Ruta ' + player.position : 'Vid starten'));
    row.append(copy); container.append(row);
  }
  function showTile(position) {
    const boss = G.BOSSES.find(item => item.position === position), occupants = players().filter(player => player.position === position);
    const content = detail(position ? 'Ruta ' + position : 'Vid äventyrets början', boss ? boss.name : 'HÄR PÅ KARTAN');
    if (occupants.length) {
      content.append(element('p', '', occupants.length + (occupants.length === 1 ? ' äventyrare på den här rutan.' : ' äventyrare delar rutan. Här syns varje pjäs.')));
      occupants.forEach(player => addPlayerDetail(content, player));
    } else content.append(element('p', 'no-results', 'Ingen äventyrare står här just nu.'));
    if (boss) {
      const open = canOpenBossCard(boss), progress = G.progress(state);
      const done = progress.completedBossIds.includes(boss.id), waitingForDate = !G.isBossOpen(boss.id, testDay);
      if (!open) content.append(element('p', 'preview-note', done ? 'Den här bossen är besegrad. Bara nästa obesegrade bosskort kan öppnas.' : waitingForDate ? 'Bakrusbaronen öppnar den 31 oktober. När du når slottet på ruta 60 kan du börja samla poäng medan du väntar.' : 'Bossen syns på kartan, men kortet låses upp först när du har klarat föregående boss.'));
      const button = element('button', 'primary-button', !open ? done ? 'Besegrad' : waitingForDate ? 'Öppnar 31 oktober' : 'Bosskortet är låst' : progress.pendingBoss?.id === boss.id ? 'Möt frestelsen ↗' : 'Se bosskortet ↗');
      button.disabled = !open; button.dataset.openBoss = boss.id;
      button.style.marginTop = '20px';
      button.addEventListener('click', () => { closeDialog('detail-dialog'); showBoss(boss); }); content.append(button);
    }
  }
  function showAllPlayers() {
    const content = detail('Ditt resesällskap', R ? 'ALLA PJÄSER I RIKET' : 'SEX UNIKA PJÄSER · DEMO');
    content.append(element('p', '', 'Alla färdas på samma karta. Varje äventyrare har en egen djurföljeslagare.'));
    players().forEach(player => addPlayerDetail(content, player));
  }
  function showAvatars() {
    if (ownProfile()) { feedback('Din personliga pjäs är tilldelad och kan inte bytas.'); return; }
    const content = detail('Vem rider du med?', 'DIN EGEN FÖLJESLAGARE');
    content.append(element('p', '', 'Välj din pjäs för testresan. Deltagare med en personlig bild har en egen tilldelad pjäs.'));
    const grid = element('div', 'avatar-grid');
    MOUNTS.forEach((mount, index) => {
      const button = element('button', 'avatar-option'); button.type = 'button'; button.dataset.mount = mount.id;
      button.setAttribute('aria-pressed', String(index === mountIndex));
      button.innerHTML = S.riderSVG(mount.id, mount.color, '', 128) + `<span>${esc(mount.name)}</span>`;
      button.addEventListener('click', async () => {
        if (ownProfile()) return;
        if (R) { if(await R.commit('mount',{index})) { closeDialog('detail-dialog'); feedback(mount.name + ' är redo för äventyret.'); } return; }
        mountIndex = index; savePrefs(); render(); closeDialog('detail-dialog'); feedback(mount.name + ' är redo för äventyret.');
      }); grid.append(button);
    }); content.append(grid);
  }
  function showChapters() {
    const content = detail('En hel värld att stå emot.', 'KARTANS SEX KAPITEL');
    const progress = G.progress(state);
    G.BOSSES.forEach((boss, index) => {
      const button = element('button', 'chapter-entry'); button.type = 'button'; button.dataset.boss = boss.id;
      button.innerHTML = `<span class="boss-art"></span><span><strong>${ROMAN[index]} · ${esc(CHAPTERS[index])}</strong><small>${esc(boss.name)} · ruta ${boss.position}</small></span><i>${progress.completedBossIds.includes(boss.id) ? '✓' : '↗'}</i>`;
      button.addEventListener('click', () => { closeDialog('detail-dialog'); centerMap(index ? G.BOSSES[index - 1].position + 1 : 1); }); content.append(button);
    });
  }
  function showJournal() {
    const content = detail('Din resedagbok', 'DIN RESA OCH DINA POÄNG');
    if (!state.events.length) { content.append(element('p', 'no-results', 'Första sidan är fortfarande tom. Börja med en övning.')); return; }
    const list = element('ol', 'journal-list');
    let step = G.progress(state).position;
    for (const event of [...state.events].reverse()) {
      const row = element('li'); row.dataset.type = event.type;
      let title, badge;
      if (event.type === 'boss') {
        title = G.BOSSES.find(item => item.id === event.bossId).name + ' besegrad'; badge = '✦';
      } else {
        const scoring = event.type === 'score';
        const exercise = (scoring ? G.SCORING_EXERCISES : G.EXERCISES).find(item => item.id === event.exerciseId);
        title = formatAmount(event.distanceKm ? { ...exercise, distanceKm: event.distanceKm } : exercise) + (scoring ? ' · +1 poäng' : ' · 0 poäng');
        badge = scoring ? '+1' : step;
        if (!scoring) { step -= 1 + (state.stepCredits[event.id] || 0); if (state.stepCredits[event.id] === 1) title += Number(badge) === 29 ? ' · skjuts +1 ruta' : ' · genväg +1 ruta'; }
      }
      row.append(element('i', '', badge), element('span', '', title), element('small', '', Number(event.date.slice(8)) + ' okt')); list.append(row);
    }
    content.append(list);
  }
  async function record(exerciseId) {
    clearTimeout(bossPopupTimeout);
    if (R) {
      if (!await R.commit('exercise',{exercise_id:exerciseId})) return;
      feedback(G.progress(state).pointsUnlocked && state.events.at(-1)?.type === 'score' ? '+1 poäng! Sparat på ditt konto.' : 'Ett steg framåt! Sparat på ditt konto.');
      centerMap(); const pending = G.progress(state).pendingBoss;
      if (pending) { if(pending.id === 'final') showCastleArrival(); else showBoss(pending); }
      return;
    }
    try {
      const scoring = G.progress(state).pointsUnlocked;
      const exercise = (scoring ? G.SCORING_EXERCISES : G.EXERCISES).find(item => item.id === exerciseId);
      if (scoring) {
        save(G.recordScore(state, exerciseId, testDay), '+1 poäng! ' + formatAmount(exercise) + ' är registrerat.');
        return;
      }
      save(G.record(state, exerciseId, testDay), 'Ett steg framåt! ' + formatAmount(exercise) + ' är registrerat · 0 poäng.');
      centerMap();
      const pending = G.progress(state).pendingBoss;
      if (pending) bossPopupTimeout = setTimeout(async () => {
        if (G.progress(state).pendingBoss?.id === pending.id) {
          if (pending.id === 'final') showCastleArrival(); else showBoss(pending);
        }
      }, reducedMotion() ? 0 : 650);
    } catch {
      const progress = G.progress(state);
      feedback(progress.pendingBoss ? 'Bossen blockerar vägen. Klara utmaningen först.' : progress.finished ? 'Poängen kunde inte registreras. Kontrollera att testdagen är från upplåsningen till och med 31 oktober.' : 'Steget kunde inte registreras. Försök igen.');
    }
  }
  for (const exercise of G.EXERCISES) {
    const button = element('button', 'exercise-button'); button.type = 'button'; button.dataset.exercise = exercise.id;
    button.innerHTML = '<div><strong></strong><small>+1 ruta</small></div><span aria-hidden="true">→</span>';
    button.addEventListener('click', () => record(exercise.id)); $('exercise-buttons').append(button);
    const quick = element('button', 'quick-exercise'); quick.type = 'button'; quick.dataset.quickExercise = exercise.id;
    quick.innerHTML = '<strong></strong><small>+1 ruta</small>';
    quick.addEventListener('click', () => record(exercise.id)); $('quick-actions').append(quick);
  }
  $('find-me').innerHTML = S.iconSVG('compass');
  $('show-chapters').innerHTML = S.iconSVG('flag');
  $('find-me').addEventListener('click', () => centerMap());
  $('quick-gate').addEventListener('click', () => { if (awaitingShortcut()) { showShortcut(); return; } if (awaitingRide()) { showRide(); return; } const pending = G.progress(state).pendingBoss; if (pending) showBoss(pending); });
  $('show-chapters').addEventListener('click', showChapters);
  $('choose-avatar').addEventListener('click', showAvatars);
  for (const profile of A.PROFILES) {
    const option = element('option', '', profile.username + ' · personlig pjäs'); option.value = profile.id; $('test-participant').append(option);
  }
  $('test-participant').addEventListener('change', event => {
    clearTimeout(bossPopupTimeout); W.dismiss();
    for (const id of ['boss-dialog', 'detail-dialog']) if ($(id).open) closeDialog(id);
    participantId = A.forId(event.target.value)?.id || 'guest';
    savePrefs(); buildMap(); render(); centerMap(undefined, false);
    feedback(ownProfile() ? ownProfile().username + ' har en tilldelad personlig pjäs. Din testresa är kvar.' : 'Utan personlig bild kan du välja pjäs. Din testresa är kvar.');
    presentFirstVisit();
  });
  $('show-all-players').addEventListener('click', showAllPlayers);
  $('show-journal').addEventListener('click', showJournal);
  $('see-finish').addEventListener('click', () => showVictory(true));
  $('undo-last').addEventListener('click', async () => {
    clearTimeout(bossPopupTimeout);
    if (R) { if(await R.commit('undo',{event_id:state.events.at(-1)?.id})) { feedback('Den senaste registreringen är ångrad.'); centerMap(); } return; }
    if (!state.events.length) return;
    const last = state.events.at(-1);
    save(G.undo(state), last.type === 'boss' && last.bossId === 'final' ? 'Finalmarkeringen är ångrad. Dina poäng finns kvar och poängjakten är fortfarande öppen.' : last.type === 'score' ? 'Den senaste poängregistreringen är ångrad. Din pjäs står kvar vid målet.' : last.type === 'boss' ? 'Bossmarkeringen är ångrad. Frestelsen blockerar vägen igen.' : 'Den senaste övningen är ångrad. Din pjäs är tillbaka en ruta.');
    if (last.type !== 'score') centerMap();
  });
  $('test-day').addEventListener('change', event => {
    testDay = event.target.value; savePrefs();
    if (currentBoss?.id === 'final' && !G.isBossOpen('final', testDay) && $('boss-dialog').open) closeDialog('boss-dialog');
    render(); feedback('Ny testdag. Din resa och dina poäng finns kvar.');
  });
  $('crowd-test').addEventListener('click', () => { crowd = !crowd; render(); centerMap(); });
  $('reset-game').addEventListener('click', () => {
    if (!confirm('Börja om din lokala testresa och nollställa testpoängen? Riktiga poäng och den sparade derbyversionen påverkas inte.')) return;
    clearTimeout(bossPopupTimeout); H.resetParticipant(); save(G.createState(), 'En ny resa börjar. Din följeslagare väntar vid starten.'); centerMap(0);
  });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.close)));
  window.addEventListener('resize', () => {
    cancelAnimationFrame(animationFrame); animationFrame = requestAnimationFrame(async () => {
      const next = makeGeometry();
      if (next.cols !== geometry.cols) { buildMap(); centerMap(undefined, false); }
    });
  });
  window.addEventListener('storage', event => {
    if (R || event.key !== KEY) return;
    const restored = event.newValue === null ? G.createState() : G.restore(event.newValue);
    if (!restored) return;
    clearTimeout(bossPopupTimeout);
    if ($('boss-dialog').open) closeDialog('boss-dialog');
    state = restored; render(); feedback('Din resa och dina testpoäng uppdaterades från en annan flik.');
  });
  function homeSnapshot() { return { state, participantId, date: testDay, players: players() }; }
  function showShortcut() {
    if (!awaitingShortcut() || !window.AdventureShortcut || (R && (R.busy || !R.data.active || R.data.profile.status !== 'active'))) return false;
    return window.AdventureShortcut.show({
      label: R ? R.data.profile.name : (ownProfile()?.username || 'Din pjäs'),
      renderPawn: node => { node.innerHTML = pawnMarkup(ownMount(), '', 300); },
      lockedChoice: R?.pendingShortcut,
      async onChoose(choice) {
        if (R) {
          const saved = await R.commit('shortcut', { choice });
          const actual = R.data.state.shortcutChoice;
          if (!saved && !actual) return null;
          centerMap(); feedback(actual === 'take' ? 'Genvägen är sparad. En extra ruta, 0 poäng.' : 'Ditt vägval är sparat. Fortsätt träna dig framåt.');
          return { choice: actual };
        }
        save(G.chooseShortcut(state, choice, testDay), choice === 'take' ? 'Genvägen tog dig en extra ruta framåt. 0 poäng.' : 'Din väg är vald. Nästa övning flyttar dig framåt.');
        centerMap(); return { choice };
      },
      onClose: resumePendingBoss,
    });
  }
  function scheduleShortcutCheck() {
    clearTimeout(shortcutCheckTimer);
    shortcutCheckTimer = setTimeout(() => {
      const identity = R ? R.data.profile.id : participantId;
      if (!awaitingShortcut() || shortcutsShownThisVisit.has(identity) || document.querySelector('dialog[open]')) return;
      if (showShortcut()) shortcutsShownThisVisit.add(identity);
    }, 130);
  }
  function showRide() {
    if (!awaitingRide() || !window.AdventureRide || (R && (R.busy || !R.data.active || R.data.profile.status !== 'active'))) return false;
    return window.AdventureRide.show({
      label: R ? R.data.profile.name : (ownProfile()?.username || 'Din pjäs'),
      renderPawn: node => { node.innerHTML = pawnMarkup(ownMount(), '', 300); },
      lockedChoice: R?.pendingRide,
      async onChoose(choice) {
        if (R) {
          const saved = await R.commit('ride', { choice });
          const actual = R.data.state.rideChoice;
          if (!saved && !actual) return null;
          centerMap(); feedback(actual === 'take' ? 'Skjutsen är sparad. En extra ruta, 0 poäng.' : 'Ditt svar är sparat. Du missade en gratis extraruta och står kvar på ruta 28.');
          return { choice: actual };
        }
        save(G.chooseRide(state, choice, testDay), choice === 'take' ? 'En extra ruta med trevligt sällskap. 0 poäng.' : 'Du missade en gratis extraruta. Din pjäs står kvar på ruta 28.');
        centerMap(); return { choice };
      },
      onClose: resumePendingBoss,
    });
  }
  function scheduleRideCheck() {
    clearTimeout(rideCheckTimer);
    rideCheckTimer = setTimeout(() => {
      const identity = R ? R.data.profile.id : participantId;
      if (!awaitingRide() || ridesShownThisVisit.has(identity) || document.querySelector('dialog[open]')) return;
      if (showRide()) ridesShownThisVisit.add(identity);
    }, 150);
  }
  function scheduleTreatCheck(){
    clearTimeout(treatCheckTimer);
    treatCheckTimer=setTimeout(()=>{
      const position=G.progress(state).position;
      const identity=R?R.data.profile.id:participantId;
      if(position<18||(!R&&position!==18)||R?.busy||!window.AdventureTreat||document.querySelector('dialog[open]'))return;
      if(R&&(!Object.hasOwn(R.data.profile,'icecream_seen')||R.data.profile.icecream_seen))return;
      const key='soberoktober:icecream-discovery:2026-10-26:'+identity;
      if(treatsShownThisVisit.has(key))return;
      if(!R){try{if(localStorage.getItem(key)==='seen')return;}catch{}}
      const shown=window.AdventureTreat.show({renderPawn:node=>{node.innerHTML=pawnMarkup(ownMount(),'',300);},label:R?R.data.profile.name:(ownProfile()?.username||'Din pjäs'),onClose:resumePendingBoss});
      if(!shown)return;
      treatsShownThisVisit.add(key);
      if(R)R.markTreatSeen?.();else{try{localStorage.setItem(key,'seen');}catch{}}
    },100);
  }
  document.addEventListener('close',event=>{if(event.target instanceof HTMLDialogElement){scheduleTreatCheck();scheduleShortcutCheck();scheduleRideCheck();}},true);
  function resumePendingBoss() {
    clearTimeout(bossPopupTimeout);
    if (G.progress(state).pendingBoss?.id === 'final') return;
    bossPopupTimeout = setTimeout(async () => {
      const pending = G.progress(state).pendingBoss;
      if (pending && pending.id !== 'final' && !document.querySelector('dialog[open]')) showBoss(pending);
    }, 180);
  }
  function presentFirstVisit(force = false) {
    if (R) { if(!R.welcome(ownProfile(),force,resumePendingBoss)) resumePendingBoss(); return; }
    if (!W.show(ownProfile(), { force, onClose: resumePendingBoss })) resumePendingBoss();
  }
  if (R) {
    const apply = data => {
      state = G.restore(data.state); participantId = data.profile.pawn_id || 'guest';
      mountIndex = data.profile.mount_index; testDay = data.today;
      if (currentBoss && $('boss-dialog').open && $('boss-dialog').dataset.mode === 'encounter' && !canOpenBossCard(currentBoss)) closeDialog('boss-dialog');
      if (geometry) { buildMap(); render(); }
    };
    apply(R.data); R.bind(apply);
    // Demo tools are hidden and also disabled: they cannot mutate connected state.
    document.querySelectorAll('.test-tools button,.test-tools select').forEach(node => { node.disabled=true; node.replaceWith(node.cloneNode(true)); });
  }
  H.init({ snapshot: homeSnapshot, pawnMarkup, detail, closeDialog, showJournal,
    showOwnPawn: () => ownProfile() ? presentFirstVisit(true) : showAvatars() });
  buildMap(); render(); centerMap(undefined, false); presentFirstVisit();
})();
