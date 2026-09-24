// Supabase client used by the backend API.
// Keep the service-role key on the server only. Never expose it in index.html.
const { createClient } = require('@supabase/supabase-js');

// .trim() + strip quotes: protects against spaces/quotes pasted into Render env vars.
const clean = (v) => String(v || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
const supabaseUrl = clean(process.env.SUPABASE_URL);
const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

module.exports = supabase;
