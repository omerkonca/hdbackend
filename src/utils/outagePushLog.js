const fs = require('fs/promises');
const path = require('path');
const { getDbPool } = require('./dbPool');

const LOG_PATH = path.resolve(__dirname, '../../data/outage_push_log.json');
const MAX_IDS = 2500;

let inMemoryIds = null;

async function loadPushedIds() {
  if (inMemoryIds) return inMemoryIds;
  inMemoryIds = new Set();

  // 1. Önce yerel dosyadan oku
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.ids)) {
      for (const id of parsed.ids) {
        if (id) inMemoryIds.add(String(id).trim());
      }
    }
  } catch (_) {}

  // 2. Ardından PostgreSQL push_logs tablosundan oku (Render container sıfırlansa bile veritabanından hatırlar)
  try {
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query(
        "SELECT target FROM push_logs WHERE target LIKE 'outage:%' LIMIT 3000;"
      );
      if (res && res.rows) {
        for (const row of res.rows) {
          if (row.target) {
            inMemoryIds.add(row.target.replace(/^outage:/, '').trim());
          }
        }
      }
    }
  } catch (err) {
    console.warn('[outagePushLog] DB push_logs okuma hatası:', err.message);
  }

  return inMemoryIds;
}

async function savePushedIds(ids) {
  const trimmed = [...ids].slice(-MAX_IDS);
  inMemoryIds = new Set(trimmed);
  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.writeFile(
      LOG_PATH,
      JSON.stringify({ ids: trimmed, updatedAt: new Date().toISOString() }, null, 2),
    );
  } catch (err) {
    console.warn('[outagePushLog] Dosya yazma uyarısı:', err.message);
  }
}

async function markPushed(id) {
  if (!id) return;
  const cleanId = String(id).trim();
  const ids = await loadPushedIds();
  ids.add(cleanId);
  await savePushedIds(ids);

  // PostgreSQL'e kalıcı olarak kaydet (Ephemeral Render disk sıfırlansa dahi korunur)
  try {
    const pool = getDbPool();
    if (pool) {
      await pool.query(
        "INSERT INTO push_logs (id, title, body, target, sent_count, failed_count, created_at) VALUES (gen_random_uuid(), 'Outage Push Log', $1, $2, 1, 0, NOW()) ON CONFLICT DO NOTHING;",
        [cleanId, `outage:${cleanId}`]
      );
    }
  } catch (_) {}
}

async function wasPushed(id) {
  if (!id) return false;
  const cleanId = String(id).trim();
  const ids = await loadPushedIds();
  if (ids.has(cleanId)) return true;

  try {
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query(
        "SELECT 1 FROM push_logs WHERE target = $1 LIMIT 1;",
        [`outage:${cleanId}`]
      );
      if (res && res.rows && res.rows.length > 0) {
        ids.add(cleanId);
        return true;
      }
    }
  } catch (_) {}

  return false;
}

async function markPlusPushed(outageId, token) {
  if (!outageId || !token) return;
  const key = `plus_${String(outageId).trim()}_${String(token).slice(-16)}`;
  const ids = await loadPushedIds();
  ids.add(key);
  await savePushedIds(ids);

  try {
    const pool = getDbPool();
    if (pool) {
      await pool.query(
        "INSERT INTO push_logs (id, title, body, target, sent_count, failed_count, created_at) VALUES (gen_random_uuid(), 'Plus Outage Push Log', $1, $2, 1, 0, NOW()) ON CONFLICT DO NOTHING;",
        [key, `outage:${key}`]
      );
    }
  } catch (_) {}
}

async function wasPlusPushed(outageId, token) {
  if (!outageId || !token) return false;
  const key = `plus_${String(outageId).trim()}_${String(token).slice(-16)}`;
  const ids = await loadPushedIds();
  if (ids.has(key)) return true;

  try {
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query(
        "SELECT 1 FROM push_logs WHERE target = $1 LIMIT 1;",
        [`outage:${key}`]
      );
      if (res && res.rows && res.rows.length > 0) {
        ids.add(key);
        return true;
      }
    }
  } catch (_) {}

  return false;
}

module.exports = {
  loadPushedIds,
  markPushed,
  wasPushed,
  markPlusPushed,
  wasPlusPushed,
};
