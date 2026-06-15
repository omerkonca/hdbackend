const TR_MONTHS = {
  ocak: 1,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  agustos: 8,
  eylul: 9,
  ekim: 10,
  kasim: 11,
  aralik: 12,
};

function normTr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function istanbulDateKeyLocal(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function addDaysToDateKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function parseDutyStartFromRange(dateRange, referenceYear) {
  if (!dateRange) return null;
  const match = dateRange.match(/(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = TR_MONTHS[normTr(match[2])];
  if (!month || !day) return null;
  return { year: referenceYear, month, day };
}

function toDateKey({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Kaynak sitedeki "Bugün/Yarın" sekmesi gece yarısından sonra güncellenmeyebilir;
 * nöbet metnindeki başlangıç tarihine göre İstanbul saatine göre etiket düzeltir.
 */
function effectiveDateLabel(pharmacy, nowMs = Date.now()) {
  const todayKey = istanbulDateKeyLocal(nowMs);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const refYear = parseInt(todayKey.slice(0, 4), 10);

  const start = parseDutyStartFromRange(pharmacy.dateRange, refYear);
  if (!start) {
    return pharmacy.dateLabel === 'Yarın' ? 'Yarın' : 'Bugün';
  }

  let startKey = toDateKey(start);
  if (startKey < todayKey && start.month === 12) {
    startKey = toDateKey({ ...start, year: refYear + 1 });
  }

  if (startKey === todayKey) return 'Bugün';
  if (startKey === tomorrowKey) return 'Yarın';
  return pharmacy.dateLabel === 'Yarın' ? 'Yarın' : 'Bugün';
}

function normalizePharmacyDateLabels(pharmacies, nowMs = Date.now()) {
  if (!Array.isArray(pharmacies)) return pharmacies;
  return pharmacies
    .map((p) => ({
      ...p,
      dateLabel: effectiveDateLabel(p, nowMs),
    }))
    .sort((a, b) => {
      const order = (label) => (label === 'Bugün' ? 0 : 1);
      return order(a.dateLabel) - order(b.dateLabel);
    });
}

module.exports = {
  effectiveDateLabel,
  normalizePharmacyDateLabels,
};
