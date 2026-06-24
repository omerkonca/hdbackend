const { fetchPage, getTagValue, stripHtml, normalizeText, slugify } = require('../utils/helpers');
const { isRelevantToDuziciCorridor, resolveLocationFromText } = require('./duziciAreaFilter');
const { hasClosureIntent } = require('./roadClosureFilters');

const FEEDS = [
  'https://osmaniye-bld.gov.tr/kategori/duyurular/feed',
  'https://osmaniye-bld.gov.tr/kategori/haberler/feed',
];

const ROAD_PATTERN =
  /yol|asfalt|trafik|bulvar|cadde|kavşak|kavsak|çalışma|calisma|yenilen|kapal|güzergah|guzergah|otogar|kaldırım|kaldirim/i;

function isRoadRelated(title, summary = '') {
  const text = `${title} ${summary}`;
  if (!ROAD_PATTERN.test(text)) return false;
  if (!hasClosureIntent(text) && !/asfalt|yenilen|yatırım|yatirim|hizmete aç/i.test(text)) {
    return false;
  }
  return isRelevantToDuziciCorridor(text) || /osmaniye/i.test(text);
}

function inferSeverity(title, summary) {
  const t = `${title} ${summary}`.toLowerCase();
  if (/tamamland|açıld|acildi|hizmete aç|hizmete alınd/i.test(t)) return 'maintenance';
  if (/kapalı|kapali|trafik komisyon/i.test(t)) return 'full';
  return 'partial';
}

function inferStatus(title, summary) {
  const t = `${title} ${summary}`.toLowerCase();
  if (/tamamland|açıld|acildi|hizmete aç|hizmete alınd/i.test(t)) return 'Tamamlandı';
  return 'Devam Ediyor';
}

function rssItemToClosure(itemBlock) {
  const title = normalizeText(getTagValue(itemBlock, 'title'));
  const link = getTagValue(itemBlock, 'link');
  const description = stripHtml(
    getTagValue(itemBlock, 'description') || getTagValue(itemBlock, 'content:encoded'),
  ).slice(0, 600);

  if (!title || title.length < 10) return null;
  if (!isRoadRelated(title, description)) return null;

  const loc = resolveLocationFromText(title, description);
  const fp = `osmaniye_bel_${slugify(link || title)}`;
  const severity = inferSeverity(title, description);
  const status = inferStatus(title, description);

  return {
    id: fp,
    fingerprint: fp,
    title: title.length > 72 ? `${title.slice(0, 69)}...` : title,
    subtitle: description
      ? description.length > 140
        ? `${description.slice(0, 137)}...`
        : description
      : 'Osmaniye Belediyesi resmî duyurusu',
    status,
    reason: 'Osmaniye Belediyesi yol / altyapı duyurusu',
    roadCode: loc.label,
    address: `${loc.label}, Osmaniye`,
    lat: loc.lat,
    lng: loc.lng,
    alternativeRoute: 'Duyurudaki güzergâh bilgisini kontrol edin.',
    severity,
    startAt: null,
    endAt: null,
    source: 'OSMANİYE BELEDİYESİ',
    announcementUrl: link || 'https://osmaniye-bld.gov.tr/kategori/duyurular',
    kind: 'municipality',
    autoManaged: true,
  };
}

class OsmaniyeMunicipalityScraper {
  async fetchRoadRelatedAnnouncements({ max = 15 } = {}) {
    const collected = [];
    const seen = new Set();

    for (const feedUrl of FEEDS) {
      try {
        const res = await fetchPage(feedUrl, {
          headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' },
        });
        const xml = await res.text();
        const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
        for (const block of items) {
          const closure = rssItemToClosure(block);
          if (!closure || seen.has(closure.fingerprint)) continue;
          seen.add(closure.fingerprint);
          collected.push(closure);
          if (collected.length >= max) return collected;
        }
      } catch (err) {
        console.warn('[osmaniye-bel]', feedUrl, err.message);
      }
    }

    console.log(`[osmaniye-bel] ${collected.length} yol duyurusu`);
    return collected;
  }
}

module.exports = new OsmaniyeMunicipalityScraper();
