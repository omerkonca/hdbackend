const { fetchWithTimeout, normalizeText, slugify } = require('../utils/helpers');

const BASE = 'https://online.toroslaredas.com.tr';
const OUTAGE_PAGE = `${BASE}/elektrik-kesintisi-sorgulama`;
const OSMANIYE_PLATE = 80;

const FETCH_OPTIONS = {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
    accept: 'application/json, text/plain, */*',
    'accept-language': 'tr-TR,tr;q=0.9',
    origin: BASE,
    referer: OUTAGE_PAGE,
  },
};

const DUZICI_KEYS = ['duzici', 'düziçi', 'yarbasi', 'yarbaşı', 'atalan', 'ellek', 'duldul', 'düldül'];

function isDuziciRelated(text) {
  const t = normalizeText(text).toLowerCase();
  return DUZICI_KEYS.some((k) => t.includes(k)) || /osmaniye/.test(t);
}

function parseDateTime(text) {
  if (!text) return null;
  const s = String(text).trim();

  // Format 1: 24.08.2026 09:00 veya 24/08/2026 09:00
  const dateMatch = s.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
  if (dateMatch) {
    const [, d, mo, y] = dateMatch;
    const timeMatch = s.match(/\b(\d{1,2}:\d{2})\b/);
    const time = timeMatch ? timeMatch[1].padStart(5, '0') : '00:00';
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${time}:00+03:00`;
  }

  // Format 2: 2026-08-24T09:00:00 veya 2026-08-24 09:00
  const isoMatch = s.match(/^(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, y, mo, d, h, m] = isoMatch;
    return `${y}-${mo}-${d}T${h}:${m}:00+03:00`;
  }

  const t = Date.parse(s);
  if (!isNaN(t)) {
    return new Date(t).toISOString();
  }
  return null;
}

function inferStatus(text) {
  const t = text.toLowerCase();
  if (/tamamland|sona erdi|giderildi|açıld|acildi/.test(t)) return 'Tamamlandı';
  if (/planl/.test(t)) return 'Planlandı';
  return 'Devam Ediyor';
}

function mapApiRow(row) {
  const district = row.districtName || row.ilceAdi || row.countyName || row.ilce || '';
  const neighborhood = row.neighborhoodName || row.mahalleAdi || row.mahalle || '';
  const streets = row.streetName || row.sokakAdi || row.sokak || '';
  const reason = row.reason || row.cause || row.description || row.aciklama || 'Planlı bakım';
  const start = row.startDate || row.baslangicTarihi || row.startTime || '';
  const end = row.endDate || row.bitisTarihi || row.endTime || '';
  const area = [district, neighborhood, streets].filter(Boolean).join(' · ');
  const titleParts = [neighborhood || district, 'elektrik kesintisi'].filter(Boolean);
  const title = normalizeText(titleParts.join(' — ')) || 'Elektrik kesintisi';
  const subtitle = normalizeText(
    `${reason}${start ? ` · Başlangıç: ${start}` : ''}${end ? ` · Bitiş: ${end}` : ''}`,
  );
  const full = `${title} ${subtitle} ${area}`;
  if (!isDuziciRelated(full) && district && !/duzici|düziçi/i.test(district)) {
    return null;
  }

  const publishedAt = parseDateTime(`${start} ${end}`) || new Date().toISOString();
  const status = inferStatus(full);
  const id = `toroslar_${slugify(`${district}_${neighborhood}_${start}_${end}`)}`;

  return {
    id,
    title: title.length > 88 ? `${title.slice(0, 85)}...` : title,
    subtitle: subtitle.length > 220 ? `${subtitle.slice(0, 217)}...` : subtitle,
    type: 'ELEKTRİK',
    status,
    source: 'Toroslar EDAŞ',
    sourceKind: 'toroslar',
    url: OUTAGE_PAGE,
    area: area || 'Düziçi',
    lat: 37.244,
    lng: 36.451,
    date: publishedAt,
    publishedAt,
    startAt: parseDateTime(String(start)) || null,
    endAt: parseDateTime(String(end)) || null,
    isActive: status !== 'Tamamlandı',
  };
}

function normalizeApiPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.result)) return payload.result;
  if (Array.isArray(payload.outages)) return payload.outages;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

async function postJson(path, body) {
  const res = await fetchWithTimeout(
    `${BASE}${path}`,
    {
      method: 'POST',
      ...FETCH_OPTIONS,
      headers: {
        ...FETCH_OPTIONS.headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    25000,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function tryApiEndpoints() {
  const attempts = [
    ['/api/Outage/GetOutageList', { cityId: OSMANIYE_PLATE, outageType: 1 }],
    ['/api/outage/getoutagelist', { cityId: OSMANIYE_PLATE, outageType: 1 }],
    ['/Outage/GetPlannedOutages', { cityId: OSMANIYE_PLATE }],
    ['/api/v1/outage/planned', { cityCode: OSMANIYE_PLATE, districtName: 'Düziçi' }],
    ['/api/Outage/GetOutageByAddress', { cityId: OSMANIYE_PLATE, districtName: 'DÜZİÇİ' }],
  ];

  for (const [path, body] of attempts) {
    try {
      const json = await postJson(path, body);
      const rows = normalizeApiPayload(json)
        .map(mapApiRow)
        .filter(Boolean);
      if (rows.length > 0) {
        console.info(`[toroslar-kesinti] ${rows.length} kayıt (${path})`);
        return rows;
      }
    } catch (err) {
      console.warn('[toroslar-kesinti]', path, err.message);
    }
  }
  return [];
}

function parseJinaMarkdown(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const outages = [];
  for (const line of lines) {
    if (!/kesint|arıza|bakım|elektrik/i.test(line)) continue;
    if (!isDuziciRelated(line) && !/osmaniye/i.test(line)) continue;
    const status = inferStatus(line);
    const publishedAt = parseDateTime(line) || new Date().toISOString();
    const title = line.length > 90 ? `${line.slice(0, 87)}...` : line;
    outages.push({
      id: `toroslar_${slugify(title)}`,
      title,
      subtitle: 'Toroslar EDAŞ planlı kesinti kaydı',
      type: 'ELEKTRİK',
      status,
      source: 'Toroslar EDAŞ',
      sourceKind: 'toroslar',
      url: OUTAGE_PAGE,
      area: 'Düziçi',
      lat: 37.244,
      lng: 36.451,
      date: publishedAt,
      publishedAt,
      startAt: null,
      endAt: null,
      isActive: status !== 'Tamamlandı',
    });
  }
  return outages;
}

async function tryJinaFallback() {
  const jinaUrl = `https://r.jina.ai/${OUTAGE_PAGE}`;
  const res = await fetchWithTimeout(
    jinaUrl,
    {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'Mozilla/5.0 (compatible; HepsiDuziciBot/1.0)',
      },
    },
    30000,
  );
  if (!res.ok) throw new Error(`Jina ${res.status}`);
  const text = await res.text();
  return parseJinaMarkdown(text);
}

