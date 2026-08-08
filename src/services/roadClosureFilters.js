/**
 * Kapalı yol kaydı için sıkı filtre — uzak şehir / genel trafik haberlerini eler.
 */

function normalizeForMatch(text) {
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

const OTHER_CITY_PATTERN =
  /\b(adana|sakarya|istanbul|ankara|izmir|bursa|antalya|kahramanmaraş|gaziantep|kocaeli|mersin|hatay)\b/i;

const CLOSURE_STRONG_PATTERN =
  /yol kapalı|yol kapali|cadde kapalı|cadde kapali|şerit kapalı|kapanış|kapanis|kapatıld|kapatildi|trafik komisyon|güzergah|guzergah|yol çalış|asfalt (çalış|yenile)|yenileniyor|heyelan|kavşak düzen|geçici trafik düzen/i;

const NOISE_PATTERN =
  /kapalı sistem|kapali sistem|sulama altyap|ekmek fabrikas|hortum|maddi hasara yol aç|motosiklet|sürücüye (ceza|para)|trafik uygulamasında \d+|trafik denetim|otoyol.*bayram|bayram yoğunluğu|feribot kuyruğu|köprü geçiş(?!i)|çarpışt|yaraland|korkutan kaza|google news|başkanın mesaj|baskanin mesaj|meclis toplant|festival|yüzme havuz|havuz müjde|milletvekili|kaymakam|galerici|kooperatif.*açılış|birliği meclis|emlak gelir|istimlak|e-belediye|belediye başkan|ağaç.*budama|agac.*budama|içme suyu kuyusu|kursiyer|sertifika|maraton|kıbrıs gazi/i;

function isDuziciArea(text) {
  const { isRelevantToDuziciCorridor } = require('./duziciAreaFilter');
  return isRelevantToDuziciCorridor(text);
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
function isValidRoadClosureRecord({
  title,
  subtitle = '',
  source = '',
  kind = '',
  lat,
  lng,
} = {}) {
  const text = normalizeForMatch(`${title} ${subtitle} ${source}`);
  const {
    isFarAreaExcluded,
    isRelevantToDuziciCorridor,
    isLocalRoadClosure,
  } = require('./duziciAreaFilter');

  if (kind === 'news') return false;
  if (isFarAreaExcluded(`${title} ${subtitle}`)) return false;
  if (isNoiseNews(text)) return false;

  if (kind === 'kgm') {
    return isLocalRoadClosure({ title, subtitle, lat, lng });
  }

  if (kind === 'municipality') {
    const roadish =
      hasClosureIntent(text) ||
      /asfalt|yenilen|yol yatırım|yol yatirim|trafik düzen|trafik duzen/i.test(text);
    if (!roadish) return false;

    // Osmaniye / Düziçi belediye kaynakları: yine yerel koridor şart
    const fromLocalBel =
      /osmaniye belediyesi/i.test(text) ||
      /osmaniye-bld\.gov\.tr/i.test(text) ||
      /duzici\.bel\.tr/i.test(text) ||
      /düziçi belediyesi/i.test(text);

    if (fromLocalBel) {
      return (
        isRelevantToDuziciCorridor(`${title} ${subtitle}`) ||
        /duzici|düziçi|osmaniye|irfanl|uzunban|rte|erdogan|kemal satir/i.test(
          `${title} ${subtitle}`,
        )
      );
    }

    return isLocalRoadClosure({ title, subtitle, lat, lng });
  }

  if (!hasClosureIntent(text)) return false;
  return isLocalRoadClosure({ title, subtitle, lat, lng });
}

module.exports = {
  isValidRoadClosureRecord,
  isDuziciArea,
  hasClosureIntent,
  isNoiseNews,
  normalizeForMatch,
};
