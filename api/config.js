module.exports = function handler(_request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return response.status(500).json({ error: 'Supabase configuration is missing' });
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ supabaseUrl, supabasePublishableKey });
};