async function tryTedasApi() {
  const tedasAttempts = [
    'https://kesintisorgulama.tedas.gov.tr/api/v1/outages?city=80',
    'https://kesintisorgulama.tedas.gov.tr/api/outage/list?il=80',
    'https://online.toroslaredas.com.tr/api/Outage/GetOutagesByCity?cityId=80',
    'https://online.toroslaredas.com.tr/api/Outage/GetPlannedOutagesByDistrict?cityId=80&districtName=D%C3%9CZ%C4%B0%C3%87%C4%B0',
  ];

  for (const url of tedasAttempts) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json, text/plain, */*',
        },
      }, 15000);
      if (!res.ok) continue;
      const json = await res.json();
      const rows = normalizeApiPayload(json).map(mapApiRow).filter(Boolean);
      if (rows.length > 0) {
        console.info(`[tedas-kesinti] ${rows.length} kayıt (${url})`);
        return rows;
      }
    } catch (e) {
      // Continue next attempt
    }
  }
  return [];
}

class ToroslarOutageScraper {
  async fetchDuziciOutages() {
    try {
      const apiRows = await tryApiEndpoints();
      if (apiRows.length > 0) return apiRows;
    } catch (err) {
      console.warn('[toroslar-kesinti] API başarısız:', err.message);
    }

    try {
      const tedasRows = await tryTedasApi();
      if (tedasRows.length > 0) return tedasRows;
    } catch (err) {
      console.warn('[toroslar-kesinti] TEDAŞ API başarısız:', err.message);
    }

    try {
      const jinaRows = await tryJinaFallback();
      if (jinaRows.length > 0) {
        console.info(`[toroslar-kesinti] ${jinaRows.length} kayıt (Jina)`);
        return jinaRows;
      }
    } catch (err) {
      console.warn('[toroslar-kesinti] Jina başarısız:', err.message);
    }

    return [];
  }
}

module.exports = new ToroslarOutageScraper();
