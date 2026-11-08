const fs = require('fs/promises');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '../../data/outage_push_log.json');
const MAX_IDS = 2500;

let inMemoryIds = null;

async function loadPushedIds() {
  if (inMemoryIds) return inMemoryIds;
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    inMemoryIds = new Set(Array.isArray(parsed?.ids) ? parsed.ids : []);
  } catch (_) {
    inMemoryIds = new Set();
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
  const ids = await loadPushedIds();
  ids.add(String(id).trim());
  await savePushedIds(ids);
}

async function wasPushed(id) {
  if (!id) return false;
  const ids = await loadPushedIds();
  return ids.has(String(id).trim());
}

async function markPlusPushed(outageId, token) {
  if (!outageId || !token) return;
  const ids = await loadPushedIds();
  const key = `plus_${String(outageId).trim()}_${String(token).slice(-16)}`;
  ids.add(key);
  await savePushedIds(ids);
}

async function wasPlusPushed(outageId, token) {
  if (!outageId || !token) return false;
  const ids = await loadPushedIds();
  const key = `plus_${String(outageId).trim()}_${String(token).slice(-16)}`;
  return ids.has(key);
}

module.exports = {
  loadPushedIds,
  markPushed,
  wasPushed,
  markPlusPushed,
  wasPlusPushed,
};
