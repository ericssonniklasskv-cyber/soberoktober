(function () {
  'use strict';
  const inboxButton = document.getElementById('kudos-inbox-button');
  if (!inboxButton || !window.SoberActivity) return;
  const badge = document.getElementById('kudos-unread-count');
  let client, userId, currentDialog, pollTimer, refreshing = false, refreshPending = false;
  let unreadCount = 0, authRevision = 0, pagePaused = false;
  const automaticVisits = new Set();
  const sent = new Set();

  const visitKey = () => `${userId}:${window.SoberOctoberCalendar.stockholmDate()}`;

  const notice = window.SoberOctoberPopups.register('kudos', {
    priority: window.SoberOctoberPopups.priorities.kudos,
    element: () => currentDialog,
    isOpen: () => Boolean(currentDialog?.open),
    canShow: () => Boolean(client && userId && unreadCount && !automaticVisits.has(visitKey()) && !currentDialog?.open),
    show: () => openInbox(true),
    suspend: () => currentDialog?.close(),
  });

  function setUser(nextId) {
    if (nextId === userId) return;
    authRevision++;
    sent.clear();
    unreadCount = 0;
    badge.textContent = '';
    currentDialog?.close();
    userId = nextId;
    inboxButton.hidden = !userId;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function dialog(title, opener) {
    currentDialog?.close();
    const box = element('dialog', 'kudos-dialog');
    const heading = element('h2', 'kudos-title', title);
    heading.id = 'kudos-dialog-title';
    box.setAttribute('aria-labelledby', heading.id);
    const close = element('button', 'kudos-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Stäng');
    close.addEventListener('click', () => box.close());
    box.append(close, heading);
    box.addEventListener('click', event => { if (event.target === box) {
      const bounds = box.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) box.close();
    } });
    box.addEventListener('close', () => {
      box.remove();
      if (currentDialog === box) currentDialog = null;
      if (opener?.isConnected) opener.focus();
    }, { once: true });
    document.body.append(box);
    currentDialog = box;
    box.showModal();
    return box;
  }

  function markSent(key) {
    sent.add(key);
    document.querySelectorAll('[data-kudos-activity]').forEach(button => {
      if (button.dataset.kudosActivity !== key) return;
      button.textContent = 'Kudos skickat 👏';
      button.disabled = true;
      button.classList.add('is-sent');
      button.setAttribute('aria-label', 'Kudos skickat');
    });
  }

  async function openSend(item, opener) {
    const owner = userId;
    if (!owner || sent.has(item.activity_key)) return;
    const box = dialog(`Peppa ${item.display_name}!`, opener);
    box.append(element('p', 'kudos-context', window.ActivityLogic.sentence(item)));
    const form = element('form', 'kudos-form');
    const label = element('label', 'kudos-label', 'En egen hälsning? (valfritt)');
    label.htmlFor = 'kudos-message';
    const input = element('textarea', 'kudos-input');
    input.id = 'kudos-message';
    input.rows = 3;
    input.maxLength = 300;
    input.placeholder = 'Snyggt jobbat!';
    const privacy = element('p', 'kudos-hint', 'Bara mottagaren ser din hälsning. Max 300 tecken.');
    const status = element('p', 'kudos-status');
    status.setAttribute('role', 'status');
    const send = element('button', 'kudos-send', 'Skicka kudos 👏');
    send.type = 'submit';
    form.append(label, input, privacy, send, status);
    box.append(form);
    let sending = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || userId !== owner) return;
      const message = input.value.trim();
      if (message.length > 300) { status.textContent = 'Högst 300 tecken, tack!'; return; }
      sending = true;
      send.disabled = true;
      input.disabled = true;
      status.textContent = 'Skickar…';
      try {
        const { data: authData, error: authError } = await client.auth.getSession();
        if (authError || authData.session?.user.id !== owner) throw Error('session');
        const { error } = await client.rpc('send_activity_kudos', { p_activity_key: item.activity_key, p_message: message || null });
        if (error) throw error;
        if (userId !== owner) return;
        markSent(item.activity_key);
        if (!box.open) return;
        input.disabled = true;
        send.textContent = 'Skickat! 👏';
        status.textContent = 'Lite pepp gör stor skillnad.';
        closeAfterSuccess(box);
      } catch (error) {
        if (box.open && userId === owner) {
          status.textContent = error.code === '22023' ? error.message : 'Kudos kunde inte skickas. Försök igen.';
          send.disabled = false;
          input.disabled = false;
          sending = false;
        }
      }
    });
    send.focus();
  }

  function closeAfterSuccess(box) {
    const timer = setTimeout(() => { if (box.open) box.close(); }, 1400);
    box.addEventListener('close', () => clearTimeout(timer), { once: true });
  }

  function attachButton(li, item) {
    if (!item.activity_key || item.is_own || !userId) return;
    const button = element('button', 'kudos-button', 'Ge kudos 👏');
    button.type = 'button';
    button.dataset.kudosActivity = item.activity_key;
    button.setAttribute('aria-label', `Ge kudos till ${item.display_name}`);
    if (item.kudos_sent || sent.has(item.activity_key)) {
      button.textContent = 'Kudos skickat 👏';
      button.disabled = true;
      button.classList.add('is-sent');
      button.setAttribute('aria-label', 'Kudos skickat');
    } else button.addEventListener('click', () => openSend(item, button));
    li.append(button);
  }

  async function refreshInbox() {
    if (!client || document.hidden || pagePaused) return;
    if (refreshing) { refreshPending = true; return; }
    refreshing = true;
    try {
      const revision = authRevision;
      const { data: authData, error: authError } = await client.auth.getSession();
      if (revision !== authRevision) return;
      if (authError) throw authError;
      const nextId = authData.session?.user.id || null;
      setUser(nextId);
      inboxButton.hidden = !userId;
      if (!userId) { badge.textContent = ''; return; }
      const owner = userId;
      const ownerRevision = authRevision;
      const { data, error } = await client.rpc('get_my_kudos_unread_count');
      if (owner !== userId || ownerRevision !== authRevision) return;
      if (error) {
        if (['PGRST202', '42883'].includes(error.code)) inboxButton.hidden = true;
        return;
      }
      const count = Number(data) || 0;
      unreadCount = count;
      badge.textContent = count ? String(count) : '';
      inboxButton.setAttribute('aria-label', count ? `Dina kudos, ${count} nya` : 'Dina kudos');
      notice.request();
    } catch (_) {
      // Keep the feed usable when the notification request fails.
    } finally {
      refreshing = false;
      if (refreshPending) { refreshPending = false; refreshInbox(); }
    }
  }

  async function openInbox(automatic = false) {
    if (!userId) return;
    const owner = userId;
    automaticVisits.add(visitKey());
    const box = dialog(automatic ? 'Du har fått kudos 👏' : 'Lite pepp till dig 👏', inboxButton);
    box.append(element('p', 'kudos-hint', 'Dina kudos och hälsningar är bara för dig.'));
    const list = element('ol', 'kudos-inbox-list');
    const status = element('p', 'kudos-status', 'Laddar dina kudos…');
    status.setAttribute('role', 'status');
    const more = element('button', 'kudos-more', 'Visa äldre kudos');
    more.type = 'button';
    more.hidden = true;
    box.append(list, status, more);
    let offset = 0, loading = false;
    async function load() {
      if (loading || owner !== userId || !box.open) return;
      loading = true;
      more.disabled = true;
      try {
        const { data, error } = await client.rpc('get_my_activity_kudos', { p_limit: 21, p_offset: offset });
        if (error) throw error;
        if (owner !== userId || !box.open) return;
        const records = data || [], page = records.slice(0, 20);
        if (!offset && !page.length) list.append(element('li', 'kudos-empty', 'Inga kudos ännu. Sprid lite pepp i gänget!'));
        for (const item of page) {
          const li = element('li', 'kudos-note');
          li.append(element('p', 'kudos-note-title', `${item.sender_name} gav dig kudos för ${item.activity_label}`));
          if (item.message) li.append(element('p', 'kudos-note-message', item.message));
          const time = element('time', 'kudos-note-time', window.ActivityLogic.fullTimestamp(item.created_at));
          time.dateTime = item.created_at;
          li.append(time);
          list.append(li);
        }
        offset += page.length;
        more.hidden = records.length <= 20;
        status.textContent = '';
        const unread = page.filter(item => item.is_unread).map(item => item.kudos_key);
        if (unread.length) {
          const { error: readError } = await client.rpc('mark_activity_kudos_read', { p_kudos_keys: unread });
          if (readError) status.textContent = 'Hälsningarna visas, men kunde inte markeras som lästa. Öppna inkorgen igen senare.';
          await refreshInbox();
        }
      } catch (_) {
        if (owner === userId && box.open) {
          status.textContent = 'Dina kudos kunde inte laddas. Försök igen.';
          more.hidden = false;
        }
      } finally { loading = false; more.disabled = false; }
    }
    more.addEventListener('click', load);
    load();
  }

  inboxButton.addEventListener('click', () => openInbox());
  document.addEventListener('soberoktober:activity-auth', event => {
    setUser(event.detail.userId);
    refreshInbox();
  });
  document.addEventListener('visibilitychange', () => {
    clearInterval(pollTimer);
    if (!document.hidden) { refreshInbox(); pollTimer = setInterval(refreshInbox, 30000); }
  });
  window.addEventListener('pagehide', () => {
    pagePaused = true;
    clearInterval(pollTimer);
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    pagePaused = false;
    refreshInbox();
    pollTimer = setInterval(refreshInbox, 30000);
  });
  window.SoberKudos = { attachButton };
  window.SoberActivity.createClient().then(async readyClient => {
    client = readyClient;
    await refreshInbox();
    // Inbox initialization may finish after the first feed request.
    document.dispatchEvent(new Event('soberoktober:kudos-ready'));
    pollTimer = setInterval(refreshInbox, 30000);
  }).catch(() => {});
})();
