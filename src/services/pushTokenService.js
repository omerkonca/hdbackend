const supabase = require('../utils/supabaseClient');

async function upsertDeviceToken({ token, platform, appVersion, marketingOptIn }) {
  const { error } = await supabase.from('device_tokens').upsert(
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
  const { data, error } = await supabase
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
  await supabase.from('push_logs').insert({
    title,
    body,
    target,
    sent_count: sent,
    failed_count: failed,
  });
}

module.exports = { upsertDeviceToken, fetchMarketingTokens, logPush };
