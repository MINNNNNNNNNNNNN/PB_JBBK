module.exports = function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'SUPABASE_CONFIG_MISSING' });
  }

  res.setHeader?.('Cache-Control', 'no-store');
  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
};
