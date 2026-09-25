const fs = require('fs/promises');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '../../data/earthquake_push_log.json');
const MAX_ALERTS = 500;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün sakla

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

let memoryCache = null;

async function loadLog() {
  if (memoryCache) return memoryCache;
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    memoryCache = Array.isArray(parsed?.alerts) ? parsed.alerts : [];
    return memoryCache;
  } catch (_) {
    memoryCache = [];
    return memoryCache;
  }
}

async function saveLog(alerts) {
  const now = Date.now();
  // 7 günden eski kayıtları temizle, en fazla MAX_ALERTS tut
  const filtered = alerts
    .filter((item) => now - (item.alertedAt || item.timestamp || 0) < RETENTION_MS)
    .slice(-MAX_ALERTS);

  memoryCache = filtered;

  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.writeFile(
      LOG_PATH,
      JSON.stringify(
        {
          alerts: filtered,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error('[earthquakePushLog] Dosya yazma hatası:', err.message);
  }
}

/**
 * Bu deprem için daha önce (orijinal, revize veya farklı kurum adıyla) bildirim gönderildi mi?
 */
async function wasEarthquakeAlerted(quake) {
  if (!quake) return false;
  const alerts = await loadLog();
  const quakeTs = Number(quake.timestamp || 0);
  const quakeLat = Number(quake.latitude || 0);
  const quakeLng = Number(quake.longitude || 0);
  const quakeId = String(quake.id || quake.earthquake_id || '');

  for (const prev of alerts) {
    // 1. Doğrudan aynı ID
    if (quakeId && prev.id && String(prev.id) === quakeId) {
      return true;
    }

    // 2. Uzamsal-Zamansal Eşleşme (Revize veya AFAD/Kandilli çiftleşmesi):
    // Zaman farkı <= 6 dakika VE Merkez üssü mesafesi <= 40 km ise AYNI DEPREMDİR!
    const prevTs = Number(prev.timestamp || 0);
    const timeDiffMin = Math.abs(quakeTs - prevTs) / (60 * 1000);

    if (timeDiffMin <= 6) {
      const prevLat = Number(prev.latitude || 0);
      const prevLng = Number(prev.longitude || 0);
      if (prevLat && prevLng && quakeLat && quakeLng) {
        const dist = calculateDistanceKm(quakeLat, quakeLng, prevLat, prevLng);
        if (dist <= 40) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Bildirim atılan depremi diske ve belleğe kaydet.
 */
async function markEarthquakeAlerted(quake) {
  if (!quake) return;
  const alerts = await loadLog();
  const entry = {
    id: String(quake.id || quake.earthquake_id || ''),
    title: quake.title || quake.location || '',
    location: quake.location || '',
    magnitude: Number(quake.magnitude || 0),
    depth: Number(quake.depth || 0),
    latitude: Number(quake.latitude || 0),
    longitude: Number(quake.longitude || 0),
    timestamp: Number(quake.timestamp || Date.now()),
    date: quake.date || new Date().toISOString(),
    provider: quake.provider || '',
    alertedAt: Date.now(),
  };

  alerts.push(entry);
  await saveLog(alerts);
}

module.exports = {
  wasEarthquakeAlerted,
  markEarthquakeAlerted,
  calculateDistanceKm,
};
