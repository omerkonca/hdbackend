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

const OUTAGE_EXCLUDE = [
  /trafik\s*komisyon/i,
  /emlak\s*gelir/i,
  /istimlak/i,
  /e-?belediye/i,
  /belediye\s*başkan/i,
];

const OUTAGE_HINTS = [
  /su\s*kesint/i,
  /elektrik\s*kesint/i,
  /enerji\s*kesint/i,
  /planl[ıi]\s*kesint/i,
  /plans[ıi]z\s*kesint/i,
  /içme\s*su.*kesint/i,
  /icme\s*su.*kesint/i,
  /su\s*verilem/i,
  /şebeke\s*(yenileme|bakım|calisma)/i,
  /sebeke\s*(yenileme|bakim|calisma)/i,
  /trafo\s*bak/i,
  /elektrik\s*şebek/i,
  /elektrik\s*sebek/i,
  /enerji\s*dağıtım/i,
  /enerji\s*dagitim/i,
  /vana\s*çalış/i,
  /vana\s*calis/i,
  /boru\s*hatt/i,
  /scada.*kesint/i,
];

function isOutageRelated(title, summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  if (OUTAGE_EXCLUDE.some((r) => r.test(text))) return false;
  return OUTAGE_HINTS.some((r) => r.test(text));
}

function inferOutageType(title, summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  if (/elektrik|enerji|trafo|şebeke|sebeke/.test(text)) return 'ELEKTRİK';
  if (/su\s*kesint|içme\s*su|icme\s*su|vana|boru|scada/.test(text)) return 'SU';
  return 'DİĞER';
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

function isAnnouncementPath(url) {
  if (!url) return false;
  return /\/(duyurular|haberler)\/[^/]+$/i.test(url.replace(/\/$/, ''));
}

function extractListItems(html) {
  const items = [];
  const seen = new Set();

  // Kart: <a href=".../haberler/slug"> içinde <h3 class="title"> veya img alt
  const cardRegex =
    /<a[^>]+href="([^"]+(?:duyurular|haberler)\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const url = toAbsoluteUrl(match[1]);
    if (!url || !isAnnouncementPath(url) || seen.has(url)) continue;
    const block = match[2];
    const title =
      stripHtml(block.match(/<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '') ||
      stripHtml(block.match(/\balt="([^"]{12,220})"/i)?.[1] || '');
    if (!title || title.length < 12) continue;
    if (/başkan|belediye başkan|fotoğraf|video|e-belediye/i.test(title)) continue;
    seen.add(url);
    items.push({ title: normalizeText(title), url });
  }

  const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const inner = stripHtml(match[2]);
    if (!inner || inner.length < 12 || inner.length > 220) continue;
    if (/başkan|belediye başkan|fotoğraf|video|e-belediye|başkanın mesaj/i.test(inner)) continue;
    const url = toAbsoluteUrl(href);
    if (!url || seen.has(url)) continue;
    if (!url.includes('duzici.bel.tr')) continue;
    if (!isAnnouncementPath(url) && !inner.toLowerCase().includes('trafik komisyon')) continue;
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

function parseEndDate(title, summary = '') {
  const text = `${title} ${summary}`;
  if (/trafik komisyon|sayılı karar/i.test(text) && !/bitiş|sona er|kapanış tarih/i.test(text)) {
    return null;
  }
  const endMatch = text.match(
    /(?:bitiş|sona er|kapanış)\s*(?:tarihi?)?\s*[:\-]?\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i,
  );
  if (endMatch) {
    const [, d, mo, y] = endMatch;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
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
  const endAt = parseEndDate(item.title, summary);

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

function announcementToOutage(item, summary) {
  const status = inferStatus(item.title, summary);
  const title =
    item.title.length > 88 ? `${item.title.slice(0, 85)}...` : item.title;
  const subtitle = summary
    ? summary.length > 200
      ? `${summary.slice(0, 197)}...`
      : summary
    : 'Düziçi Belediyesi resmî duyurusu — detay için bağlantıyı açın.';

  return {
    title,
    subtitle,
    type: inferOutageType(item.title, summary),
    status,
    date: new Date().toISOString(),
    source: 'Düziçi Belediyesi',
    url: item.url || DUYURULAR_URL,
  };
}

class MunicipalityAnnouncementScraper {
  async fetchOutageAnnouncements({ max = 25 } = {}) {
    const collected = [];
    const seen = new Set();
    const pages = [DUYURULAR_URL, HABERLER_URL];

    for (const pageUrl of pages) {
      try {
        const html = await fetchHtml(pageUrl);
        const items = extractListItems(html);
        for (const item of items) {
          let summary = item.summary || '';
          if (!isOutageRelated(item.title, summary)) continue;

          if (!summary && item.url) {
            summary = await fetchDetailSummary(item.url);
            if (!isOutageRelated(item.title, summary)) continue;
          }

          const fp = fingerprintFor(item);
          if (seen.has(fp)) continue;
          seen.add(fp);

          collected.push(announcementToOutage(item, summary));
          if (collected.length >= max) return collected;
        }
      } catch (err) {
        console.warn('[belediye-kesinti]', pageUrl, err.message);
      }
    }

    return collected;
  }

  async fetchRoadRelatedAnnouncements({ max = 20 } = {}) {
    const collected = [];
    const seenFp = new Set();
    const pages = [DUYURULAR_URL, HABERLER_URL];

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
