const { normalizeText, stripHtml, slugify } = require('../utils/helpers');

const BASE = 'https://www.duzici.bel.tr';
const DUYURULAR_URL = `${BASE}/duyurular`;
const HABERLER_URL = `${BASE}/haberler`;

const { isValidRoadClosureRecord } = require('./roadClosureFilters');

const LOCATION_HINTS = [
  { keys: ['irfanlı', 'irfanli'], lat: 37.019, lng: 36.453, label: 'İrfanlı Mah.' },
  { keys: ['recep tayyip', 'rte bulvar', 'erdoğan bulvar'], lat: 37.0172, lng: 36.4565, label: 'R.T. Erdoğan Bulvarı' },
  { keys: ['hürriyet', 'hurriyet'], lat: 37.016, lng: 36.452, label: 'Hürriyet Mah.' },
  { keys: ['cumhuriyet'], lat: 37.0155, lng: 36.455, label: 'Cumhuriyet Mah.' },
  { keys: ['bostanlar'], lat: 37.025, lng: 36.44, label: 'Bostanlar Köyü' },
  { keys: ['yarbasi', 'yarbaşı'], lat: 37.0648, lng: 36.5182, label: 'Yarbaşı' },
  { keys: ['d.400', 'd400', 'berke'], lat: 37.0312, lng: 36.4386, label: 'D.400 / Berke' },
  { keys: ['düldül', 'duldul'], lat: 37.0486, lng: 36.4012, label: 'Düldül Yayla Yolu' },
  { keys: ['üzümlü', 'uzumlu'], lat: 37.0021, lng: 36.4715, label: 'Üzümlü Mah.' },
  { keys: ['asaf namlı', 'asaf namli', 'istiklal'], lat: 37.0184, lng: 36.4518, label: 'Asaf Namlı Cad.' },
  { keys: ['karasu', 'sabun çayı'], lat: 37.022, lng: 36.448, label: 'Karasu / Sabun Çayı' },
];

const FETCH_OPTIONS = {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
    'accept-language': 'tr-TR,tr;q=0.9',
  },
};

function isRoadRelated(title, summary = '') {
  return isValidRoadClosureRecord({
    title,
    subtitle: summary,
    source: 'BELEDİYE DUYURUSU',
    kind: 'municipality',
  });
}

function resolveLocation(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  for (const hint of LOCATION_HINTS) {
    if (hint.keys.some((k) => text.includes(k))) return hint;
  }
  return { lat: 37.0162, lng: 36.4542, label: 'Düziçi Merkez' };
}

function toAbsoluteUrl(href) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${BASE}${href}`;
  return `${BASE}/${href}`;
}

function fingerprintFor(item) {
  if (item.url) return `belediye_${slugify(item.url.replace(BASE, ''))}`;
  return `belediye_${slugify(item.title)}`;
}

function extractListItems(html) {
  const items = [];
  const seen = new Set();

  const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const inner = stripHtml(match[2]);
    if (!inner || inner.length < 12 || inner.length > 220) continue;
    if (/başkan|belediye başkan|fotoğraf|video|e-belediye|başkanın mesaj/i.test(inner)) continue;
    const url = toAbsoluteUrl(href);
    if (!url || seen.has(url)) continue;
    if (!url.includes('duzici.bel.tr')) continue;
    seen.add(url);
    items.push({ title: normalizeText(inner), url });
  }

  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  while ((match = h3Regex.exec(html)) !== null) {
    const title = stripHtml(match[1]);
    if (!title || title.length < 12 || seen.has(title)) continue;
    seen.add(title);
    items.push({ title, url: null });
  }

  // Duyuru listesi madde metinleri
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  while ((match = liRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (!text || text.length < 20 || text.length > 300) continue;
    if (!isRoadRelated(text)) continue;
    const title = text.length > 90 ? `${text.slice(0, 87)}...` : text;
    const key = `li:${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, url: DUYURULAR_URL, summary: text });
  }

  return items;
}

function inferSeverity(title, summary) {
  const t = `${title} ${summary}`.toLowerCase();
  if (/tamamland|açıld|acildi|sona erdi/.test(t)) return 'maintenance';
  if (/kapalı|kapali|trafik komisyon|yasak|durduruldu/.test(t)) return 'full';
  return 'partial';
}

function inferStatus(title, summary) {
  const t = `${title} ${summary}`.toLowerCase();
  if (/tamamland|açıld|acildi|hizmete hazır|sona erdi|trafiğe açıld/i.test(t)) return 'Tamamlandı';
  return 'Devam Ediyor';
}

function parseEndDate(text) {
  const m = text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

async function fetchHtml(url) {
  const res = await fetch(url, FETCH_OPTIONS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchDetailSummary(url) {
  if (!url || !url.startsWith('http')) return '';
  try {
    const html = await fetchHtml(url);
    const block =
      html.match(/<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
      html;
    return stripHtml(block).slice(0, 600);
  } catch {
    return '';
  }
}

function announcementToRoadClosure(item, summary) {
  const loc = resolveLocation(item.title, summary);
  const severity = inferSeverity(item.title, summary);
  const status = inferStatus(item.title, summary);
  const fp = fingerprintFor(item);
  const endAt = parseEndDate(`${item.title} ${summary}`);

  return {
    id: fp,
    fingerprint: fp,
    title: item.title.length > 72 ? `${item.title.slice(0, 69)}...` : item.title,
    subtitle: summary
      ? summary.length > 140
        ? `${summary.slice(0, 137)}...`
        : summary
      : 'Düziçi Belediyesi resmî duyurusu',
    status,
    reason: 'Belediye / trafik duyurusu',
    roadCode: loc.label,
    address: `${loc.label}, Düziçi, Osmaniye`,
    lat: loc.lat,
    lng: loc.lng,
    alternativeRoute: 'Duyurudaki güzergâh ve saat bilgisini kontrol edin.',
    severity,
    startAt: null,
    endAt,
    source: 'BELEDİYE DUYURUSU',
    announcementUrl: item.url || DUYURULAR_URL,
    kind: 'municipality',
    autoManaged: true,
  };
}

class MunicipalityAnnouncementScraper {
  async fetchRoadRelatedAnnouncements({ max = 20 } = {}) {
    const collected = [];
    const seenFp = new Set();
    // Yalnızca resmî duyurular (haber sayfası genel trafik başlıkları karıştırıyordu)
    const pages = [DUYURULAR_URL];

    for (const pageUrl of pages) {
      try {
        const html = await fetchHtml(pageUrl);
        const items = extractListItems(html);
        for (const item of items) {
          if (!isRoadRelated(item.title, item.summary || '')) continue;
          let summary = item.summary || '';
          if (!summary && item.url) {
            summary = await fetchDetailSummary(item.url);
          }
          const closure = announcementToRoadClosure(item, summary);
          if (seenFp.has(closure.fingerprint)) continue;
          seenFp.add(closure.fingerprint);
          collected.push(closure);
          if (collected.length >= max) return collected;
        }
      } catch (err) {
        console.warn('[belediye-duyuru]', pageUrl, err.message);
      }
    }

    return collected;
  }
}

module.exports = new MunicipalityAnnouncementScraper();
