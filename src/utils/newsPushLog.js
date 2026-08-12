const fs = require('fs/promises');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '../../data/news_push_log.json');
const MAX_IDS = 500;
const MAX_TITLE_KEYS = 500;

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

async function markPushed(id, titleKey = '') {
  const log = await loadLog();
  if (id) log.ids.add(String(id));
  const key = String(titleKey || '').trim();
  if (key) log.titleKeys.add(key);
  await saveLog(log.ids, log.titleKeys);
}

async function wasPushed(id, titleKey = '') {
  const log = await loadLog();
  if (id && log.ids.has(String(id))) return true;
  const key = String(titleKey || '').trim();
  if (key && log.titleKeys.has(key)) return true;
  return false;
}

/** Geriye uyum */
async function loadPushedIds() {
  const log = await loadLog();
  return log.ids;
}

module.exports = { loadPushedIds, markPushed, wasPushed };
