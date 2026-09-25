const fetch = require('node-fetch');

// Düziçi Merkez Koordinatları
const DUZICI_LAT = 37.2405;
const DUZICI_LNG = 36.4552;

// In-Memory Önbellek & Oylar
let cachedEarthquakes = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 20 * 1000; // 20 saniye önbellek
const feltVotes = new Map(); // earthquake_id -> { total: number, feltCounts: { soft: number, strong: number } }

/**
 * Haversine Kuş Uçuşu Mesafe Hesaplayıcı (km)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Dünya yarıçapı (km)
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
 * 1. AFAD Resmi Doğrudan API (Hızlı otomatik ilk çözümler: 30-90 sn içinde yayınlanır)
 */
async function fetchFromAfadDirect(limit = 60) {
  try {
    const end = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const start = new Date(Date.now() - 48 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&orderby=timedesc&limit=${limit}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timer);

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item) => {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);
      const mag = parseFloat(item.magnitude);
      const depth = parseFloat(item.depth);
      const dist = calculateDistanceKm(DUZICI_LAT, DUZICI_LNG, lat, lng);
      const rawDate = String(item.date || '').replace('T', ' ');
      const ts = new Date(`${item.date}+03:00`).getTime() || Date.now();
      const voteInfo = feltVotes.get(`afad-${item.eventID}`) || { total: 0, soft: 0, strong: 0 };

      return {
        id: `afad-${item.eventID}`,
        title: item.location || 'AFAD Deprem',
        location: item.location || '',
        date: rawDate,
        timestamp: ts,
        magnitude: mag,
        depth: depth,
        latitude: lat,
        longitude: lng,
        distanceKm: dist,
        estimatedIntensity: getEstimatedIntensityText(mag, dist),
        isNearDuzici: dist <= 150,
        provider: 'AFAD',
        isUpdate: item.isEventUpdate === true,
        feltVotes: voteInfo,
      };
    });
  } catch (err) {
    console.warn('[earthquakeService] AFAD Direct API fetch failed:', err.message);
    return [];
  }
}

/**
 * 2. Kandilli Live API (Akademik hassas çözümler)
 */
async function fetchFromKandilliLive(limit = 60) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.orhanaydogdu.com.tr/deprem/kandilli/live?limit=${limit}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'HepsiDuziciApp/1.0' },
      },
    );
    clearTimeout(timer);

    const data = await res.json();
    if (!data || data.status !== true || !Array.isArray(data.result)) return [];

    return data.result.map((item) => {
      const lat = parseFloat(item.geojson?.coordinates[1] ?? item.lat);
      const lng = parseFloat(item.geojson?.coordinates[0] ?? item.lng);
      const mag = parseFloat(item.mag);
      const depth = parseFloat(item.depth);
      const dist = calculateDistanceKm(DUZICI_LAT, DUZICI_LNG, lat, lng);

      let ts = 0;
      if (item.created_at) {
        ts = item.created_at < 10000000000 ? item.created_at * 1000 : item.created_at;
      } else if (item.timestamp) {
        ts = item.timestamp < 10000000000 ? item.timestamp * 1000 : item.timestamp;
      } else if (item.date_time) {
        const iso = item.date_time.trim().replace(' ', 'T') + '+03:00';
        ts = new Date(iso).getTime();
      } else if (item.date) {
        ts = new Date(item.date).getTime();
      }
      if (!ts || isNaN(ts)) ts = Date.now();

      const formattedDate = item.date_time || item.date || new Date(ts).toISOString();
      const rawId = item.earthquake_id || item._id || `${lat}_${lng}_${ts}`;
      const voteInfo = feltVotes.get(rawId) || { total: 0, soft: 0, strong: 0 };

      return {
        id: `kan-${rawId}`,
        title: item.title || item.location || 'Bilinmeyen Konum',
        location: item.title || item.location || '',
        date: formattedDate,
        timestamp: ts,
        magnitude: mag,
        depth: depth,
        latitude: lat,
        longitude: lng,
        distanceKm: dist,
        estimatedIntensity: getEstimatedIntensityText(mag, dist),
        isNearDuzici: dist <= 150,
        provider: 'Kandilli',
        isUpdate: item.rev != null,
        feltVotes: voteInfo,
      };
    });
  } catch (err) {
    console.warn('[earthquakeService] Kandilli API fetch failed:', err.message);
    return [];
  }
}

/**
 * 3. EMSC Live Fallback (Akdeniz & Türkiye hızlı sismik tetikleyiciler)
 */
