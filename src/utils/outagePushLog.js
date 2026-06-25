const fs = require('fs/promises');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '../../data/outage_push_log.json');
const MAX_IDS = 300;

async function loadPushedIds() {
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed?.ids) ? parsed.ids : []);
  } catch (_) {
    return new Set();
  }
}

async function savePushedIds(ids) {
  const trimmed = [...ids].slice(-MAX_IDS);
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.writeFile(
    LOG_PATH,
    JSON.stringify({ ids: trimmed, updatedAt: new Date().toISOString() }, null, 2),
  );
}

async function markPushed(id) {
  const ids = await loadPushedIds();
  ids.add(id);
  await savePushedIds(ids);
}

async function wasPushed(id) {
  const ids = await loadPushedIds();
  return ids.has(id);
}

module.exports = { loadPushedIds, markPushed, wasPushed };
