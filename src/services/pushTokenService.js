const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

async function upsertDeviceToken({ token, platform, appVersion, marketingOptIn }) {
  const db = requireSupabaseAdmin();
  const { error } = await db.from('device_tokens').upsert(
    {
      token,
      platform,
      app_version: appVersion ?? null,
      marketing_opt_in: marketingOptIn ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function fetchMarketingTokens() {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from('device_tokens')
    .select('token')
    .eq('marketing_opt_in', true);

  if (error) {
    console.error('[Push] fetch tokens:', error.message);
    return [];
  }
  return (data ?? []).map((r) => r.token).filter(Boolean);
}

async function logPush({ title, body, target, sent, failed }) {
  const db = requireSupabaseAdmin();
  await db.from('push_logs').insert({
    title,
    body,
    target,
    sent_count: sent,
    failed_count: failed,
  });
}

module.exports = { upsertDeviceToken, fetchMarketingTokens, logPush };
