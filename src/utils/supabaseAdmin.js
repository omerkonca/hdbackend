const { createClient } = require('@supabase/supabase-js');

let adminClient;

function requireSupabaseAdmin() {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY tanımlı değil');
  }
  adminClient = createClient(url, key, { auth: { persistSession: false } });
  return adminClient;
}

async function fetchMarketingTokens() {
  const sb = requireSupabaseAdmin();
  const { data, error } = await sb
    .from('device_tokens')
    .select('token')
    .eq('marketing_opt_in', true);

  if (error) {
    console.error('[supabase] device_tokens:', error.message);
    return [];
  }
  return (data || []).map((row) => row.token).filter(Boolean);
}

async function logPush({ title, body, target, sent, failed }) {
  const sb = requireSupabaseAdmin();
  await sb.from('push_logs').insert({
    title,
    body,
    target,
    sent_count: sent,
    failed_count: failed,
  });
}

module.exports = {
  requireSupabaseAdmin,
  fetchMarketingTokens,
  logPush,
};
