const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.resolve(__dirname, '../../data/places_cache.json');
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 gün
const UA = 'HepsiDuziciApp/1.0 (duzici-city-guide; no-api-key)';

function readCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(data) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function cacheKey(query, lat, lng) {
  return `${(query || '').trim()}|${lat ?? ''}|${lng ?? ''}`.toLowerCase();
}

function osmHeaders() {
  return { 'User-Agent': UA, Accept: 'application/json' };
}

async function nominatimSearch(query) {
  const q = encodeURIComponent(`${query} Düziçi Osmaniye Türkiye`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, { headers: osmHeaders() });
  if (!res.ok) return null;
  const list = await res.json();
  const hit = list?.[0];
  if (!hit) return null;
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    name: hit.display_name?.split(',')[0] || query,
    address: hit.display_name || '',
  };
}

async function overpassAmenities(lat, lng) {
  const radius = 700;
  const q = `
[out:json][timeout:20];
(
  node["amenity"="parking"](around:${radius},${lat},${lng});
  way["amenity"="parking"](around:${radius},${lat},${lng});
  node["amenity"="toilets"](around:${radius},${lat},${lng});
  way["amenity"="toilets"](around:${radius},${lat},${lng});
  node["toilets"="yes"](around:350,${lat},${lng});
  node["tourism"](around:350,${lat},${lng});
  way["tourism"](around:350,${lat},${lng});
);
out body;
`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) return { parking: [], toilets: [], tourism: [] };
  const data = await res.json();
  const elements = data.elements || [];
  const parking = [];
  const toilets = [];
  const tourism = [];
  for (const el of elements) {
    const tags = el.tags || {};
    if (tags.amenity === 'parking') parking.push(tags);
    if (tags.amenity === 'toilets' || tags.toilets === 'yes') toilets.push(tags);
    if (tags.tourism) tourism.push(tags);
  }
  return { parking, toilets, tourism };
}

function inferFacilities({ parking, toilets, tourism }) {
  let parkingStatus = 'bilinmiyor';
  let restroomStatus = 'bilinmiyor';
  let entryFee = 'bilinmiyor';
  let entryFeeNote = null;

  if (parking.length > 0) {
    const paid = parking.some((t) => t.fee === 'yes' || t.charge);
    parkingStatus = paid ? 'ucretli' : 'var';
  } else if (tourism.length > 0) {
    parkingStatus = 'sinirli';
  } else {
    parkingStatus = 'yok';
  }

  if (toilets.length > 0) {
    restroomStatus = 'var';
  } else if (tourism.some((t) => t.toilets === 'yes')) {
    restroomStatus = 'var';
  } else {
    restroomStatus = 'yok';
  }

  const feeTags = tourism.filter((t) => t.fee === 'yes' || t.charge || t['charge:adult']);
  const freeTags = tourism.filter((t) => t.fee === 'no');
  if (feeTags.length > 0) {
    entryFee = 'ucretli';
    const charge = feeTags[0]['charge:adult'] || feeTags[0].charge;
    if (charge) entryFeeNote = `OSM kaydı: ~${charge}`;
  } else if (freeTags.length > 0 || tourism.some((t) => ['yes', 'permissive'].includes(t.access))) {
    entryFee = 'ucretsiz';
  }

  return { parking: parkingStatus, restroom: restroomStatus, entryFee, entryFeeNote };
}

function wikiTitleCandidates(name) {
  const base = name.trim();
  const candidates = [base, base.replace(/\s*\([^)]*\)\s*/g, '').trim()];
  if (base.includes('Şelale')) candidates.push(base.replace('Şelalesi', ' Şelalesi'));
  return [...new Set(candidates)];
}

async function wikipediaThumbnail(name) {
  for (const title of wikiTitleCandidates(name)) {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    for (const lang of ['tr', 'en']) {
      try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
        const res = await fetch(url, { headers: osmHeaders() });
        if (!res.ok) continue;
        const data = await res.json();
        const src = data.thumbnail?.source || data.originalimage?.source;
        if (src) return src;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

async function wikimediaThumbnail(name) {
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${name} Düziçi`,
      gsrlimit: '3',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '900',
      format: 'json',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: osmHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      const url = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url;
      if (url) return url;
    }
  } catch {
    /* skip */
  }
  return null;
}

async function resolvePhotoUrl(name) {
  return (await wikipediaThumbnail(name)) || (await wikimediaThumbnail(name)) || null;
}

async function resolvePlace({ query, lat, lng }) {
  let resolvedLat = lat != null ? Number(lat) : null;
  let resolvedLng = lng != null ? Number(lng) : null;
  let displayName = query;
  let address = '';

  if ((resolvedLat == null || Number.isNaN(resolvedLat)) && query) {
    const geo = await nominatimSearch(query);
    if (geo) {
      resolvedLat = geo.lat;
      resolvedLng = geo.lng;
      displayName = geo.name;
      address = geo.address;
    }
  }

  if (resolvedLat == null || resolvedLng == null) {
    return null;
  }

  const amenities = await overpassAmenities(resolvedLat, resolvedLng);
  const facilities = inferFacilities(amenities);
  const photoSourceUrl = await resolvePhotoUrl(query);

  const osmUrl = `https://www.openstreetmap.org/#map=17/${resolvedLat}/${resolvedLng}`;

  return {
    query,
    name: displayName,
    address,
    lat: resolvedLat,
    lng: resolvedLng,
    osmUrl,
    photoSourceUrl,
    parking: facilities.parking,
    restroom: facilities.restroom,
    entryFee: facilities.entryFee,
    entryFeeNote: facilities.entryFeeNote,
    source: 'openstreetmap+wikipedia',
    cachedAt: Date.now(),
  };
}

async function getCachedOrSearch({ query, lat, lng }) {
  if (!query && (lat == null || lng == null)) return null;

  const ck = cacheKey(query || 'coords', lat, lng);
  const cache = readCache();
  if (cache[ck] && Date.now() - cache[ck].cachedAt < CACHE_TTL_MS) {
    return cache[ck];
  }

  const resolved = await resolvePlace({
    query: query || 'Düziçi',
    lat,
    lng,
  });

  if (resolved) {
    cache[ck] = resolved;
    writeCache(cache);
  }
  return resolved;
}

async function fetchPhotoBytes(photoSourceUrl) {
  if (!photoSourceUrl) {
    throw new Error('Fotoğraf URL yok');
  }
  const res = await fetch(photoSourceUrl, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Fotoğraf indirilemedi HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { buf, contentType };
}

module.exports = {
  getCachedOrSearch,
  fetchPhotoBytes,
  resolvePlace,
};
