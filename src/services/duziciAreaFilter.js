/**
 * Düziçi + Osmaniye (yakın çevre) koridoru.
 * Mersin/Tepeköy/Adana gibi uzak KGM satırlarını elemez.
 */

function normalize(text) {
  return String(text || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Açıkça uzak / alakasız bölgeler — her zaman ele. */
const FAR_AREA_DENY = [
  'tepekoy',
  'tepe koy',
  'mersin',
  'tarsus',
  'erdemli',
  'silifke',
  'iskenderun',
  'antakya',
  'hatay',
  'gaziantep',
  'kahramanmaras',
  'maras ',
  'sakarya',
  'istanbul',
  'ankara',
  'izmir',
];

/** Düziçi + Osmaniye (ilçe/şehir) ve hemen yakını. */
const LOCAL_KEYWORDS = [
  'duzici',
  'osmaniye',
  'irfanli',
  'irfanlı',
  'uzumlu',
  'uzunbani',
  'uzunbanı',
  'karacaoren',
  'karacaören',
  'yarbasi',
  'yarbaşı',
  'ellek',
  'haruniye',
  'kanli gecit',
  'kanlı geçit',
  'berke',
  'refik cesur',
  'rte bulvar',
  'erdogan bulvar',
  'erdoğan bulvar',
  'kemal satir',
  'kemal satır',
  'toprakkale',
  'kadirli',
  'fistik heykel',
  'fıstık heykel',
  'osmaniye otogar',
  'duzici otogar',
  'osmaniye organize',
  'osmaniye osb',
  'botas',
  'botaş',
];

/**
 * Yaklaşık bbox: Düziçi ilçesi + Osmaniye merkez/OSB + Toprakkale/Kadirli kenarı.
 * Mersin (lng~34.6) ve Adana merkez (lng~35.3) dışı.
 */
const LOCAL_BBOX = {
  minLat: 36.95,
  maxLat: 37.48,
  minLng: 35.95,
  maxLng: 36.72,
};

const LOCATION_HINTS = [
  { keys: ['kanli gecit', 'kanlı geçit', 'berke'], lat: 37.215, lng: 36.418, label: 'Kanlı Geçit / D-400' },
  { keys: ['yarbaş', 'yarbasi'], lat: 37.199, lng: 36.43, label: 'Yarbaşı' },
  { keys: ['karacaören', 'karacaoren'], lat: 37.21, lng: 36.44, label: 'Karacaören' },
  { keys: ['üzümlü', 'uzumlu', 'duzici otogar'], lat: 37.228, lng: 36.465, label: 'Üzümlü / Düziçi Otogar' },
  { keys: ['uzunban'], lat: 37.25, lng: 36.46, label: 'Uzunbanı' },
  { keys: ['irfanl'], lat: 37.244, lng: 36.451, label: 'İrfanlı Mah.' },
  { keys: ['kemal satir', 'kemal satır'], lat: 37.075, lng: 36.25, label: 'Kemal Satır Cad. / Osmaniye' },
  { keys: ['rte', 'erdogan', 'erdoğan'], lat: 37.241, lng: 36.455, label: 'R.T. Erdoğan Bulvarı' },
  { keys: ['ellek'], lat: 37.288, lng: 36.48, label: 'Ellek' },
  { keys: ['haruniye'], lat: 37.381, lng: 36.492, label: 'Haruniye' },
  { keys: ['kadirli'], lat: 37.371, lng: 36.098, label: 'Kadirli' },
  { keys: ['toprakkale'], lat: 37.04, lng: 36.15, label: 'Toprakkale' },
  { keys: ['osmaniye organize', 'botaş', 'botas', 'osb'], lat: 37.074, lng: 36.245, label: 'Osmaniye OSB' },
  { keys: ['fistik', 'fıstık heykel', 'osmaniye otogar'], lat: 37.074, lng: 36.248, label: 'Osmaniye merkez' },
  { keys: ['d-400', 'd400'], lat: 37.22, lng: 36.42, label: 'D-400 (Düziçi–Osmaniye)' },
  { keys: ['o-52', 'o52'], lat: 37.12, lng: 36.28, label: 'O-52 (Osmaniye yakın)' },
];

function isFarAreaExcluded(text) {
  const n = normalize(text);
  // Yerel isim de geçiyorsa (ör. "Osmaniye–Adana") uzak deny tek başına elemez.
  const hasLocal = LOCAL_KEYWORDS.some((k) => n.includes(normalize(k)));
  if (hasLocal) {
    // Tepeköy / Mersin her zaman uzak — yerel kelime olsa bile KGM Mersin satırı.
    if (/tepekoy|tepe koy|mersin|tarsus|erdemli|silifke/.test(n)) return true;
    return false;
  }
  return FAR_AREA_DENY.some((k) => n.includes(normalize(k)));
}

function isWithinLocalBbox(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la === 0 && ln === 0) return false;
  return (
    la >= LOCAL_BBOX.minLat &&
    la <= LOCAL_BBOX.maxLat &&
    ln >= LOCAL_BBOX.minLng &&
    ln <= LOCAL_BBOX.maxLng
  );
}

function isRelevantToDuziciCorridor(text) {
  const n = normalize(text);
  if (!n.trim()) return false;
  if (isFarAreaExcluded(n)) return false;

  if (LOCAL_KEYWORDS.some((k) => n.includes(normalize(k)))) return true;

  // Devlet / otoyol yalnızca Osmaniye–Düziçi bağlamında
  const highway = /d-400|d400|o-52|o52|devlet yolu|il yolu/.test(n);
  if (highway && /(osmaniye|duzici|toprakkale|kadirli|kanli|berke|yarba)/.test(n)) {
    return true;
  }

  return false;
}

function resolveLocationFromText(title, extra = '') {
  const text = normalize(`${title} ${extra}`);
  for (const hint of LOCATION_HINTS) {
    if (hint.keys.some((k) => text.includes(normalize(k)))) {
      return { lat: hint.lat, lng: hint.lng, label: hint.label };
    }
  }
  return { lat: 37.244, lng: 36.451, label: 'Düziçi / Osmaniye' };
}

/** Metin + opsiyonel koordinat ile nihai kabul. */
function isLocalRoadClosure({ title = '', subtitle = '', lat, lng } = {}) {
  const blob = `${title} ${subtitle}`;
  if (isFarAreaExcluded(blob)) return false;
  if (!isRelevantToDuziciCorridor(blob)) return false;
  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    if (Number(lat) !== 0 || Number(lng) !== 0) {
      return isWithinLocalBbox(lat, lng);
    }
  }
  return true;
}

module.exports = {
  normalize,
  isRelevantToDuziciCorridor,
  resolveLocationFromText,
  isFarAreaExcluded,
  isWithinLocalBbox,
  isLocalRoadClosure,
  LOCATION_HINTS,
  LOCAL_BBOX,
};
