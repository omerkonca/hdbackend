const fetch = require('node-fetch');

// Düziçi Merkez Koordinatları
const DUZICI_LAT = 37.2405;
const DUZICI_LNG = 36.4552;

// In-Memory Önbellek & Oylar
let cachedEarthquakes = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 saniye
const feltVotes = new Map(); // earthquake_id -> { total: number, feltCounts: { soft: number, strong: number } }

/**
 * Haversine Kuş Uçuşu Mesafe Hesaplayıcı (km)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Tahmini MMI Şiddet Derecesi (Mercalli Ölçeği Metni)
 */
function getEstimatedIntensityText(magnitude, distanceKm) {
  if (distanceKm > 300) return 'Hissedilmedi (Çok Uzak)';
  if (magnitude < 2.5) return 'Önemsiz (Sadece Hassas Cihazlar)';
  if (magnitude < 3.5 && distanceKm < 50) return 'Hafif (Binalarda Az Hissedilebilir)';
  if (magnitude < 4.5 && distanceKm < 100) return 'Orta (Ev Eşyaları Sallanabilir)';
  if (magnitude < 5.5 && distanceKm < 150) return 'Şiddetli (Genel Korku, Binalarda Titreşim)';
  if (magnitude >= 5.5 && distanceKm < 200) return 'Çok Şiddetli (Muhtemel Hasar & Yüksek Sarsıntı)';
  return 'Hafif / Hissedilebilir';
}

/**
 * Canlı Deprem Verilerini Kandilli / AFAD Servislerinden Çeker
 */
async function fetchEarthquakes(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedEarthquakes.length > 0 && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedEarthquakes;
  }

  let rawList = [];

  // 1. Birincil Kaynak: Kandilli Live API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      'https://api.orhanaydogdu.com.tr/deprem/kandilli/live?limit=100',
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'HepsiDuziciApp/1.0' },
      },
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data && data.status === true && Array.isArray(data.result)) {
      rawList = data.result.map((item) => {
        const lat = parseFloat(item.geojson?.coordinates[1] ?? item.lat);
        const lng = parseFloat(item.geojson?.coordinates[0] ?? item.lng);
        const mag = parseFloat(item.mag);
        const depth = parseFloat(item.depth);
        const distance = calculateDistanceKm(DUZICI_LAT, DUZICI_LNG, lat, lng);
        const voteInfo = feltVotes.get(item.earthquake_id || item._id) || { total: 0, soft: 0, strong: 0 };

        return {
          id: item.earthquake_id || item._id || `${lat}_${lng}_${item.date_time}`,
          title: item.title || item.location || 'Bilinmeyen Konum',
          location: item.title || item.location || '',
          date: item.date_time || item.date || new Date().toISOString(),
          timestamp: item.timestamp ? item.timestamp * 1000 : new Date(item.date_time || item.date).getTime(),
          magnitude: mag,
          depth: depth,
          latitude: lat,
          longitude: lng,
          distanceKm: distance,
          estimatedIntensity: getEstimatedIntensityText(mag, distance),
          isNearDuzici: distance <= 150,
          provider: 'Kandilli Rasathanesi',
          feltVotes: voteInfo,
        };
      });
    }
  } catch (err) {
    console.warn('[earthquakeService] Kandilli API fetch failed, trying fallback:', err.message);
  }

  // 2. Yedek Kaynak: AFAD API (Kandilli başarısız olursa)
  if (rawList.length === 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        'https://api.orhanaydogdu.com.tr/deprem/afad/live?limit=100',
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'HepsiDuziciApp/1.0' },
        },
      );
      clearTimeout(timer);
      const data = await res.json();
      if (data && data.status === true && Array.isArray(data.result)) {
        rawList = data.result.map((item) => {
          const lat = parseFloat(item.geojson?.coordinates[1] ?? item.lat);
          const lng = parseFloat(item.geojson?.coordinates[0] ?? item.lng);
          const mag = parseFloat(item.mag);
          const depth = parseFloat(item.depth);
          const distance = calculateDistanceKm(DUZICI_LAT, DUZICI_LNG, lat, lng);
          const voteInfo = feltVotes.get(item.earthquake_id || item._id) || { total: 0, soft: 0, strong: 0 };

          return {
            id: item.earthquake_id || item._id || `${lat}_${lng}_${item.date_time}`,
            title: item.title || item.location || 'Bilinmeyen Konum',
            location: item.title || item.location || '',
            date: item.date_time || item.date || new Date().toISOString(),
            timestamp: item.timestamp ? item.timestamp * 1000 : new Date(item.date_time || item.date).getTime(),
            magnitude: mag,
            depth: depth,
            latitude: lat,
            longitude: lng,
            distanceKm: distance,
            estimatedIntensity: getEstimatedIntensityText(mag, distance),
            isNearDuzici: distance <= 150,
            provider: 'AFAD',
            feltVotes: voteInfo,
          };
        });
      }
    } catch (err) {
      console.error('[earthquakeService] AFAD fallback failed:', err.message);
    }
  }

  if (rawList.length > 0) {
    cachedEarthquakes = rawList;
    lastFetchTime = now;
  }

  return cachedEarthquakes;
}

/**
 * Düziçi Çevresindeki Deprem İstatistiklerini Hesaplar
 */
async function getEarthquakeStats() {
  const earthquakes = await fetchEarthquakes();
  const nearEarthquakes = earthquakes.filter(q => q.distanceKm <= 150);
  const now = Date.now();
  const last24h = nearEarthquakes.filter(q => (now - q.timestamp) <= 24 * 3600 * 1000);
  const maxMag24h = last24h.reduce((max, q) => q.magnitude > max ? q.magnitude : max, 0);

  return {
    totalLast24h: last24h.length,
    nearDuziciCount: nearEarthquakes.length,
    maxMagnitude24h: maxMag24h,
    closestQuake: nearEarthquakes.length > 0 ? nearEarthquakes[0] : (earthquakes[0] || null),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * "Hissedildi mi?" Oylaması Ekleme
 */
function recordFeltVote(quakeId, intensityType) {
  const current = feltVotes.get(quakeId) || { total: 0, soft: 0, strong: 0 };
  current.total += 1;
  if (intensityType === 'strong') {
    current.strong += 1;
  } else {
    current.soft += 1;
  }
  feltVotes.set(quakeId, current);
  return current;
}

module.exports = {
  fetchEarthquakes,
  getEarthquakeStats,
  recordFeltVote,
  calculateDistanceKm,
};
