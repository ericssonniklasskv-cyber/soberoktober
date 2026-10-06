(function () {
  'use strict';

  let sharedClient;
  let clientPromise;
  let resolveMainClient;
  let rejectMainClient;
  const mainClient = document.getElementById('activity-preview-list')
    ? new Promise((resolve, reject) => { resolveMainClient = resolve; rejectMainClient = reject; }) : null;

  function useClient(client) {
    if (sharedClient) return;
    sharedClient = client;
    client.auth.onAuthStateChange((_event, session) => {
      // Never await database calls inside Supabase's auth callback.
      setTimeout(() => document.dispatchEvent(new CustomEvent('soberoktober:activity-auth', { detail: { userId: session?.user.id || null } })), 0);
    });
    resolveMainClient?.(client);
  }

  async function makeClient() {
    if (!window.supabase || !window.ActivityLogic) throw new Error('Aktivitetsflödet kunde inte starta.');
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Aktivitetsflödet är tillfälligt otillgängligt.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('Aktivitetsflödet är tillfälligt otillgängligt.');
    const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    useClient(client);
    return client;
  }

  function createClient() {
    // On the home page reuse its existing auth client, with no second auth flow.
    return mainClient || (clientPromise ||= makeClient());
  }

  async function loadFeed(client, limit, offset) {
    const { data: authData, error: authError } = await client.auth.getSession();
    if (authError) throw authError;
    const signedIn = !!authData.session;
    let response = await client.rpc(signedIn ? 'get_kudos_activity_feed' : 'get_activity_feed', { p_limit: limit, p_offset: offset });
    // A code preview can safely run before the additive migration is deployed.
    if (signedIn && ['PGRST202', '42883'].includes(response.error?.code)) {
      response = await client.rpc('get_activity_feed', { p_limit: limit, p_offset: offset });
    }
    return response;
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
    window.SoberKudos?.attachButton(li, item);
    return li;
  }

  window.SoberActivity = { createClient, createFeedItem, loadFeed, useClient,
    failClient: () => rejectMainClient?.(new Error('Aktivitetsflödet kunde inte starta.')) };
})();
