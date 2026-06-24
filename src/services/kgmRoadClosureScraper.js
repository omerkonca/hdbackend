const { fetchPage, normalizeText, slugify } = require('../utils/helpers');
const { isRelevantToDuziciCorridor, resolveLocationFromText } = require('./duziciAreaFilter');

const KGM_CLOSED_URL =
  'https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/YolDanisma/TrafigeKapaliYollar.aspx';

function parseKmPair(cells, startIdx) {
  return {
    kmStart: cells[startIdx] || '',
    kmEnd: cells[startIdx + 1] || '',
  };
}

function parseDateParts(cells, startIdx) {
  const day = cells[startIdx] || '';
  const time = cells[startIdx + 1] || '';
  return { day, time };
}

function parseClosedRoadRows(html) {
  const rows = [];
  const rowRegex = /<tr class="trDatas">([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const cells = [...match[1].matchAll(/<td class="tdData"[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      normalizeText(m[1].replace(/<[^>]+>/g, ' ')),
    );
    if (cells.length < 13) continue;

    const roadName = cells[5];
    const reason = cells[6];
    const { kmStart, kmEnd } = parseKmPair(cells, 7);
    const { day, time } = parseDateParts(cells, 9);
    const updatedAt = cells[11];
    const description = cells[12] || '';

    rows.push({
      index: cells[0],
      regionNo: cells[1],
      branch: cells[2],
      kkNo: cells[3],
      winterStatus: cells[4],
      roadName,
      reason,
      kmStart,
      kmEnd,
      closedDay: day,
      closedTime: time,
      updatedAt,
      description,
    });
  }
  return rows;
}

function inferSeverity(reason, description) {
  const t = `${reason} ${description}`.toLowerCase();
  if (/tamamen|trafige kapal|trafiğe kapal|iki tarafli|iki taraflı/i.test(t)) return 'full';
  if (/şerit|serit|daralma|kısıtl|kisitl|tek şerit/i.test(t)) return 'partial';
  if (/çalışma|calisma|yapım|yapim|bakım|bakim/i.test(t)) return 'partial';
  return 'full';
}

function toIsoDate(dayStr) {
  if (!dayStr) return null;
  const m = dayStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function rowToClosure(row) {
  const fullText = `${row.roadName} ${row.branch} ${row.description} ${row.reason}`;
  if (!isRelevantToDuziciCorridor(fullText)) return null;

  const loc = resolveLocationFromText(row.roadName, `${row.branch} ${row.description}`);
  const severity = inferSeverity(row.reason, row.description);
  const title =
    row.roadName.length > 80 ? `${row.roadName.slice(0, 77)}...` : row.roadName;
  const subtitle = [
    row.branch,
    row.kkNo ? `K.K.${row.kkNo}` : null,
    row.kmStart || row.kmEnd ? `km ${row.kmStart}–${row.kmEnd}` : null,
    row.reason,
  ]
    .filter(Boolean)
    .join(' · ');

  const fp = `kgm_${slugify(`${row.kkNo}-${row.roadName}-${row.kmStart}-${row.kmEnd}`)}`;

  let alternativeRoute = row.description || 'KGM duyurusundaki alternatif güzergâha uyun.';
  if (alternativeRoute.length > 280) {
    alternativeRoute = `${alternativeRoute.slice(0, 277)}...`;
  }

  return {
    id: fp,
    fingerprint: fp,
    title,
    subtitle,
    status: 'Devam Ediyor',
    reason: row.reason || 'Karayolları bildirimi',
    roadCode: loc.label,
    address: `${loc.label}, Osmaniye / Adana koridoru`,
    lat: loc.lat,
    lng: loc.lng,
    alternativeRoute,
    severity,
    startAt: toIsoDate(row.closedDay),
    endAt: null,
    source: 'KARAYOLLARI (KGM)',
    announcementUrl: KGM_CLOSED_URL,
    kind: 'kgm',
    autoManaged: true,
    kgmMeta: {
      branch: row.branch,
      kkNo: row.kkNo,
      updatedAt: row.updatedAt,
    },
  };
}

class KgmRoadClosureScraper {
  async fetchRelevantClosures() {
    try {
      const res = await fetchPage(KGM_CLOSED_URL, {
        headers: {
          'accept-language': 'tr-TR,tr;q=0.9',
        },
      });
      const html = await res.text();
      const rows = parseClosedRoadRows(html);
      const closures = rows.map(rowToClosure).filter(Boolean);
      console.log(`[kgm] ${rows.length} ulusal kayıt, ${closures.length} Düziçi koridoru`);
      return closures;
    } catch (err) {
      console.warn('[kgm] kapalı yol listesi alınamadı:', err.message);
      return [];
    }
  }
}

module.exports = new KgmRoadClosureScraper();
