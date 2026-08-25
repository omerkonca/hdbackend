const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

async function upsertDeviceToken({
  token,
  platform,
  appVersion,
  marketingOptIn,
  isPlus,
  mahalle,
  sokak,
  lat,
  lng,
}) {
  const db = requireSupabaseAdmin();
  const updateData = {
    token,
    platform,
    app_version: appVersion ?? null,
    marketing_opt_in: marketingOptIn ?? true,
    updated_at: new Date().toISOString(),
  };

  if (isPlus !== undefined) updateData.is_plus = isPlus === true || isPlus === 'true';
  if (mahalle !== undefined) updateData.mahalle = mahalle ? String(mahalle).trim() : null;
  if (sokak !== undefined) updateData.sokak = sokak ? String(sokak).trim() : null;
  if (lat !== undefined && lat !== null && !isNaN(Number(lat))) updateData.lat = Number(lat);
  if (lng !== undefined && lng !== null && !isNaN(Number(lng))) updateData.lng = Number(lng);

  const { error } = await db.from('device_tokens').upsert(
    updateData,
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

async function fetchPlusDeviceTokens() {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from('device_tokens')
    .select('token, is_plus, mahalle, sokak, lat, lng, platform')
    .eq('is_plus', true);

  if (error) {
    console.error('[Push] fetch plus tokens:', error.message);
    return [];
  }
  return data ?? [];
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

module.exports = {
  upsertDeviceToken,
  fetchMarketingTokens,
  fetchPlusDeviceTokens,
  logPush,
};
