const fs = require('fs/promises');
const path = require('path');
const { getDbPool } = require('./dbPool');
const { areNewsTitlesDuplicate } = require('./helpers');

const LOG_PATH = path.resolve(__dirname, '../../data/news_push_log.json');
const MAX_IDS = 500;
const MAX_TITLE_KEYS = 500;

let tableEnsured = false;

async function ensureTable(pool) {
  if (tableEnsured || !pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.news_push_logs (
      news_id TEXT PRIMARY KEY,
      title_key TEXT,
      title TEXT,
      topic TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_news_push_logs_title_key ON public.news_push_logs (title_key);
    CREATE INDEX IF NOT EXISTS idx_news_push_logs_created_at ON public.news_push_logs (created_at DESC);
    ALTER TABLE public.news_push_logs ENABLE ROW LEVEL SECURITY;
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE public.news_push_logs FROM anon;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE public.news_push_logs FROM authenticated;
      END IF;
    END $$;
  `);
  tableEnsured = true;
}

async function loadLog() {
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ids: new Set(Array.isArray(parsed?.ids) ? parsed.ids : []),
      titleKeys: new Set(Array.isArray(parsed?.titleKeys) ? parsed.titleKeys : []),
    };
  } catch (_) {
    return { ids: new Set(), titleKeys: new Set() };
  }
}

async function saveLog(ids, titleKeys) {
  const trimmedIds = [...ids].slice(-MAX_IDS);
  const trimmedKeys = [...titleKeys].slice(-MAX_TITLE_KEYS);
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.writeFile(
    LOG_PATH,
    JSON.stringify(
      {
        ids: trimmedIds,
        titleKeys: trimmedKeys,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

async function markPushedFile(id, titleKey = '') {
  const log = await loadLog();
  if (id) log.ids.add(String(id));
  const key = String(titleKey || '').trim();
  if (key) log.titleKeys.add(key);
  await saveLog(log.ids, log.titleKeys);
}

async function markPushed(id, titleKey = '', title = '', topic = '') {
  const newsId = String(id || '').trim();
  const key = String(titleKey || '').trim();
  const rawTitle = String(title || '').trim();

  const pool = getDbPool();
  if (pool && (newsId || key)) {
    try {
      await ensureTable(pool);
      await pool.query(
        `INSERT INTO public.news_push_logs (news_id, title_key, title, topic)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (news_id) DO NOTHING`,
        [newsId || `key:${key}`, key, rawTitle, String(topic || '')],
      );
    } catch (err) {
      console.warn('[newsPushLog] DB markPushed warning:', err.message);
    }
  }

  await markPushedFile(newsId, key).catch(() => {});
}

async function wasPushed(id, titleKey = '', title = '', createdAt = null) {
  const newsId = String(id || '').trim();
  const key = String(titleKey || '').trim();
  const rawTitle = String(title || '').trim();

  const pool = getDbPool();
  if (pool) {
    try {
      await ensureTable(pool);
      const res = await pool.query(
        `SELECT news_id, title_key, title, created_at
         FROM public.news_push_logs
         WHERE news_id = $1
            OR ($2 <> '' AND title_key = $2)
            OR created_at >= NOW() - INTERVAL '72 hours'
         ORDER BY created_at DESC
         LIMIT 200`,
        [newsId, key],
      );
      for (const row of res.rows) {
        if (newsId && row.news_id === newsId) return true;
        if (key && row.title_key && row.title_key === key) return true;
        if (
          rawTitle &&
          row.title &&
          areNewsTitlesDuplicate(row.title, rawTitle, {
            createdAtA: row.created_at,
            createdAtB: createdAt || Date.now(),
          })
        ) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('[newsPushLog] DB wasPushed warning:', err.message);
    }
  }

  const log = await loadLog();
  if (newsId && log.ids.has(newsId)) return true;
  if (key && log.titleKeys.has(key)) return true;
  return false;
}

/**
 * Atomik push kilidi alır: aynı haber (id, normalize başlık veya son 72 saatteki benzer başlık)
 * daha önce gönderildiyse false döner. Eşzamanlı çalışan istekler/sunucular arasında
 * aynı habere 2 kez bildirim gitmesini engeller.
 */
async function claimPush({ id, titleKey = '', title = '', topic = '', createdAt = null }) {
  const newsId = String(id || '').trim();
  const key = String(titleKey || '').trim();
  const rawTitle = String(title || '').trim();

  const pool = getDbPool();
  if (pool) {
    try {
      await ensureTable(pool);

      const recentRes = await pool.query(
        `SELECT news_id, title_key, title, created_at
         FROM public.news_push_logs
         WHERE news_id = $1
            OR ($2 <> '' AND title_key = $2)
            OR created_at >= NOW() - INTERVAL '72 hours'
         ORDER BY created_at DESC
         LIMIT 200`,
        [newsId, key],
      );

      for (const row of recentRes.rows) {
        if (newsId && row.news_id === newsId) return false;
        if (key && row.title_key && row.title_key === key) return false;
        if (
          rawTitle &&
          row.title &&
          areNewsTitlesDuplicate(row.title, rawTitle, {
            createdAtA: row.created_at,
            createdAtB: createdAt || Date.now(),
          })
        ) {
          return false;
        }
      }

      const lockId = newsId || `key:${key}`;
      const insRes = await pool.query(
        `INSERT INTO public.news_push_logs (news_id, title_key, title, topic)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM public.news_push_logs
           WHERE ($2 <> '' AND title_key = $2 AND created_at >= NOW() - INTERVAL '72 hours')
         )
         ON CONFLICT (news_id) DO NOTHING
         RETURNING news_id`,
        [lockId, key, rawTitle, String(topic || '')],
      );
      if (insRes.rowCount === 0) return false;

      await markPushedFile(newsId, key).catch(() => {});
      return true;
    } catch (err) {
      console.warn('[newsPushLog] DB claimPush fallback to file:', err.message);
    }
  }

  const log = await loadLog();
  if (newsId && log.ids.has(newsId)) return false;
  if (key && log.titleKeys.has(key)) return false;
  await markPushedFile(newsId, key);
  return true;
}

async function releasePush(id) {
  const newsId = String(id || '').trim();
  if (!newsId) return;
  const pool = getDbPool();
  if (pool) {
    try {
      await pool.query('DELETE FROM public.news_push_logs WHERE news_id = $1', [newsId]);
    } catch (_) {}
  }
}

/** Geriye uyum */
async function loadPushedIds() {
  const log = await loadLog();
  return log.ids;
}

module.exports = { loadPushedIds, markPushed, wasPushed, claimPush, releasePush };
