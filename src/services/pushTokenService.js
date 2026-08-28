const { getDbPool } = require('../utils/dbPool');
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
  const pool = getDbPool();
  if (pool) {
    try {
      const sql = `
        INSERT INTO device_tokens (
          token, platform, app_version, marketing_opt_in, is_plus,
          mahalle, sokak, lat, lng, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (token) DO UPDATE SET
          platform = EXCLUDED.platform,
          app_version = COALESCE(EXCLUDED.app_version, device_tokens.app_version),
          marketing_opt_in = EXCLUDED.marketing_opt_in,
          is_plus = COALESCE(EXCLUDED.is_plus, device_tokens.is_plus),
          mahalle = COALESCE(EXCLUDED.mahalle, device_tokens.mahalle),
          sokak = COALESCE(EXCLUDED.sokak, device_tokens.sokak),
          lat = COALESCE(EXCLUDED.lat, device_tokens.lat),
          lng = COALESCE(EXCLUDED.lng, device_tokens.lng),
          updated_at = NOW()
      `;
      await pool.query(sql, [
        token,
        platform,
        appVersion || null,
        marketingOptIn !== false,
        isPlus === true || isPlus === 'true',
        mahalle ? String(mahalle).trim() : null,
        sokak ? String(sokak).trim() : null,
        lat !== undefined && lat !== null && !isNaN(Number(lat)) ? Number(lat) : null,
        lng !== undefined && lng !== null && !isNaN(Number(lng)) ? Number(lng) : null,
      ]);
      return { ok: true };
    } catch (e) {
      console.error('[PushTokenService] upsert direct PG error:', e.message);
    }
  }

  // Fallback to Supabase admin
  try {
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
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function fetchMarketingTokens() {
  const pool = getDbPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT token FROM device_tokens WHERE marketing_opt_in = true');
      return res.rows.map(r => r.token).filter(Boolean);
    } catch (e) {
      console.error('[PushTokenService] fetchMarketingTokens direct PG error:', e.message);
    }
  }

  try {
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
  } catch (_) {
    return [];
  }
}

async function fetchPlusDeviceTokens() {
  const pool = getDbPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT token, is_plus, mahalle, sokak, lat, lng, platform FROM device_tokens WHERE is_plus = true');
      return res.rows;
    } catch (e) {
      console.error('[PushTokenService] fetchPlusDeviceTokens direct PG error:', e.message);
    }
  }

  try {
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
  } catch (_) {
    return [];
  }
}

async function logPush({ title, body, target, sent, failed }) {
  const pool = getDbPool();
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS push_logs (
          id SERIAL PRIMARY KEY,
          title TEXT,
          body TEXT,
          target TEXT,
          sent_count INT,
          failed_count INT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(
        'INSERT INTO push_logs (title, body, target, sent_count, failed_count) VALUES ($1, $2, $3, $4, $5)',
        [title, body, target, sent || 0, failed || 0],
      );
      return;
    } catch (e) {
      console.error('[PushTokenService] logPush error:', e.message);
    }
  }

  try {
    const db = requireSupabaseAdmin();
    await db.from('push_logs').insert({
      title,
      body,
      target,
      sent_count: sent,
      failed_count: failed,
    });
  } catch (_) {}
}

module.exports = {
  upsertDeviceToken,
  fetchMarketingTokens,
  fetchPlusDeviceTokens,
  logPush,
};
