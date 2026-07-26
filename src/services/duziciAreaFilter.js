/**
 * Düziçi ve çevre koridoru (Osmaniye, D-400, O-52, minibüs güzergâhı) ile ilgili kayıtları süzer.
 */

function normalize(text) {
  // helpers.normalizeForCompare ile aynı Türkçe ASCII katlama
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

const CORRIDOR_KEYWORDS = [
  'duzici',
  'düziçi',
  'osmaniye',
  'irfanli',
  'irfanlı',
  'uzumlu',
  'üzümlü',
  'karacaoren',
  'karacaören',
  'yarbasi',
  'yarbaşı',
  'kanli gecit',
  'kanlı geçit',
  'berke',
  'refik cesur',
  'rte bulvar',
  'erdogan bulvar',
  'erdoğan bulvar',
  'kadirli',
  'toprakkale',
  'd-400',
  'd400',
  'o-52',
  'o52',
  'otoyol',
  'adana',
  'ceyhan',
  'fistik heykel',
  'fıstık heykel',
  'osmaniye otogar',
  'duzici otogar',
];

const KGM_BRANCH_KEYWORDS = [
  'adana',
  'mersin',
  'hatay',
  'osmaniye',
  'gaziantep',
];

const LOCATION_HINTS = [
  { keys: ['kanli gecit', 'kanlı geçit', 'berke'], lat: 37.215, lng: 36.418, label: 'Kanlı Geçit / D-400' },
  { keys: ['yarbaş', 'yarbasi'], lat: 37.199, lng: 36.43, label: 'Yarbaşı' },
  { keys: ['karacaören', 'karacaoren'], lat: 37.21, lng: 36.44, label: 'Karacaören' },
  { keys: ['üzümlü', 'uzumlu', 'otogar'], lat: 37.228, lng: 36.465, label: 'Üzümlü / Düziçi Otogar' },
  { keys: ['irfanl'], lat: 37.244, lng: 36.451, label: 'İrfanlı Mah.' },
  { keys: ['rte', 'erdogan', 'erdoğan'], lat: 37.241, lng: 36.455, label: 'R.T. Erdoğan Bulvarı' },
  { keys: ['kadirli'], lat: 37.371, lng: 36.098, label: 'Kadirli yolu' },
  { keys: ['osmaniye organize', 'botaş', 'osb'], lat: 37.074, lng: 36.245, label: 'Osmaniye OSB' },
  { keys: ['fistik', 'fıstık heykel'], lat: 37.074, lng: 36.248, label: 'Osmaniye merkez' },
  { keys: ['adana', 'ceyhan'], lat: 37.0, lng: 35.321, label: 'Adana güzergâhı' },
  { keys: ['mersin', 'tepeköy', 'otoyol baglanti'], lat: 36.85, lng: 34.65, label: 'Mersin otoyol bağlantısı' },
  { keys: ['d-400', 'd400'], lat: 37.22, lng: 36.42, label: 'D-400 devlet yolu' },
  { keys: ['o-52', 'o52'], lat: 37.18, lng: 36.38, label: 'O-52 otoyol' },
];

function isRelevantToDuziciCorridor(text) {
  const n = normalize(text);
  if (CORRIDOR_KEYWORDS.some((k) => n.includes(normalize(k)))) return true;

  const hasBranch = KGM_BRANCH_KEYWORDS.some((k) => n.includes(k));
  if (hasBranch && /yol|otoyol|dya|iya|devlet|heyelan|calisma|çalışma|kapal/i.test(n)) {
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
  return { lat: 37.244, lng: 36.451, label: 'Düziçi / Osmaniye koridoru' };
}

module.exports = {
  normalize,
  isRelevantToDuziciCorridor,
  resolveLocationFromText,
  LOCATION_HINTS,
};