async function fetchFromEmscLive() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=30&minlat=35&maxlat=43&minlon=25&maxlon=45',
      { signal: controller.signal },
    );
    clearTimeout(timer);

    const data = await res.json();
    if (!data || !Array.isArray(data.features)) return [];

    return data.features.map((f) => {
      const p = f.properties;
      const coords = f.geometry?.coordinates || [0, 0, 0];
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);
      const depth = parseFloat(coords[2] || p.depth || 10);
      const mag = parseFloat(p.mag || 0);
      const dist = calculateDistanceKm(DUZICI_LAT, DUZICI_LNG, lat, lng);
      const ts = new Date(p.time).getTime() || Date.now();
      const loc = p.flynn_region || 'Akdeniz / Türkiye';

      return {
        id: `emsc-${f.id || p.unid || `${lat}_${lng}_${ts}`}`,
        title: loc,
        location: loc,
        date: new Date(ts).toISOString().replace('T', ' ').slice(0, 19),
        timestamp: ts,
        magnitude: mag,
        depth: depth,
        latitude: lat,
        longitude: lng,
        distanceKm: dist,
        estimatedIntensity: getEstimatedIntensityText(mag, dist),
        isNearDuzici: dist <= 150,
        provider: 'EMSC',
        isUpdate: false,
        feltVotes: { total: 0, soft: 0, strong: 0 },
      };
    });
  } catch (_) {
    return [];
  }
}

/**
 * Canlı Deprem Verilerini AFAD + Kandilli (ve EMSC) Servislerinden Çeker ve Tekilleştirir.
 * AFAD sayesinde ilk 30-90 saniye içinde deprem anında algılanır.
 */
async function fetchEarthquakes(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedEarthquakes.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedEarthquakes;
  }

  // AFAD ve Kandilli'yi paralel olarak çek (en hızlı yanıt veren anında listeye girer)
  const results = await Promise.allSettled([
    fetchFromAfadDirect(60),
    fetchFromKandilliLive(60),
  ]);

  let allItems = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allItems.push(...r.value);
    }
  }

  // İki kurum da başarısız olursa EMSC fallback
  if (allItems.length === 0) {
    allItems = await fetchFromEmscLive();
  }

  if (allItems.length === 0) {
    return cachedEarthquakes;
  }

  // Tarihe göre yeniden eskiye sırala
  allItems.sort((a, b) => b.timestamp - a.timestamp);

  // Uzamsal-Zamansal Tekilleştirme (AFAD ve Kandilli aynı depremi verince birleştir)
  const merged = [];
  for (const item of allItems) {
    const existing = merged.find((m) => {
      const timeDiffMin = Math.abs(m.timestamp - item.timestamp) / (60 * 1000);
      if (timeDiffMin <= 4) {
        const dist = calculateDistanceKm(m.latitude, m.longitude, item.latitude, item.longitude);
        if (dist <= 35) return true;
      }
      return false;
    });

    if (!existing) {
      merged.push({ ...item });
    } else {
      // Çift kurum kaydı: sağlayıcı adını birleştir
      if (!existing.provider.includes(item.provider)) {
        existing.provider = `${existing.provider} / ${item.provider}`;
      }
      // Daha yüksek veya revize büyüklük varsa güncelle
      if (item.magnitude > existing.magnitude) {
        existing.magnitude = item.magnitude;
      }
      // Konum adı daha açıklayıcı olanı koru
      if (item.location && item.location.length > existing.location.length) {
        existing.location = item.location;
        existing.title = item.title;
      }
    }
  }

  merged.sort((a, b) => b.timestamp - a.timestamp);
  cachedEarthquakes = merged;
  lastFetchTime = now;

  return cachedEarthquakes;
}

/**
 * Düziçi Çevresindeki Deprem İstatistiklerini Hesaplar
 */
async function getEarthquakeStats() {
  const earthquakes = await fetchEarthquakes();
  const nearEarthquakes = earthquakes.filter((q) => q.distanceKm <= 150);
  const now = Date.now();
  const last24h = nearEarthquakes.filter((q) => now - q.timestamp <= 24 * 3600 * 1000);
  const maxMag24h = last24h.reduce((max, q) => (q.magnitude > max ? q.magnitude : max), 0);

  return {
    totalLast24h: last24h.length,
    nearDuziciCount: nearEarthquakes.length,
    maxMagnitude24h: maxMag24h,
    closestQuake: nearEarthquakes.length > 0 ? nearEarthquakes[0] : earthquakes[0] || null,
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
