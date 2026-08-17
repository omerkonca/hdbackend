const aiClient = require('./aiClient');
const { normalizeText, slugify } = require('../utils/helpers');

const OUTAGE_KEYWORDS = [
  'elektrik kesint',
  'su kesint',
  'sebeke bakim',
  'şebeke bakım',
  'planli kesint',
  'planlı kesint',
  'toroslar edas',
  'toroslar edaş',
  'enerjisa',
  'tedas',
  'tedaş',
  'aski',
  'askı',
];

const ROAD_KEYWORDS = [
  'yol yapim',
  'yol yapım',
  'asfalt serim',
  'asfalt calis',
  'asfalt çalış',
  'kilit parke',
  'trafige kapat',
  'trafiğe kapat',
  'serit daral',
  'şerit daral',
  'kazi calis',
  'kazı çalış',
  'menfez yapim',
  'menfez yapım',
  'kopru yapim',
  'köprü yapım',
  'yol calismasi',
  'yol çalışması',
];

function isOutageOrRoadText(text) {
  const t = normalizeText(text).toLowerCase();
  const hasOutage = OUTAGE_KEYWORDS.some((k) => t.includes(k));
  const hasRoad = ROAD_KEYWORDS.some((k) => t.includes(k));
  return hasOutage || hasRoad;
}

class OutageExtractorService {
  /**
   * Ham metni (WhatsApp duyurusu, gazete haberi, belediye bülteni)
   * yapay zeka ve kural tabanlı motorla kesinti ve yol çalışması kayıtlarına ayrıştırır.
   */
  async extractFromText(rawText, options = {}) {
    const text = String(rawText || '').trim();
    if (!text) return { outages: [], roadClosures: [] };

    // Eğer AI yapılandırılmışsa AI ile kusursuz ayrıştır
    if (aiClient.isConfigured()) {
      try {
        const prompt =
          `Aşağıdaki metin Düziçi (Osmaniye) veya bölge için planlı elektrik/su kesintisi ya da yol çalışması içerebilir.\n` +
          `Metni analiz et ve JSON formatında yapılandırılmış kesinti (outages) ve yol çalışması (roadClosures) listesini çıkar.\n\n` +
          `KURALLAR:\n` +
          `1. Yalnızca metinde geçen gerçek bilgileri kullan. Uydurma bilgi ekleme.\n` +
          `2. type: "ELEKTRİK" veya "SU"\n` +
          `3. status: "Planlandı" veya "Devam Ediyor"\n` +
          `4. severity (yol için): "full" (tam kapalı) veya "partial" (şerit daralması/çalışma)\n` +
          `5. Tarih ve saatleri ISO-8601 (örn. 2026-08-18T09:00:00+03:00) olarak çıkar; saat bilinmiyorsa null bırak.\n\n` +
          `METİN:\n"""\n${text.slice(0, 3000)}\n"""\n\n` +
          `JSON FORMATI:\n` +
          `{\n` +
          `  "outages": [\n` +
          `    {\n` +
          `      "title": "Kurtuluş Mh. Elektrik Kesintisi",\n` +
          `      "subtitle": "Şebeke bakım ve yenileme çalışması nedeniyle",\n` +
          `      "type": "ELEKTRİK",\n` +
          `      "area": "Kurtuluş Mahallesi, Atatürk Caddesi ve civarı",\n` +
          `      "startAt": "2026-08-18T09:00:00+03:00",\n` +
          `      "endAt": "2026-08-18T17:00:00+03:00",\n` +
          `      "reason": "Şebeke yenileme",\n` +
          `      "source": "Toroslar EDAŞ"\n` +
          `    }\n` +
          `  ],\n` +
          `  "roadClosures": [\n` +
          `    {\n` +
          `      "title": "Refik Cesur Bulvarı Asfalt Çalışması",\n` +
          `      "subtitle": "Tek şerit trafiğe kapalı, kontrollü geçiş sağlanıyor",\n` +
          `      "address": "Refik Cesur Bulvarı, Düziçi",\n` +
          `      "reason": "Sıcak asfalt serim çalışması",\n` +
          `      "severity": "partial",\n` +
          `      "startAt": "2026-08-18T08:00:00+03:00",\n` +
          `      "endAt": "2026-08-19T18:00:00+03:00",\n` +
          `      "source": "Düziçi Belediyesi Fen İşleri"\n` +
          `    }\n` +
          `  ]\n` +
          `}`;

        const parsed = await aiClient.generateJson(prompt, { maxTokens: 1000 });
        if (parsed && (Array.isArray(parsed.outages) || Array.isArray(parsed.roadClosures))) {
          return this._normalizeExtracted(parsed);
        }
      } catch (err) {
        console.warn('[outage-extractor] AI parse failed, fallback to rules:', err.message);
      }
    }

    // Fallback: Kural ve regex tabanlı hızlı ayrıştırma
    return this._extractWithRules(text);
  }

