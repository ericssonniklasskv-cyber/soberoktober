(() => {
  const ui = {
    loading: document.querySelector('#loading-state'),
    signedOut: document.querySelector('#signed-out-state'),
    history: document.querySelector('#history-state'),
    googleLogin: document.querySelector('#google-login'),
    loginStatus: document.querySelector('#login-status'),
    summary: document.querySelector('#summary-line'),
    competition: document.querySelector('#competition-status'),
    totalPoints: document.querySelector('#total-points'),
    completedDays: document.querySelector('#completed-days'),
    currentStreak: document.querySelector('#current-streak'),
    longestStreak: document.querySelector('#longest-streak'),
    identity: document.querySelector('#history-identity'),
    calendar: document.querySelector('#history-calendar'),
    weeklyReportList: document.querySelector('#weekly-report-list'),
    historyStatus: document.querySelector('#history-status'),
    detail: document.querySelector('#day-detail'),
    detailClose: document.querySelector('#detail-close'),
    detailDate: document.querySelector('#detail-date'),
    detailTitle: document.querySelector('#detail-title'),
    detailDescription: document.querySelector('#detail-description'),
    detailLevel: document.querySelector('#detail-level'),
    detailPoints: document.querySelector('#detail-points'),
    detailBonus: document.querySelector('#detail-bonus'),
    reportDetail: document.querySelector('#weekly-report-detail'),
    reportDetailClose: document.querySelector('#report-detail-close'),
    reportPeriod: document.querySelector('#weekly-report-period'),
    reportTitle: document.querySelector('#weekly-report-detail-title'),
    reportPep: document.querySelector('#weekly-report-pep'),
    reportStats: document.querySelector('#weekly-report-stats'),
    reportExerciseSection: document.querySelector('#weekly-report-exercise-section'),
    reportExercises: document.querySelector('#weekly-report-exercises'),
    reportSteps: document.querySelector('#weekly-report-steps'),
    reportConfetti: document.querySelector('#report-confetti'),
    finalReportCard: document.querySelector('#final-report-card'),
    finalReportSummary: document.querySelector('#final-report-summary'),
    finalReportAction: document.querySelector('#final-report-action'),
    finalReportDetail: document.querySelector('#final-report-detail'),
    finalReportClose: document.querySelector('#final-report-close'),
    finalReportPeriod: document.querySelector('#final-report-period'),
    finalReportTitle: document.querySelector('#final-report-title'),
    finalReportPep: document.querySelector('#final-report-pep'),
    finalReportStats: document.querySelector('#final-report-stats'),
    finalReportStatus: document.querySelector('#final-report-status'),
    finalReportExerciseSection: document.querySelector('#final-report-exercise-section'),
    finalReportExercises: document.querySelector('#final-report-exercises'),
    finalReportMultiplier: document.querySelector('#final-report-multiplier'),
    finalReportThrees: document.querySelector('#final-report-threes'),
    finalReportSteps: document.querySelector('#final-report-steps'),
    finalReportStepStats: document.querySelector('#final-report-step-stats'),
    finalReportConfetti: document.querySelector('#final-report-confetti'),
  };

  let currentSession = null;
  let editDate = null;
  let editData = null;
  let savingDay = false;
  let editRequest = 0;
  const edit = {
    form: document.querySelector('#day-edit-form'),
    fields: document.querySelector('#day-edit-fields'),
    level: document.querySelector('#day-edit-level'),
    parts: document.querySelector('#day-edit-parts'),
    bonus: document.querySelector('#day-edit-bonus'),
    bonusWrap: document.querySelector('#day-edit-bonus-wrap'),
    bonusLabel: document.querySelector('#day-edit-bonus-label'),
    save: document.querySelector('#day-edit-save'),
    status: document.querySelector('#day-edit-status'),
  };
  let client;
  let votingPreview=false,voteRpc='my_workout_vote',adventureEnabled=false;
  let sessionWork = Promise.resolve();
  let challengesByDate = new Map();
  let bonusClaimsByDate = new Map();
  let activeUserId = null;
  let stepResultsUnavailable = false;
  let finalReportData = null;
  const pointsFormatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

  const reports = window.SoberOctoberReportsUI.create({ ui, getUserId: () => activeUserId,
    getBingoState: () => bingoState, getStepDataUnavailable: () => stepResultsUnavailable,
    getFinalReportData: () => finalReportData, formatDate });

  const stockholmDate = window.SoberOctoberCalendar.stockholmDate;

  function formatDate(date) {
    return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long' })
      .format(new Date(`${date}T12:00:00`));
  }

  function showState(active) {
    [ui.loading, ui.signedOut, ui.history].forEach((state) => {
      state.hidden = state !== active;
    });
  }

  function completedChallengeDescription(challenge, result) {
    if (result?.kind === 'adventure') return 'Frestelsernas rike · Resan ger 0 poäng. Nya övningar vid slottet ger 1 poäng vardera.';
    if (result?.kind === 'vote') return result.description;
    if (result?.kind === 'roulette') return result.completed_workouts === 0 ? '10 000 steg istället för Spinn The Wheel' : 'Dagens Spinn The Wheel';
    if (result?.kind === 'bingo') return 'Träningsbingo';
    if (!challenge) return 'Passinformationen saknas';
    const logic = window.SoberOctoberChallengeLogic;
    const parts = logic?.completedParts(result, challenge) || ['first'];
    const descriptions = parts.map((part) => logic?.describePart(challenge, part) || '').filter(Boolean);
    return descriptions.join(challenge.completion_mode === 'and' ? ' och ' : ' eller ') || challenge.title;
  }

  function showSavedDay(data) {
    const result = data.result;
    ui.detailLevel.textContent = result ? `${result.multiplier}×` : 'Inte registrerat';
    ui.detailPoints.textContent = result ? `${pointsFormatter.format(Number(result.points))} poäng` : '–';
    ui.detailBonus.hidden = data.bonus_points === null;
    ui.detailBonus.textContent = data.bonus_points === null ? '' : `Bonuspoäng: ${pointsFormatter.format(Number(data.bonus_points))}`;
  }

  let bingoState = null;

  function setLevelOptions(voted) {
    const choices = voted ? [['', 'Inte registrerat'], ['workout', 'Dagens pass · 3 poäng'], ['steps', '10 000 steg · 1 poäng']]
      : [['', 'Välj nivå'], ['1', '1× · 1 poäng'], ['2', '2× · 1,5 poäng'], ['3', '3× · 2 poäng']];
    edit.level.replaceChildren(...choices.map(([value, text]) => new Option(text, value)));
    document.querySelector('label[for="day-edit-level"]').textContent = voted ? 'Vad gjorde du?' : 'Nivå';
    edit.form.querySelector('.day-edit-intro').textContent = voted
      ? 'Glömt att registrera? Välj passet eller 10 000 steg för den här dagen. Du får poäng för ett alternativ.'
      : 'Glömt att registrera eller valt fel nivå? Rätta ditt eget resultat här.';
  }

  function showVoteDay(data) {
    const day = data.voteDay, completion = day.completion;
    const winner = day.options.find(option => option.id === day.result?.option_id);
    const stepped = completion?.kind === 'steps';
    ui.detailTitle.textContent = stepped ? '10 000 steg' : winner?.title || 'Dagens val';
    ui.detailDescription.textContent = stepped ? '10 000 steg istället för dagens framröstade pass.' : winner?.description || 'Passet är inte avgjort ännu.';
    ui.detailLevel.textContent = completion ? (stepped ? '10 000 steg · klart' : 'Dagens val · klart') : 'Inte registrerat';
    ui.detailPoints.textContent = completion ? `${pointsFormatter.format(Number(completion.points))} poäng` : '–';
    ui.detailBonus.hidden = data.bonus_points === null;
    ui.detailBonus.textContent = data.bonus_points === null ? '' : `Bonuspoäng: ${pointsFormatter.format(Number(data.bonus_points))}`;
    edit.level.value = completion?.kind || '';
    edit.bonusWrap.hidden = !data.challenge?.bonus_description || !data.challenge?.bonus_points;
    edit.bonus.checked = data.bonus_points !== null;
    edit.bonusLabel.textContent = `${data.challenge?.bonus_description || ''} · ${pointsFormatter.format(Number(data.challenge?.bonus_points || 0))} bonuspoäng`;
  }

  async function openVoteDay(day) {
    const request = ++editRequest, userId = currentSession?.user.id;
    editDate = day.date; editData = null;
    setLevelOptions(true);
    edit.form.hidden = false; edit.fields.disabled = true;
    edit.parts.replaceChildren(); edit.bonusWrap.hidden = true;
    edit.status.textContent = 'Hämtar passet…';
    ui.detailDate.textContent = formatDate(day.date);
    ui.detailTitle.textContent = challengesByDate.get(day.date)?.title || 'Dagens val';
    ui.detailDescription.textContent = ''; ui.detailLevel.textContent = '–';
    ui.detailPoints.textContent = '–'; ui.detailBonus.hidden = true;
    ui.detail.showModal();
    try {
      const [vote, bonus] = await Promise.all([
        client.rpc(voteRpc), client.rpc('self_daily_result', { p_date: day.date }),
      ]);
      if (request !== editRequest || !ui.detail.open || currentSession?.user.id !== userId) return;
      if (vote.error) throw vote.error;
      // A theme day need not have a daily_challenges row unless it has a bonus.
      if (bonus.error && !(bonus.error.code === '22023' && /saknar ett publicerat pass/.test(bonus.error.message || ''))) throw bonus.error;
      const voteDay = vote.data?.days?.find(item => item.date === day.date);
      if (!voteDay?.result || day.date > vote.data.today) throw new Error('Du kan registrera ett avgjort pass för idag eller en tidigare dag under röstveckan.');
      editData = { voteDay, challenge: bonus.data?.challenge || null, bonus_points: bonus.data?.bonus_points ?? null };
      showVoteDay(editData); edit.status.textContent = ''; edit.fields.disabled = false;
    } catch (error) {
      if (request === editRequest) edit.status.textContent = error.message || 'Passet kunde inte hämtas. Försök igen.';
    }
  }

  async function saveVoteDay() {
    if (savingDay || !editData?.voteDay || !currentSession) return;
    const session = currentSession, request = editRequest, date = editDate;
    const choice = { '': 0, workout: 1, steps: 2 }[edit.level.value];
    const claimBonus = edit.bonus.checked && editData.bonus_points === null;
    const unclaimBonus = !edit.bonus.checked && editData.bonus_points !== null;
    let resultSaved = false;
    savingDay = true; ui.detailClose.disabled = true; edit.fields.disabled = true;
    edit.save.textContent = 'Sparar…'; edit.status.textContent = '';
    try {
      const { data, error } = await client.rpc(voteRpc, { p_action: 'save_result', p_date: date, p_option: choice });
      if (error) throw error;
      if (request !== editRequest || currentSession?.user.id !== session.user.id) return;
      editData.voteDay = data.days.find(day => day.date === date); resultSaved = true;
      if (claimBonus || unclaimBonus) {
        const bonus = await window.SoberOctoberBonus.setClaim(client, date, claimBonus, editData.bonus_points);
        if (request !== editRequest || currentSession?.user.id !== session.user.id) return;
        editData.bonus_points = bonus.bonus_points;
      }
      showVoteDay(editData);
      edit.status.textContent = 'Sparat! Din oktober är uppdaterad.';
      try { await loadHistory(session); }
      catch (_) { edit.status.textContent += ' Historiken kunde inte uppdateras just nu. Ladda om sidan.'; }
    } catch (error) {
      if (request !== editRequest || currentSession?.user.id !== session.user.id) return;
      if (resultSaved) { showVoteDay(editData); await loadHistory(session).catch(() => {}); }
      edit.status.textContent = (resultSaved ? 'Passresultatet är sparat, men bonusen kunde inte sparas. ' : '') + (error.message || 'Försök igen.');
    } finally {
      savingDay = false; ui.detailClose.disabled = false; edit.save.textContent = 'Spara resultat';
      if (request === editRequest) edit.fields.disabled = false;
    }
  }

  const bingoDialog = document.querySelector('#bingo-day-detail');
  bingoDialog.querySelector('button').addEventListener('click', () => bingoDialog.close());
  bingoDialog.addEventListener('click', event => { if (event.target === bingoDialog) bingoDialog.close(); });
  const bingoBonus = {
    section: document.querySelector('#bingo-day-bonus'),
    description: document.querySelector('#bingo-day-bonus-description'),
    button: document.querySelector('#bingo-day-bonus-button'),
    status: document.querySelector('#bingo-day-bonus-status'),
  };
  let bingoBonusDate = null, bingoBonusData = null, bingoBonusBusy = false, bingoBonusRequest = 0;
  function renderBingoBonus(data) {
    const configured = Boolean(data?.challenge?.bonus_description && Number(data.challenge.bonus_points) > 0);
    const claimed = data?.bonus_points !== null;
    bingoBonus.section.hidden = !configured;
    if (!configured) return;
    bingoBonus.description.textContent = `${data.challenge.bonus_description} · +${pointsFormatter.format(Number(data.challenge.bonus_points))} poäng`;
    bingoBonus.button.textContent = bingoBonusBusy ? 'Sparar…' : claimed ? '✓ Bonus klar · klicka ur' : 'Bonuspoäng';
    bingoBonus.button.setAttribute('aria-pressed', String(claimed));
    bingoBonus.button.disabled = bingoBonusBusy;
  }
  async function loadBingoBonus(date) {
    const request = ++bingoBonusRequest;
    bingoBonusDate = date;
    bingoBonusData = null;
    bingoBonus.section.hidden = true;
    bingoBonus.status.textContent = '';
    try {
      const {data, error} = await client.rpc('self_daily_result', {p_date: date});
      if (request !== bingoBonusRequest || !bingoDialog.open) return;
      if (error) throw error;
      bingoBonusData = data;
      renderBingoBonus(data);
    } catch (error) {
      // Bingo remains editable when no daily_challenges row/bonus exists.
      if (request === bingoBonusRequest && !(error.code === '22023' && /saknar ett publicerat pass/.test(error.message || ''))) {
        bingoBonus.section.hidden = false;
        bingoBonus.description.textContent = 'Bonusuppgiften kunde inte laddas.';
        bingoBonus.button.disabled = true;
        bingoBonus.status.textContent = error.message || 'Försök öppna dagen igen.';
      }
    }
  }
  bingoBonus.button.addEventListener('click', async () => {
    if (bingoBonusBusy || !bingoBonusData || !currentSession) return;
    const claimed = bingoBonusData.bonus_points !== null;
    if (claimed && !window.confirm('Avmarkera bonuspoängen för den här dagen?')) return;
    bingoBonusBusy = true;
    renderBingoBonus(bingoBonusData);
    try {
      bingoBonusData = await window.SoberOctoberBonus.setClaim(client, bingoBonusDate, !claimed, bingoBonusData.bonus_points);
      bingoBonus.status.textContent = claimed ? 'Bonuspoängen är avmarkerade.' : 'Bonuspoängen är sparade.';
      await loadHistory(currentSession);
    } catch (error) {
      bingoBonus.status.textContent = error.message || 'Bonusen kunde inte sparas.';
    } finally {
      bingoBonusBusy = false;
      renderBingoBonus(bingoBonusData);
    }
  });
  bingoDialog.addEventListener('cancel', event => { if (bingoBonusBusy) event.preventDefault(); });
  bingoDialog.addEventListener('close', () => { bingoBonusRequest += 1; });
  async function openDetail(day) {
    if(adventureEnabled && day.date>='2026-10-26'){if(savingDay||bingoBonusBusy)return;editRequest++;editData=null;ui.detailDate.textContent=formatDate(day.date);edit.form.hidden=true;ui.detailTitle.textContent='Frestelsernas rike';ui.detailDescription.textContent='Din sammanhängande resa fortsätter mellan dagarna. Registrera och ångra i riket.';ui.detailLevel.textContent=day.result?'Registrerad aktivitet':'Ingen registrerad aktivitet';ui.detailPoints.textContent=(day.result?.points||0)+' poäng';const bonus=bonusClaimsByDate.get(day.date);ui.detailBonus.hidden=!bonus;ui.detailBonus.textContent=bonus?'Bonuspoäng: '+bonus.points:'';ui.detail.showModal();return;}

    if (bingoBonusBusy || savingDay) return;
    if (window.SoberRouletteLive.isDate(day.date)) {
      // Saved rounds are shown in the roulette itself, never as the old 1×/2×/3× editor.
      location.href = '/?roulette-date=' + encodeURIComponent(day.date);
      return;
    }
    if (bingoState?.enabled && window.SoberOctoberCompetition.isBingoDate(day.date)) {
      document.querySelector('#bingo-day-title').textContent = formatDate(day.date);
      window.SoberOctoberBingo.mount(bingoDialog.querySelector('.bingo-editor'), day.date);
      bingoDialog.showModal();
      await loadBingoBonus(day.date);
      return;
    }
    if (votingPreview&&day.date>='2026-10-19'&&day.date<='2026-10-25') {
      await openVoteDay(day); return;
    }
    setLevelOptions(false);
    edit.form.hidden=false;
    if (savingDay) return;
    const request = ++editRequest;
    editDate = day.date;
    editData = null;
    edit.fields.disabled = true;
    edit.status.textContent = 'Hämtar passet…';
    edit.parts.replaceChildren();
    edit.bonusWrap.hidden = true;
    ui.detailDate.textContent = formatDate(day.date);
    ui.detailTitle.textContent = challengesByDate.get(day.date)?.title || 'Dagens pass';
    ui.detailDescription.textContent = '';
    ui.detailLevel.textContent = day.result ? (day.result.kind === 'adventure' ? 'Riket' : day.result.kind === 'vote' ? (day.result.completion_kind==='steps'?'10 000 steg':'Dagens val') : day.result.kind === 'roulette' ? (day.result.completed_workouts === 0 ? '10 000 steg' : 'Spinn The Wheel') : day.result.kind === 'bingo' ? 'Bingo' : `${day.result.multiplier}×`) : 'Inte registrerat';
    ui.detailPoints.textContent = day.result ? `${pointsFormatter.format(Number(day.result.points))} poäng` : '–';
    ui.detailBonus.hidden = true;
    ui.detail.showModal();
    try {
      const { data, error } = await client.rpc('self_daily_result', { p_date: day.date });
      if (request !== editRequest || !ui.detail.open) return;
      if (error) throw error;
      editData = data;
      const challenge = data.challenge;
      const logic = window.SoberOctoberChallengeLogic;
      const mode = challenge.completion_mode || 'single';
      ui.detailTitle.textContent = challenge.title;
      ui.detailDescription.textContent = [logic.describePart(challenge, 'first'), mode !== 'single' ? logic.describePart(challenge, 'second') : ''].filter(Boolean).join(mode === 'and' ? ' och ' : ' eller ');
      showSavedDay(data);
      edit.level.value = data.result ? String(data.result.multiplier) : '';
      if (mode === 'or') {
        const note = document.createElement('p');
        note.textContent = 'Vilken del gjorde du? Markera en eller båda.';
        edit.parts.append(note);
        ['first', 'second'].forEach((part) => {
          const label = document.createElement('label');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.value = part;
          input.checked = (data.result?.completed_parts || ['first']).includes(part);
          const text = document.createElement('span');
          text.textContent = logic.describePart(challenge, part);
          label.append(input, text);
          edit.parts.append(label);
        });
      }
      edit.bonusWrap.hidden = !challenge.bonus_description || !challenge.bonus_points;
      edit.bonus.checked = data.bonus_points !== null;
      edit.bonus.disabled = false;
      edit.bonusLabel.textContent = `${challenge.bonus_description || ''} · ${pointsFormatter.format(Number(challenge.bonus_points || 0))} bonuspoäng`;
      edit.status.textContent = '';
      edit.fields.disabled = false;
    } catch (error) {
      if (request === editRequest) edit.status.textContent = error.message || 'Passet kunde inte hämtas. Försök igen.';
    }
  }

  edit.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (editData?.voteDay) { await saveVoteDay(); return; }
    if (savingDay || !editData || !currentSession) return;
    const multiplier = edit.level.value ? Number(edit.level.value) : null;
    const claimBonus = edit.bonus.checked && editData.bonus_points === null;
    const unclaimBonus = !edit.bonus.checked && editData.bonus_points !== null;
    if (!multiplier && !claimBonus && !unclaimBonus) {
      edit.status.textContent = 'Välj en nivå eller markera bonusuppgiften.';
      return;
    }
    const mode = editData.challenge.completion_mode || 'single';
    const parts = mode === 'and' ? ['first', 'second'] : mode === 'or'
      ? [...edit.parts.querySelectorAll('input:checked')].map((input) => input.value) : ['first'];
    if (multiplier && !parts.length) {
      edit.status.textContent = 'Markera vilken del du gjorde.';
      return;
    }
    savingDay = true;
    ui.detailClose.disabled = true;
    edit.fields.disabled = true;
    edit.save.textContent = 'Sparar…';
    edit.status.textContent = '';
    try {
      const { data, error } = await client.rpc('self_daily_result', {
        p_date: editDate, p_action: 'save',
        p_payload: { expected: editData.result, multiplier, completed_parts: parts, claim_bonus: claimBonus, unclaim_bonus: unclaimBonus, expected_bonus_points: editData.bonus_points },
      });
      if (error) throw error;
      editData = data;
      showSavedDay(data);
      edit.bonus.checked = data.bonus_points !== null;
      edit.bonus.disabled = false;
      edit.status.textContent = data.restored ? 'Sparat! Du är aktiv i tävlingen igen.' : 'Sparat! Din oktober är uppdaterad.';
      try { await loadHistory(currentSession); }
      catch (_error) { edit.status.textContent += ' Historiken kunde inte uppdateras just nu. Ladda om sidan.'; }
    } catch (error) {
      edit.status.textContent = error.message || 'Kunde inte spara. Försök igen.';
    } finally {
      savingDay = false;
      ui.detailClose.disabled = false;
      edit.fields.disabled = false;
      edit.save.textContent = 'Spara resultat';
    }
  });
  ui.detail.addEventListener('close', () => { editRequest += 1; });
  ui.detail.addEventListener('cancel', (event) => { if (savingDay) event.preventDefault(); });

  function renderCalendar(history, today) {
    const firstWeekday = new Date('2026-10-01T12:00:00').getDay();
    const mondayOffset = (firstWeekday + 6) % 7;
    const cells = Array.from({ length: mondayOffset }, () => {
      const spacer = document.createElement('span');
      spacer.className = 'calendar-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      return spacer;
    });

    history.days.forEach((day, index) => {
      const cell = document.createElement(day.date <= today ? 'button' : 'div');
      cell.className = `calendar-day ${day.state}${day.date === today ? ' today' : ''}`;
      if (cell.tagName === 'BUTTON') {
        cell.type = 'button';
        cell.addEventListener('click', () => openDetail(day));
      }

      const dayNumber = document.createElement('span');
      dayNumber.className = 'day-number';
      dayNumber.textContent = String(index + 1);
      cell.append(dayNumber);

      const result = document.createElement('span');
      result.className = 'day-result';
      result.textContent = day.state === 'completed'
        ? (day.result.kind === 'adventure' ? 'Riket' : day.result.kind === 'vote' ? (day.result.completion_kind==='steps'?'10 000 steg':'Dagens val') : day.result.kind === 'roulette' ? (day.result.completed_workouts === 0 ? '10 000 steg' : 'Spinn The Wheel') : day.result.kind === 'bingo' ? 'Bingo' : `${day.result.multiplier}×`)
        : (day.state === 'missed' ? 'Missad' : (day.date === today ? 'Idag' : 'Senare'));
      cell.append(result);

      if (day.state === 'completed') {
        const points = document.createElement('span');
        points.className = 'day-points';
        points.textContent = `${pointsFormatter.format(Number(day.result.points))} p`;
        cell.append(points);
        const challenge = challengesByDate.get(day.date);
        const bonus = bonusClaimsByDate.get(day.date);
        cell.setAttribute('aria-label', `${formatDate(day.date)}, genomförd ${day.result.kind === 'adventure' ? 'Riket' : day.result.kind === 'vote' ? (day.result.completion_kind==='steps'?'10 000 steg':'Dagens val') : day.result.kind === 'roulette' ? (day.result.completed_workouts === 0 ? '10 000 steg' : 'Spinn The Wheel') : day.result.kind === 'bingo' ? 'bingo' : `${day.result.multiplier} gånger`}, ${pointsFormatter.format(Number(day.result.points))} poäng${bonus ? `, ${pointsFormatter.format(Number(bonus.points))} bonuspoäng` : ''}, ${completedChallengeDescription(challenge, day.result)}`);
      } else {
        cell.setAttribute('aria-label', `${formatDate(day.date)}, ${day.state === 'missed' ? 'missad' : 'framtida'}`);
      }
      cells.push(cell);
    });

    ui.calendar.replaceChildren(...cells);
  }

  function renderHistory(results, bonusClaims, displayName, competitionStatus) {
    const today = stockholmDate();
    const history = window.SoberOctoberHistory.calculate(results, today, competitionStatus, bonusClaims);
    const points = pointsFormatter.format(history.totalPoints);
    const dayWord = history.completedDays === 1 ? 'dag' : 'dagar';
    const streakWord = history.currentStreak === 1 ? 'dag' : 'dagar';

    ui.summary.textContent = `${history.completedDays} ${dayWord} genomförda · ${points} poäng · streak ${history.currentStreak} ${streakWord}`;
    ui.totalPoints.textContent = points;
    ui.completedDays.textContent = String(history.completedDays);
    ui.currentStreak.textContent = String(history.currentStreak);
    ui.longestStreak.textContent = String(history.longestStreak);
    ui.identity.textContent = displayName || '';
    ui.competition.className = `competition ${history.competition.tone}`;
    ui.competition.textContent = history.competition.text;
    renderCalendar(history, today);
  }

  async function loadHistory(session) {
    ui.historyStatus.textContent = '';
    const today = stockholmDate();
    const reportPlacementsAvailable = today >= window.SoberOctoberCalendar.OCTOBER_END;
    const [resultsResponse, challengesResponse, stepResultsResponse, bonusClaimsResponse, profileResponse, trainingLeaderboardResponse, stepLeaderboardResponse, bingoResponse, rouletteResponse, voteResponse] = await Promise.all([
      client
        .from('daily_results')
        .select('result_date, multiplier, points, completed_parts')
        .eq('user_id', session.user.id)
        .gte('result_date', '2026-10-01')
        .lte('result_date', '2026-10-31')
        .order('result_date'),
      client
        .from('daily_challenges')
        .select('challenge_date, title, description, unit, base_amount, completion_mode, second_description, second_base_amount, second_unit, bonus_description, bonus_points')
        .gte('challenge_date', '2026-10-01')
        .lte('challenge_date', '2026-10-31')
        .order('challenge_date'),
      client
        .from('step_period_results')
        .select('period_key, avg_steps')
        .eq('user_id', session.user.id),
      client
        .from('daily_bonus_claims')
        .select('challenge_date, points')
        .eq('user_id', session.user.id)
        .gte('challenge_date', '2026-10-01')
        .lte('challenge_date', '2026-10-31'),
      client
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle(),
      reportPlacementsAvailable ? client.rpc('get_leaderboard') : Promise.resolve({ data: [], error: null }),
      reportPlacementsAvailable ? client.rpc('get_step_leaderboard') : Promise.resolve({ data: [], error: null }),
      client.rpc('my_competition_bingo'),
      client.from('roulette_daily_scores').select('result_date, points, completed_workouts'),
      votingPreview?client.rpc(voteRpc):Promise.resolve({data:null,error:null}),
    ]);

    if (resultsResponse.error) throw resultsResponse.error;
    if (challengesResponse.error) throw challengesResponse.error;
    if (profileResponse.error) throw profileResponse.error;

    if (bingoResponse.error) throw bingoResponse.error;
    bingoState = bingoResponse.data;
    window.SoberOctoberBingo.setState(bingoState);
    if (rouletteResponse.error) throw rouletteResponse.error;
    if(voteResponse.error)throw voteResponse.error;
    const mergedResults = window.SoberRouletteLive.mergeResults(window.SoberOctoberCompetition.mergeResults(resultsResponse.data || [], bingoState), rouletteResponse.data || []);
    let results=votingPreview?window.SoberVoteLogic.mergeResults(mergedResults,voteResponse.data):mergedResults;
    if(adventureEnabled){const response=await client.rpc('my_adventure',{p_payload:{board_size:60}});if(response.error)throw response.error;const days=new Map();for(const e of response.data.state.events){if(!days.has(e.date))days.set(e.date,{result_date:e.date,points:0,kind:'adventure',multiplier:null});if(e.type==='score')days.get(e.date).points++;}results=[...results.filter(r=>r.result_date<'2026-10-26'),...days.values()];}
    const challengeMap=new Map((challengesResponse.data||[]).map(challenge=>[challenge.challenge_date,challenge]));
    for(const day of voteResponse.data?.days||[]){if(!day.result)continue;const winner=day.options.find(option=>option.id===day.result.option_id);challengeMap.set(day.date,{...challengeMap.get(day.date),challenge_date:day.date,title:winner.title,description:winner.description,base_amount:1,unit:'pass',completion_mode:'single'});}
    const challenges=[...challengeMap.values()];
    if (bonusClaimsResponse.error) throw bonusClaimsResponse.error;
    const bonusClaims = window.SoberOctoberCompetition.normalBonus(bonusClaimsResponse.data || [], bingoState);
    bonusClaimsByDate = new Map(bonusClaims.map((claim) => [claim.challenge_date, claim]));
    stepResultsUnavailable = Boolean(stepResultsResponse.error);
    if (stepResultsUnavailable) {
      console.warn('Stegresultaten kunde inte läsas; visar övrig historik ändå', stepResultsResponse.error);
    }
    const stepResults = stepResultsUnavailable ? [] : (stepResultsResponse.data || []);
    challengesByDate = new Map(challenges.map((challenge) => [challenge.challenge_date, challenge]));
    activeUserId = session.user.id;
    const competitionStatus = await window.SoberOctoberEliminations?.refresh(
      client,
      session.user.id,
      profileResponse.data?.display_name,
    );
    renderHistory(results, bonusClaims, profileResponse.data?.display_name, competitionStatus);
    reports.renderWeeklyReports(results, challenges, stepResults, bonusClaims, today);
    finalReportData = window.SoberOctoberHistory.buildFinalReport({
      results,
      challenges,
      stepResults,
      bonusClaims,
      bingo: bingoState,
      today,
      competitionStatus,
      trainingLeaderboard: trainingLeaderboardResponse.error ? [] : (trainingLeaderboardResponse.data || []),
      stepLeaderboard: stepLeaderboardResponse.error ? [] : (stepLeaderboardResponse.data || []),
      displayName: profileResponse.data?.display_name || '',
      stepsLogic: window.SoberOctoberSteps,
    });
    reports.renderFinalReportAccess(today, results, stepResults, competitionStatus);
    if (trainingLeaderboardResponse.error) console.warn('Träningsplaceringen kunde inte hämtas', trainingLeaderboardResponse.error);
    if (stepLeaderboardResponse.error) console.warn('Stegplaceringen kunde inte hämtas', stepLeaderboardResponse.error);
    ui.historyStatus.textContent = stepResultsUnavailable
      ? 'Stegdata kunde inte hämtas just nu. Övrig historik visas ändå.'
      : '';

    const requestedReport = new URLSearchParams(window.location.search).get('rapport');
    if (requestedReport && reports.hasWeeklyReport(requestedReport)) {
      reports.openWeeklyReport(requestedReport);
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
  }

  async function handleSession(session) {
    if (currentSession?.user.id !== session?.user.id && ui.detail.open) ui.detail.close();
    window.SoberOctoberBingo.init(client, async () => { if (currentSession) await loadHistory(currentSession); });
    currentSession = session;
    ui.loginStatus.textContent = '';
    if (!session) {
      bingoDialog.close();
      window.SoberOctoberBingo.reset();
      showState(ui.signedOut);
      return;
    }

    showState(ui.loading);
    try {
      await loadHistory(session);
      showState(ui.history);
    } catch (error) {
      console.error('Historiken kunde inte laddas', error);
      ui.loading.innerHTML = '<p class="loading">Din oktober kunde inte laddas just nu.</p>';
    }
  }

  ui.googleLogin.addEventListener('click', async () => {
    ui.googleLogin.disabled = true;
    ui.loginStatus.textContent = '';
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/min-oktober/', window.location.origin).href },
    });
    if (error) {
      ui.loginStatus.textContent = 'Google-inloggningen kunde inte startas.';
      ui.googleLogin.disabled = false;
    }
  });

  ui.detailClose.addEventListener('click', () => ui.detail.close());
  ui.detail.addEventListener('click', (event) => {
    if (event.target === ui.detail && !savingDay) ui.detail.close();
  });
  async function init() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Konfigurationen saknas');
      const config = await response.json(); adventureEnabled=config.adventureEnabled===true;
      votingPreview=config.votingEnabled===true||config.votingPreview===true;
      voteRpc=config.votingPreview===true?'local_workout_vote':'my_workout_vote';
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await handleSession(data.session);

      client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        sessionWork = sessionWork
          .then(() => handleSession(session))
          .catch((sessionError) => console.error('Historikens auth-status kunde inte uppdateras', sessionError));
      });
    } catch (error) {
      console.error('Min oktober kunde inte startas', error);
      ui.loading.innerHTML = '<p class="loading">Min oktober kunde inte startas.</p>';
    }
  }

  init();
})();
