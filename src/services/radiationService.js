const fetch = require('node-fetch');

const DUZICI_LAT = 37.2405;
const DUZICI_LNG = 36.4552;
const CACHE_TTL_MS = 15 * 60 * 1000;

let cache = { items: [], fetchedAt: 0 };

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

function toNanoSvPerHour(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const u = String(unit || '').toLowerCase();
  if (u.includes('nsv')) return n;
  if (u.includes('usv') || u.includes('µsv') || u.includes('μsv')) return n * 1000;
  if (u.includes('msv')) return n * 1e6;
  if (u.includes('cpm')) return n * (1000 / 350);
  return n;
}

function levelFromNsv(nsv) {
  if (nsv == null) return 'unknown';
  if (nsv < 120) return 'normal';
  if (nsv < 250) return 'elevated';
  if (nsv < 500) return 'high';
  return 'alert';
}

/** NDK RADİSA il/ilçe noktaları — konum kamu bilgisi; anlık değer Safecast/EURDEP’ten gelir. */
const NETWORK_STATIONS = [
  { id: 'radisa-duzici', name: 'Düziçi', lat: 37.2405, lng: 36.4552 },
  { id: 'radisa-osmaniye', name: 'Osmaniye', lat: 37.0742, lng: 36.2478 },
  { id: 'radisa-adana', name: 'Adana', lat: 37.0, lng: 35.3213 },
  { id: 'radisa-kahramanmaras', name: 'Kahramanmaraş', lat: 37.5858, lng: 36.9371 },
  { id: 'radisa-gaziantep', name: 'Gaziantep', lat: 37.0662, lng: 37.3833 },
  { id: 'radisa-hatay', name: 'Hatay', lat: 36.2028, lng: 36.1606 },
  { id: 'radisa-mersin', name: 'Mersin', lat: 36.8121, lng: 34.6415 },
  { id: 'radisa-kayseri', name: 'Kayseri', lat: 38.7312, lng: 35.4787 },
];

async function fetchSafecast() {
  const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    latitude: String(DUZICI_LAT),
    longitude: String(DUZICI_LNG),
    distance: '450000',
    captured_after: since,
    limit: '80',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const res = await fetch(
    `https://api.safecast.org/measurements.json?${params.toString()}`,
    {
      signal: controller.signal,
      headers: { 'User-Agent': 'HepsiDuzici/1.0' },
    },
  );
  clearTimeout(timer);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < 35.5 || lat > 39.5 || lng < 32.5 || lng > 39.5) return null;
      const nsv = toNanoSvPerHour(row.value, row.unit);
      if (nsv == null) return null;
      const distanceKm = calculateDistanceKm(DUZICI_LAT, DUZICI_LNG, lat, lng);
      return {
        id: `safecast-${row.id}`,
        name: row.location_name || `Ölçüm #${row.id}`,
        latitude: lat,
        longitude: lng,
        nsvPerHour: Math.round(nsv),
        unit: 'nSv/h',
        capturedAt: row.captured_at || null,
        source: 'Safecast',
        distanceKm,
        level: levelFromNsv(nsv),
        network: false,
      };
    })
    .filter(Boolean);
}

function mergeNetwork(liveItems) {
  return NETWORK_STATIONS.map((st) => {
    const nearby = liveItems
      .filter((i) => calculateDistanceKm(st.lat, st.lng, i.latitude, i.longitude) <= 35)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    const nsv = nearby?.nsvPerHour ?? null;
    return {
      id: st.id,
      name: `${st.name} RADİSA`,
      latitude: st.lat,
      longitude: st.lng,
      nsvPerHour: nsv,
      unit: 'nSv/h',
      capturedAt: nearby?.capturedAt || null,
      source: nearby ? nearby.source : 'NDK RADİSA ağı',
      distanceKm: calculateDistanceKm(DUZICI_LAT, DUZICI_LNG, st.lat, st.lng),
      level: levelFromNsv(nsv),
      network: true,
    };
  });
}

async function getRadiationMap({ forceRefresh = false } = {}) {
  if (!forceRefresh && cache.items.length && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { items: cache.items, fetchedAt: new Date(cache.fetchedAt).toISOString(), cached: true };
  }

  let live = [];
  try {
    live = await fetchSafecast();
  } catch (err) {
    console.warn('[radiation] Safecast:', err.message);
  }

  const network = mergeNetwork(live);
  const extraLive = live.filter(
    (item) =>
      !network.some((n) => calculateDistanceKm(n.latitude, n.longitude, item.latitude, item.longitude) <= 12),
  );
  const items = [...network, ...extraLive].sort((a, b) => a.distanceKm - b.distanceKm);
  cache = { items, fetchedAt: Date.now() };
  return { items, fetchedAt: new Date(cache.fetchedAt).toISOString(), cached: false };
}

module.exports = { getRadiationMap };
