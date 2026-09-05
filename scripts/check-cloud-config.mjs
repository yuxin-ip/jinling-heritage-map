// Run before publishing: only public Supabase configuration belongs in a bundle.
const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if (url || key) {
  if (!url || !key)
    throw new Error('Both Supabase public configuration values are required.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
    throw new Error('Use the HTTPS Supabase Project URL.');
  let publicKey = key.startsWith('sb_publishable_');
  if (!publicKey && key.split('.').length === 3) {
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
          .role === 'anon';
    } catch {}
  }
  if (!publicKey)
    throw new Error(
      'Use a publishable or anon key. Never publish a secret/service-role key.',
    );
}
