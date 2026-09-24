(function () {
  'use strict';

  async function createPublicClient() {
    if (!window.supabase || !window.ActivityLogic) throw new Error('Aktivitetsflödet kunde inte starta.');
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Aktivitetsflödet är tillfälligt otillgängligt.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Aktivitetsflödet är tillfälligt otillgängligt.');
    return window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'soberoktober-activity-feed' },
    });
  }

  function createFeedItem(item, compact) {
    const sentence = window.ActivityLogic.sentence(item);
    if (!sentence) return null;
    const li = document.createElement('li');
    li.className = 'activity-item';
    const message = document.createElement('span');
    message.className = 'activity-message';
    message.textContent = sentence;
    const time = document.createElement('time');
    time.className = 'activity-time';
    time.dateTime = item.event_at;
    time.textContent = compact ? window.ActivityLogic.relativeTime(item.event_at) : window.ActivityLogic.fullTimestamp(item.event_at);
    if (compact) time.title = window.ActivityLogic.fullTimestamp(item.event_at);
    li.append(message, time);
    return li;
  }

  window.SoberActivity = { createPublicClient, createFeedItem };
})();
