(() => {
  function create({ ui, getUserId, getBingoState, getStepDataUnavailable, getFinalReportData, formatDate }) {
    let weeklyReports = new Map();
    const pointsFormatter = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
    const stockholmDate = window.SoberOctoberCalendar.stockholmDate;
    const finalReportSeenStorageKey = userId => `soberoktober:final-report-seen:${userId}`;
    function seenReportKeys() {
      return new Set(window.SoberOctoberReportSeen.read(getUserId()));
    }

    function markReportSeen(key) {
      return window.SoberOctoberReportSeen.mark(getUserId(), key);
    }

    function markFinalReportSeen() {
      try {
        const key = finalReportSeenStorageKey(getUserId());
        const wasNew = localStorage.getItem(key) !== 'yes';
        localStorage.setItem(key, 'yes');
        return wasNew;
      } catch (_error) {
        return false;
      }
    }

    function formatNumber(value) {
      return pointsFormatter.format(value);
    }

    function createReportCard(period, report, seen) {
      const card = document.createElement('article');
      card.className = `weekly-report-card${report ? ' is-available' : ' is-locked'}`;

      const eyebrow = document.createElement('p');
      eyebrow.className = 'weekly-report-label';
      eyebrow.textContent = period.label;

      const title = document.createElement('h3');
      title.textContent = period.title;

      const summary = document.createElement('p');
      summary.className = 'weekly-report-summary';
      summary.textContent = report
        ? `${report.completedDays} av ${period.days} dagar · ${formatNumber(report.totalPoints)} poäng totalt`
        : (period.start > stockholmDate() ? 'Låst tills perioden är avslutad' : 'Pågår fortfarande');

      const action = document.createElement(report ? 'button' : 'span');
      action.className = report ? 'weekly-report-action' : 'weekly-report-lock';
      if (report) {
        action.type = 'button';
        action.dataset.periodKey = period.key;
        action.textContent = seen.has(period.key) ? 'Öppna rapport →' : 'Ny rapport · öppna →';
        action.addEventListener('click', () => openWeeklyReport(period.key));
        action.setAttribute('aria-label', `${seen.has(period.key) ? 'Öppna' : 'Ny'} rapport: ${period.title}, ${period.label}`);
      } else {
        action.textContent = 'Kommer snart';
        action.setAttribute('aria-label', `Rapporten för ${period.title} är låst`);
      }

      if (report && !seen.has(period.key)) {
        const badge = document.createElement('span');
        badge.className = 'weekly-report-new';
        badge.textContent = 'Ny';
        card.append(eyebrow, title, badge, summary, action);
      } else {
        card.append(eyebrow, title, summary, action);
      }
      return card;
    }

    function renderWeeklyReports(results, challenges, stepResults, bonusClaims, today) {
      const seen = seenReportKeys();
      weeklyReports = new Map();
      const cards = window.SoberOctoberHistory.REPORT_PERIODS.map((period) => {
        const report = window.SoberOctoberHistory.buildPeriodReport({
          results,
          challenges,
          stepResults,
          bonusClaims,
          bingo: getBingoState(),
          periodKey: period.key,
          today,
          stepsLogic: window.SoberOctoberSteps,
        });
        if (report) weeklyReports.set(period.key, report);
        return createReportCard(period, report, seen);
      });
      ui.weeklyReportList.replaceChildren(...cards);
    }

    function renderFinalReportAccess(today, results, stepResults, competitionStatus) {
      const unlocked = Boolean(getFinalReportData());
      ui.finalReportCard.classList.toggle('is-available', unlocked);
      ui.finalReportCard.classList.toggle('is-locked', !unlocked);
      ui.finalReportAction.hidden = !unlocked;
      if (unlocked) {
        ui.finalReportSummary.textContent = 'Hela oktober samlad i en sista tillbakablick.';
        return;
      }
      if (today < '2026-10-31') {
        ui.finalReportSummary.textContent = competitionStatus?.status === 'eliminated'
          ? 'Öppnar den 31 oktober när sista stegperioden är rapporterad.'
          : 'Öppnar den 31 oktober när dagens pass och sista stegperioden är rapporterade.';
        return;
      }
      const eliminated = competitionStatus?.status === 'eliminated';
      const hasFinalPass = results.some((row) => row.result_date === '2026-10-31');
      const hasFinalStepPeriod = stepResults.some((row) => row.period_key === 'oct_22_31');
      if (!eliminated && !hasFinalPass && !hasFinalStepPeriod) {
        ui.finalReportSummary.textContent = 'Registrera dagens pass och rapportera stegsnittet för 22–31 oktober för att låsa upp rapporten.';
      } else if (!eliminated && !hasFinalPass) {
        ui.finalReportSummary.textContent = 'Registrera dagens pass för att låsa upp rapporten.';
      } else if (!hasFinalStepPeriod) {
        ui.finalReportSummary.textContent = 'Rapportera stegsnittet för 22–31 oktober för att låsa upp rapporten.';
      } else {
        ui.finalReportSummary.textContent = 'Rapporten låses upp när dagens tävlingsstatus har synkroniserats.';
      }
    }

    function addReportConfetti() {
      addReportConfettiTo(ui.reportConfetti);
    }

    function addReportConfettiTo(container) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const colors = ['#ef8537', '#204b3b', '#e9b674', '#a8bd9b'];
      container.replaceChildren();
      for (let index = 0; index < 28; index += 1) {
        const piece = document.createElement('i');
        piece.style.setProperty('--confetti-x', `${Math.random() * 100}%`);
        piece.style.setProperty('--confetti-color', colors[index % colors.length]);
        piece.style.setProperty('--confetti-delay', `${Math.random() * 220}ms`);
        piece.className = 'report-confetti-piece';
        container.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove(), { once: true });
      }
    }

    function openWeeklyReport(periodKey) {
      const report = weeklyReports.get(periodKey);
      if (!report) return;
      const wasNew = markReportSeen(periodKey);
      ui.reportPeriod.textContent = report.label;
      ui.reportTitle.textContent = `${report.title} är klar!`;
      ui.reportPep.textContent = report.completedDays === report.days
        ? 'Hela perioden avklarad. Du kan vara riktigt nöjd med den insatsen.'
        : report.completedDays > 0
          ? `Du var med ${report.completedDays} av ${report.days} dagar. Varje pass du gjorde räknas.`
          : 'En period i backspegeln. Nästa chans väntar när du är redo.';

      const stats = [
        ['Genomförda dagar', `${report.completedDays} av ${report.days}`],
        ['Missade dagar', String(report.missedDays)],
        ['Träningspoäng', `${formatNumber(report.trainingPoints)} p`],
        ['Bonuspoäng', `${formatNumber(report.bonusPoints)} p`],
        ['Totalt', `${formatNumber(report.totalPoints)} p`],
        ['3×-dagar', String(report.multiplierCounts[3])],
        ['Bästa streak', `${report.bestStreak} ${report.bestStreak === 1 ? 'dag' : 'dagar'}`],
      ];
      ui.reportStats.replaceChildren(...stats.map(([label, value]) => {
        const item = document.createElement('div');
        item.className = 'report-stat';
        const name = document.createElement('span');
        name.textContent = label;
        const amount = document.createElement('strong');
        amount.textContent = value;
        item.append(name, amount);
        return item;
      }));

      const exercises = report.exerciseTotals.map((total) => {
        const item = document.createElement('li');
        const amount = document.createElement('strong');
        amount.textContent = `${formatNumber(total.amount)} ${total.unit}`;
        item.appendChild(amount);
        return item;
      });
      ui.reportExercises.replaceChildren(...exercises);
      ui.reportExerciseSection.hidden = exercises.length === 0;

      if (getStepDataUnavailable()) {
        ui.reportSteps.textContent = 'Stegdata kunde inte hämtas just nu.';
        ui.reportSteps.classList.add('is-unreported');
      } else if (report.stepAverage === null) {
        ui.reportSteps.textContent = 'Steg för perioden är inte rapporterade ännu.';
        ui.reportSteps.classList.add('is-unreported');
      } else {
        ui.reportSteps.textContent = `${formatNumber(report.stepAverage)} steg/dag i snitt · ${report.stepPoints}/${window.SoberOctoberSteps.MAX_POINTS} möjliga stegpoäng om du håller samma snitt.`;
        ui.reportSteps.classList.remove('is-unreported');
      }

      renderBingoReport(document.querySelector('#weekly-bingo-report'), report.bingo);
      ui.reportDetail.showModal();
      if (wasNew) addReportConfetti();
      renderWeeklyReportsFromCache();
    }

    function renderWeeklyReportsFromCache() {
      const seen = seenReportKeys();
      ui.weeklyReportList.querySelectorAll('.weekly-report-action').forEach((action) => {
        const key = action.dataset.periodKey;
        if (!seen.has(key)) return;
        action.closest('.weekly-report-card')?.querySelector('.weekly-report-new')?.remove();
        action.textContent = 'Öppna rapport →';
        action.setAttribute('aria-label', `Öppna rapport: ${action.closest('.weekly-report-card')?.querySelector('h3')?.textContent}`);
      });
    }

    function createReportStats(stats) {
      return stats.map(([label, value]) => {
        const item = document.createElement('div');
        item.className = 'report-stat';
        const name = document.createElement('span');
        name.textContent = label;
        const amount = document.createElement('strong');
        amount.textContent = value;
        item.append(name, amount);
        return item;
      });
    }

    function openFinalReport() {
      if (!getFinalReportData()) return;
      const report = getFinalReportData();
      const eliminated = report.competition.status === 'eliminated';
      ui.finalReportPeriod.textContent = eliminated ? 'DIN TÄVLING TOG SLUT HÄR' : 'HELA OKTOBER · 1–31 OKTOBER';
      ui.finalReportTitle.textContent = 'Din Sober Oktober 2026';
      ui.finalReportPep.textContent = report.completedDays === 31
        ? '31 dagar. En hel månad där du dök upp för dig själv. Starkt gjort.'
        : report.completedDays > 0
          ? `${report.completedDays} genomförda dagar. Varje pass blev en del av din oktober.`
          : 'Oktober är i backspegeln. Här är allt som finns kvar från din utmaning.';
      ui.finalReportStatus.className = `final-report-status${eliminated ? ' is-eliminated' : report.competition.status === 'active' ? ' is-active' : ' is-unknown'}`;
      ui.finalReportStatus.textContent = eliminated
        ? `UTSLAGEN${report.competition.eliminationReason ? ` · ${report.competition.eliminationReason}` : ''}${report.competition.eliminationDate ? ` · ${formatDate(report.competition.eliminationDate)}` : ''}`
        : report.competition.status === 'active'
          ? 'AKTIV · Du höll dig kvar i tävlingen hela oktober'
          : 'Tävlingsstatusen kunde inte hämtas just nu.';

      renderBingoReport(document.querySelector('#final-bingo-report'), report.bingo);
      const trainingPlace = report.trainingPlacement === null ? 'Ej tillgänglig' : `${report.trainingPlacement}:e plats`;
      ui.finalReportStats.replaceChildren(...createReportStats([
        ['Total träningspoäng', `${formatNumber(report.totalTrainingPoints)} p`],
        ['Bonuspoäng', `${formatNumber(report.bonusPoints)} p`],
        ['Totalt', `${formatNumber(report.totalPoints)} p`],
        ['Genomförda dagar', `${report.completedDays} av ${report.completedDays + report.missedDays}`],
        ['Missade dagar', String(report.missedDays)],
        ['Längsta streak', `${report.longestStreak} ${report.longestStreak === 1 ? 'dag' : 'dagar'}`],
        ['Träningsplacering', trainingPlace],
      ]));
      ui.finalReportMultiplier.textContent = report.mostUsedMultiplier === null ? '–' : `${report.mostUsedMultiplier}×`;
      ui.finalReportThrees.textContent = String(report.multiplierCounts[3]);

      const exercises = report.exerciseTotals.map((total) => {
        const item = document.createElement('li');
        const amount = document.createElement('strong');
        amount.textContent = `${formatNumber(total.amount)} ${total.unit}`;
        item.appendChild(amount);
        return item;
      });
      ui.finalReportExercises.replaceChildren(...exercises);
      ui.finalReportExerciseSection.hidden = exercises.length === 0;

      if (getStepDataUnavailable()) {
        ui.finalReportSteps.textContent = 'Stegresultaten kunde inte hämtas just nu.';
        ui.finalReportSteps.classList.add('is-unreported');
      } else if (report.stepAverage === null) {
        ui.finalReportSteps.textContent = 'Inga stegperioder rapporterades.';
        ui.finalReportSteps.classList.add('is-unreported');
      } else {
        ui.finalReportSteps.textContent = `${formatNumber(report.stepAverage)} steg per dag i viktat snitt`;
        ui.finalReportSteps.classList.remove('is-unreported');
      }
      const stepPlace = report.stepPlacement !== null
        ? `${report.stepPlacement}:e plats`
        : report.stepPlacementAmbiguous ? 'Kan inte särskiljas' : 'Ej tillgänglig';
      ui.finalReportStepStats.replaceChildren(...createReportStats([
        ['Rapporterade perioder', `${report.stepReportedPeriods}/4`],
        ['Slutliga stegpoäng', report.stepPoints === null ? '–' : `${report.stepPoints}/${window.SoberOctoberSteps.MAX_POINTS}`],
        ['Stegplacering', stepPlace],
      ]));

      ui.finalReportDetail.showModal();
      if (markFinalReportSeen()) addReportConfettiTo(ui.finalReportConfetti);
    }

    function renderBingoReport(section, report) {
      section.hidden = !report || report.completedDays === 0;
      section.replaceChildren();
      if (section.hidden) return;
      const title = document.createElement('h3'); title.textContent = 'Träningsbingo';
      const summary = document.createElement('p'); summary.textContent = `${report.completedCells} rutor · ${report.completedDays} aktiva dagar · ${formatNumber(report.points)} bingopoäng`;
      const list = document.createElement('ul');
      list.replaceChildren(...report.exerciseTotals.map(total => { const row = document.createElement('li'); row.textContent = `${formatNumber(total.amount)} ${total.unit}`; return row; }));
      section.append(title, summary, list);
    }

    ui.reportDetailClose.addEventListener('click', () => ui.reportDetail.close());
    ui.reportDetail.addEventListener('click', (event) => {
      if (event.target === ui.reportDetail) ui.reportDetail.close();
    });
    ui.finalReportAction.addEventListener('click', openFinalReport);
    ui.finalReportClose.addEventListener('click', () => ui.finalReportDetail.close());
    ui.finalReportDetail.addEventListener('click', (event) => {
      if (event.target === ui.finalReportDetail) ui.finalReportDetail.close();
    });

    return Object.freeze({ renderWeeklyReports, renderFinalReportAccess, openWeeklyReport,
      hasWeeklyReport: key => weeklyReports.has(key) });
  }
  window.SoberOctoberReportsUI = Object.freeze({ create });
})();
