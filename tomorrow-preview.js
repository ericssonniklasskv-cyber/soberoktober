(() => {
  const panel = document.querySelector('#tomorrow-preview');
  const details = document.querySelector('#tomorrow-details');
  const content = document.querySelector('#tomorrow-content');
  if (!panel || !details || !content) return;
  const hero = panel.parentElement;
  const layout = document.querySelector('.challenge-layout');
  const activity = layout.querySelector('.activity-preview');
  const mobile = window.matchMedia('(max-width: 860px)');
  let client, dateToday, requestedDate, requestId = 0;

  function placePanel() {
    if (mobile.matches) layout.insertBefore(panel, activity);
    else hero.appendChild(panel);
  }
  const tomorrow = date => window.SoberOctoberCalendar.shiftDate(date, 1);
  function text(tag, value, className) {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  }
  async function load() {
    if (!client) return;
    const date = tomorrow(dateToday());
    requestedDate = date;
    const id = ++requestId;
    content.replaceChildren(text('p', 'Laddar morgondagens pass…', 'tomorrow-note'));
    if (!window.SoberOctoberCalendar.isCompetitionDay(date)) {
      content.replaceChildren(text('p', 'Inget nytt oktoberpass imorgon. Tack för den här månaden!', 'tomorrow-note'));
      return;
    }
    if (window.SoberOctoberBingo?.state()?.enabled && window.SoberOctoberCompetition.isBingoDate(date)) {
      const link = text('a', 'Kika på bingoaktiviteterna →', 'bingo-directory-link');
      link.href = '/bingobingo/';
      content.replaceChildren(text('h2', 'Träningsbingo · 5–11 oktober'), text('p', 'Imorgon fortsätter vi med bingobrickan. Första nya rutan ger 2 poäng, fler nya rutor ger 1 var. Hela rader och hela brickan ger bonus.', 'tomorrow-task'), link);
      return;
    }
    try {
      const { data, error } = await client.from('daily_challenges')
        .select('title, description, base_amount, unit, completion_mode, second_description, second_base_amount, second_unit, bonus_description, bonus_points')
        .eq('challenge_date', date).maybeSingle();
      if (id !== requestId) return;
      if (error) throw error;
      if (!data) {
        content.replaceChildren(text('p', 'Morgondagens pass kommer snart.', 'tomorrow-note'));
        return;
      }
      const dateLabel = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
      content.replaceChildren(text('p', dateLabel, 'tomorrow-date'), text('h2', data.title));
      const describe = window.SoberOctoberChallengeLogic.describePart;
      content.appendChild(text('p', describe(data, 'first'), 'tomorrow-task'));
      if (data.completion_mode === 'and' || data.completion_mode === 'or') {
        content.append(text('p', data.completion_mode === 'and' ? 'och' : 'och/eller', 'tomorrow-connector'),
          text('p', describe(data, 'second'), 'tomorrow-task'));
      }
      const bonus = document.createElement('div');
      bonus.className = 'tomorrow-bonus';
      bonus.appendChild(text('h3', 'Bonusuppgift'));
      if (data.bonus_description?.trim() && Number(data.bonus_points) > 0) {
        bonus.appendChild(text('p', data.bonus_description));
        const points = Number(data.bonus_points);
        bonus.appendChild(text('span', '+' + new Intl.NumberFormat('sv-SE').format(points) + ' bonuspoäng', 'tomorrow-bonus-points'));
      } else bonus.appendChild(text('p', 'Ingen bonusuppgift inlagd för imorgon.'));
      content.appendChild(bonus);
      content.appendChild(text('p', 'Bara en förhandstitt – registrera passet imorgon.', 'tomorrow-note'));
    } catch (_error) {
      if (id === requestId) content.replaceChildren(text('p', 'Förhandstitten kunde inte laddas. Stäng och öppna igen för att försöka på nytt.', 'tomorrow-note'));
    }
  }
  placePanel();
  mobile.addEventListener('change', placePanel);
  details.addEventListener('toggle', () => { if (details.open) void load(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && details.open && client && requestedDate !== tomorrow(dateToday())) void load();
  });
  window.SoberOctoberTomorrow = Object.freeze({
    init(existingClient, stockholmDate) {
      client = existingClient;
      dateToday = stockholmDate;
      if (details.open) void load();
    },
  });
})();
