module.exports = function handler(_request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return response.status(500).json({ error: 'Supabase configuration is missing' });
  }

  response.setHeader('Cache-Control', 'no-store');
  // Local-only: use the same database-backed roulette as production.
  const localServerMode = process.env.SOBER_ROULETTE_MODE === 'server'
    && /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):54321\/?$/.test(supabaseUrl);
  return response.status(200).json({ supabaseUrl, supabasePublishableKey, votingEnabled: true, ...(localServerMode ? { rouletteMode: 'server', ...(process.env.SOBER_VOTING_PREVIEW === '1' ? { votingPreview: true } : {}) } : {}) });
};
