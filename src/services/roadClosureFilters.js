/**
 * Kapalı yol kaydı için sıkı filtre — genel trafik haberlerini eler.
 */

function normalizeForMatch(text) {
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

const OTHER_CITY_PATTERN =
  /\b(adana|sakarya|istanbul|ankara|izmir|bursa|antalya|kahramanmaraş|gaziantep|kocaeli)\b/i;

const CLOSURE_STRONG_PATTERN =
  /kapalı|kapali|kapanış|kapanis|kapatıld|kapatildi|trafik komisyon|güzergah|guzergah|şerit kapalı|yol çalış|asfalt (çalış|yenile)|yenileniyor|heyelan|kavşak düzen|geçici trafik düzen/i;

const NOISE_PATTERN =
  /motosiklet|sürücüye (ceza|para)|trafik uygulamasında \d+|otoyol.*bayram|bayram yoğunluğu|feribot kuyruğu|köprü geçiş(?!i)/i;

function isDuziciArea(text) {
  return /d[uü]zi[cç]i|duzici|osmaniye il trafik|irfanlı|irfanli/i.test(text);
}

function hasClosureIntent(text) {
  return CLOSURE_STRONG_PATTERN.test(text);
}

function isNoiseNews(text) {
  if (NOISE_PATTERN.test(text)) return true;
  if (OTHER_CITY_PATTERN.test(text) && !isDuziciArea(text)) return true;
  return false;
}

/** Belediye duyurusu veya resmî yol kapanması mı? */
function isValidRoadClosureRecord({ title, subtitle = '', source = '', kind = '' }) {
  const text = normalizeForMatch(`${title} ${subtitle} ${source}`);

  if (kind === 'news') return false;
  if (isNoiseNews(text)) return false;
  if (!hasClosureIntent(text)) return false;

  if (kind === 'municipality') {
    return isDuziciArea(text) || /belediye|duzici\.bel\.tr/i.test(text);
  }

  return isDuziciArea(text);
}

module.exports = {
  isValidRoadClosureRecord,
  isDuziciArea,
  hasClosureIntent,
  isNoiseNews,
  normalizeForMatch,
};