  _normalizeExtracted(parsed) {
    const outages = (parsed.outages || []).map((item) => {
      const id = `extracted_outage_${slugify(`${item.title}_${item.startAt || Date.now()}`)}`;
      return {
        id,
        title: item.title || 'Planlı Kesinti',
        subtitle: item.subtitle || item.reason || 'Düziçi kesinti kaydı',
        type: item.type === 'SU' ? 'SU' : 'ELEKTRİK',
        status: item.status || 'Planlandı',
        source: item.source || 'Resmi Duyuru',
        sourceKind: 'extracted',
        area: item.area || 'Düziçi',
        lat: 37.244,
        lng: 36.451,
        date: item.startAt || new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        startAt: item.startAt || null,
        endAt: item.endAt || null,
        isActive: true,
      };
    });

    const roadClosures = (parsed.roadClosures || []).map((item) => {
      const id = `extracted_road_${slugify(`${item.title}_${item.startAt || Date.now()}`)}`;
      return {
        id,
        fingerprint: id,
        title: item.title || 'Yol Çalışması',
        subtitle: item.subtitle || item.reason || 'Düziçi yol durumu kaydı',
        status: 'Devam Ediyor',
        reason: item.reason || 'Belediye / Yol çalışması',
        roadCode: item.roadCode || 'Düziçi',
        address: item.address || 'Düziçi / Osmaniye',
        lat: 37.244,
        lng: 36.451,
        alternativeRoute: item.alternativeRoute || 'Alternatif güzergâhlara dikkat ediniz.',
        severity: item.severity === 'full' ? 'full' : 'partial',
        startAt: item.startAt || new Date().toISOString(),
        endAt: item.endAt || null,
        source: item.source || 'Düziçi Belediyesi',
        kind: 'extracted',
        autoManaged: true,
      };
    });

    return { outages, roadClosures };
  }

  _extractWithRules(text) {
    const outages = [];
    const roadClosures = [];
    const isWater = /su kesint/i.test(text);
    const isElectric = /elektrik|toroslar|edaş|enerjisa|trafo|şebeke/i.test(text);
    const isRoad = ROAD_KEYWORDS.some((k) => text.toLowerCase().includes(k));

    const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
    const timeMatch = text.match(/(\d{1,2}:\d{2})/g) || [];
    let startAt = null;
    let endAt = null;
    if (dateMatch) {
      const [, d, mo, y] = dateMatch;
      const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
      if (timeMatch[0]) startAt = `${iso}T${timeMatch[0]}:00+03:00`;
      if (timeMatch[1]) endAt = `${iso}T${timeMatch[1]}:00+03:00`;
    }

    if (isElectric || isWater) {
      const type = isWater ? 'SU' : 'ELEKTRİK';
      const title = text.slice(0, 70);
      outages.push({
        id: `rule_outage_${Date.now()}`,
        title: title.length > 60 ? `${title.slice(0, 57)}...` : title,
        subtitle: text.slice(0, 180),
        type,
        status: 'Planlandı',
        source: isWater ? 'Düziçi Belediyesi Su İşleri' : 'Toroslar EDAŞ',
        sourceKind: 'rule',
        area: 'Düziçi',
        lat: 37.244,
        lng: 36.451,
        date: startAt || new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        startAt,
        endAt,
        isActive: true,
      });
    }

    if (isRoad) {
      roadClosures.push({
        id: `rule_road_${Date.now()}`,
        fingerprint: `rule_road_${Date.now()}`,
        title: text.slice(0, 65),
        subtitle: text.slice(0, 160),
        status: 'Devam Ediyor',
        reason: 'Yol / Altyapı çalışması',
        roadCode: 'Düziçi',
        address: 'Düziçi / Osmaniye',
        lat: 37.244,
        lng: 36.451,
        alternativeRoute: 'Alternatif güzergâhlara dikkat ediniz.',
        severity: /tamamen|trafiğe kapalı/i.test(text) ? 'full' : 'partial',
        startAt: startAt || new Date().toISOString(),
        endAt,
        source: 'Düziçi Belediyesi',
        kind: 'rule',
        autoManaged: true,
      });
    }

    return { outages, roadClosures };
  }
}

module.exports = new OutageExtractorService();
