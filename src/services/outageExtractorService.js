const aiClient = require('./aiClient');
const { normalizeText, slugify } = require('../utils/helpers');

const MONTH_MAP = {
  ocak: '01',
  subat: '02',
  şubat: '02',
  mart: '03',
  nisan: '04',
  mayis: '05',
  mayıs: '05',
  haziran: '06',
  temmuz: '07',
  agustos: '08',
  ağustos: '08',
  eylul: '09',
  eylül: '09',
  ekim: '10',
  kasim: '11',
  kasım: '11',
  aralik: '12',
  aralık: '12',
};

class OutageExtractorService {
  /**
   * Ham metni (WhatsApp duyurusu, gazete haberi, belediye bülteni)
   * yapay zeka ve akıllı Türkçe kural motoruyla net, anlaşılır kesinti ve yol çalışması kayıtlarına ayrıştırır.
   */
  async extractFromText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return { outages: [], roadClosures: [] };

    // 1. Eğer AI yapılandırılmışsa AI ile kusursuz ayrıştır
    if (aiClient.isConfigured()) {
      try {
        const systemPrompt =
          `Sen Düziçi (Osmaniye) ilçesi için resmi duyuru ve bildirim editörüsün.\n` +
          `Görevin; Toroslar EDAŞ, ASKİ, Belediye, Muhtarlık veya yerel haber sitelerinden gelen karmaşık, ham metinleri okuyup halkın hemen anlayacağı SADE, NET ve PROFESYONEL duyurulara dönüştürmektir.\n\n` +
          `ÖNEMLİ KURALLAR:\n` +
          `1. Başlık (title): Kısa, vurucu ve lokasyonu içermeli. Asla haberin ilk cümlesini kopyalama! (Örn: "Soğulcak Yaylası & Çoban Elektrik Kesintisi" veya "Kurtuluş Mahallesi Su Kesintisi")\n` +
          `2. Açıklama (subtitle): Tarih, saat ve nedeni özetleyen tek/iki temiz Türkçe cümle olmalı. (Örn: "22 Ağustos Cumartesi günü 09:00 - 17:00 saatleri arasında şebeke bakım çalışması nedeniyle elektrik kesintisi uygulanacaktır.")\n` +
          `3. Etkilenen Bölgeler (area): Etkilenecek tüm mahalle, yayla, sokak ve mevkileri açıkça listele. (Örn: "Soğulcak Yaylası (1, 3, 5, 7 Nolu sokaklar), Çoban (1 Nolu dahil), İlgiliç, Tikenli")\n` +
          `4. Tür (type): Yalnızca "ELEKTRİK" veya "SU"\n` +
          `5. Kaynak (source): "Toroslar EDAŞ", "Düziçi Belediyesi", "ASKİ" vb.\n` +
          `6. Tarih/Saat (startAt, endAt): Metinde geçen tarih ve saatleri Türkiye saatine göre tam ISO-8601 (Örn: "2026-08-22T09:00:00+03:00") olarak üret.\n` +
          `7. Yol Çalışmaları için (roadClosures): Başlık, etkilenen cadde/bulvar (address), neden (reason), durum (severity: "full" veya "partial") ve tarihleri çıkar.\n` +
          `8. Yanıtı SADECE geçerli bir JSON nesnesi olarak ver.`;

        const userPrompt =
          `Aşağıdaki ham metni incele ve JSON formatında yapılandırılmış kesinti (outages) ve yol çalışmaları (roadClosures) listesini çıkar:\n\n` +
          `METİN:\n"""\n${text.slice(0, 4000)}\n"""\n\n` +
          `İSTENEN JSON FORMATI:\n` +
          `{\n` +
          `  "outages": [\n` +
          `    {\n` +
          `      "title": "Soğulcak Yaylası & Çoban Elektrik Kesintisi",\n` +
          `      "subtitle": "22 Ağustos Cumartesi günü 09:00 - 17:00 saatleri arasında bakım çalışması nedeniyle elektrik kesintisi uygulanacaktır.",\n` +
          `      "type": "ELEKTRİK",\n` +
          `      "area": "Soğulcak Yaylası (1, 3, 5, 7 Nolu sokaklar), Çoban (1 Nolu dahil), İlgiliç ve Tikenli",\n` +
          `      "startAt": "2026-08-22T09:00:00+03:00",\n` +
          `      "endAt": "2026-08-22T17:00:00+03:00",\n` +
          `      "reason": "Yayla bölgelerinde şebeke bakım çalışması",\n` +
          `      "source": "Toroslar EDAŞ"\n` +
          `    }\n` +
          `  ],\n` +
          `  "roadClosures": []\n` +
          `}`;

        const res = await aiClient.generateJson({ systemPrompt, userPrompt });
        const parsed = res?.data;
        if (parsed && (Array.isArray(parsed.outages) || Array.isArray(parsed.roadClosures))) {
          return this._normalizeExtracted(parsed);
        }
      } catch (err) {
        console.warn('[outage-extractor] AI parse başarısız veya API key yok, akıllı kural motoruna geçiliyor:', err.message);
      }
    }

    // 2. Fallback: Akıllı Türkçe Regex ve Kural Motoru
    return this._extractWithRules(text);
  }

  _normalizeExtracted(parsed) {
    const outages = (parsed.outages || []).map((item) => {
      const id = `extracted_outage_${slugify(`${item.title}_${item.startAt || Date.now()}`)}`;
      return {
        id,
        title: item.title || 'Planlı Kesinti',
        subtitle: item.subtitle || item.reason || 'Düziçi kesinti duyurusu',
        type: item.type === 'SU' ? 'SU' : 'ELEKTRİK',
        status: item.status || 'Planlandı',
        source: item.source || (item.type === 'SU' ? 'Düziçi Belediyesi Su İşleri' : 'Toroslar EDAŞ'),
        sourceKind: 'extracted',
        area: item.area || 'Düziçi geneli',
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
        reason: item.reason || 'Yol ve altyapı çalışması',
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

  /**
   * Akıllı Türkçe Kural & Regex Tabanlı Ayrıştırma Motoru
   */
  _extractWithRules(text) {
    const outages = [];
    const roadClosures = [];
    const normalized = text.replace(/\r\n/g, '\n');

    const isWater = /su kesint|aski|askı|su arıza|şebeke boru|içme suyu|su kesil/i.test(normalized);
    const isRoad = /yol.*çalış|asfalt|trafiğe kapat|şerit daral|menfez|köprü yapım|kilit parke|yol yapım/i.test(normalized);
    const isAnyOutage = /kesint|bakım|şebeke|arıza|onarım|toroslar|edaş|enerjisa|elektrik|trafo|etkilenecek/i.test(normalized);
    const isElectric = !isWater && (isAnyOutage || /elektrik|toroslar|edaş|enerjisa|trafo/i.test(normalized));

    // 1. Saat aralığını bul (Örn: "09:00 - 17:00", "09:00'da başlayıp 17:00'ye kadar", "09.00 - 17.00")
    let startTimeStr = '';
    let endTimeStr = '';
    const timeRangeMatch = normalized.match(/(\d{1,2}[:.]\d{2})\s*(?:-|–|ile|ila|'da başlayıp|\s)\s*(\d{1,2}[:.]\d{2})/i);
    if (timeRangeMatch) {
      startTimeStr = timeRangeMatch[1].replace('.', ':').padStart(5, '0');
      endTimeStr = timeRangeMatch[2].replace('.', ':').padStart(5, '0');
    } else {
      const singleTimes = normalized.match(/\b(\d{1,2}[:.]\d{2})\b/g);
      if (singleTimes && singleTimes.length >= 2) {
        startTimeStr = singleTimes[0].replace('.', ':').padStart(5, '0');
        endTimeStr = singleTimes[1].replace('.', ':').padStart(5, '0');
      } else if (singleTimes && singleTimes.length === 1) {
        startTimeStr = singleTimes[0].replace('.', ':').padStart(5, '0');
      }
    }

    // 2. Tarihi bul (Örn: "22 ağustos cumartesi", "22.08.2026", "22/08/2026")
    // ÖNEMLİ: Render UTC'de çalışır; Date#getDate() günü bir gün kaydırabilir.
    // Bu yüzden ISO tarihi eşleşen stringlerden üret, yerel getDate kullanma.
    let baseIsoDate = null;
    let dateFormattedTr = '';
    const textDateMatch = normalized.match(/(\d{1,2})\s+(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+(\d{4}))?(?:\s+(pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar))?/i);
    const numDateMatch = normalized.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?/);

    if (textDateMatch) {
      const day = textDateMatch[1].padStart(2, '0');
      const monthName = textDateMatch[2].toLowerCase();
      const month = MONTH_MAP[monthName] || '01';
      const year = textDateMatch[3] || new Date().toLocaleString('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' });
      const dayName = textDateMatch[4] ? textDateMatch[4].charAt(0).toUpperCase() + textDateMatch[4].slice(1) : '';
      baseIsoDate = `${year}-${month}-${day}`;
      dateFormattedTr = `${parseInt(day, 10)} ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${dayName}`.trim();
    } else if (numDateMatch) {
      const day = numDateMatch[1].padStart(2, '0');
      const month = numDateMatch[2].padStart(2, '0');
      const year = numDateMatch[3] || new Date().toLocaleString('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' });
      baseIsoDate = `${year}-${month}-${day}`;
      dateFormattedTr = `${day}.${month}.${year}`;
    } else {
      // Tarih yoksa bugünün TR tarihi
      baseIsoDate = new Date().toLocaleString('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }

    const startAt = startTimeStr ? `${baseIsoDate}T${startTimeStr}:00+03:00` : `${baseIsoDate}T09:00:00+03:00`;
    // "gün boyunca" / saat yoksa 09:00–20:00 varsay (10 saat kuralında history'ye erken düşmesin)
    const endAt = endTimeStr
      ? `${baseIsoDate}T${endTimeStr}:00+03:00`
      : startTimeStr
        ? `${baseIsoDate}T17:00:00+03:00`
        : `${baseIsoDate}T20:00:00+03:00`;

    // 3. Etkilenen Bölgeleri Ayıkla ve Zenginleştir
    let area = '';
    const affectedMatch = normalized.match(/(?:etkilenecek yerler|etkilenen bölgeler|kesinti yapılacak yerler|kesintiden etkilenecek|bölgeler|yerler)[:\s\n]+([^\n.]+)/i);
    if (affectedMatch && affectedMatch[1]) {
      area = affectedMatch[1].replace(/\b(?:20\d{2}|gün|günü|saat|arası|tarihinde|yapılacak)\b.*/i, '').trim();
    }

    if (!area) {
      // Metin içinde geçen bilinen mahalle/yayla isimlerini ara
      const knownLocations = [
        'Soğulcak Yaylası', 'Çoban Yaylası', 'Zorkun', 'İlgiliç', 'Tikenli',
        'Kurtuluş', 'Cumhuriyet', 'İrfanlı', 'Üzümlü', 'Hürriyet', 'Yeşilova',
        'Refik Cesur', 'Atatürk Caddesi', 'Yarbaşı', 'Ellek', 'Böke', 'Gökçedam'
      ];
      const found = knownLocations.filter(loc => new RegExp(loc, 'i').test(normalized));
      if (found.length > 0) {
        area = found.join(', ');
      } else {
        area = 'Düziçi İlçe Geneli';
      }
    }

    // Düziçi Yerel İsimlerini Zenginleştir (Halkın net anlaması için Yaylası / Mevkii / Mahallesi ekle)
    area = this._enrichDuziciArea(area, normalized);

    // 4. Profesyonel Başlık ve Açıklama Oluştur
    if (isElectric || isWater) {
      const type = isWater ? 'SU' : 'ELEKTRİK';
      
      // Başlık için ana lokasyonları derle
      const locCandidates = area
        .replace(/\(.*?\)/g, '')
        .split(/[,&]/)
        .map((s) => s.replace(/bölgeleri|bölgesi|dahil|nolu|sokaklar/gi, '').trim())
        .filter((s) => s.length > 2 && !/^(ve|ile|nolu|dahil)$/i.test(s));

      let locSummary = '';
      if (locCandidates.length >= 2) {
        locSummary = `${locCandidates[0]} & ${locCandidates[1]}`;
      } else if (locCandidates.length === 1) {
        locSummary = locCandidates[0];
      }

      const title = locSummary && locSummary !== 'Düziçi İlçe Geneli'
        ? (isWater ? `Düziçi Su Kesintisi (${locSummary})` : `Düziçi Elektrik Kesintisi (${locSummary})`)
        : (isWater ? 'Düziçi Planlı Su Kesintisi' : 'Düziçi Planlı Elektrik Kesintisi');

      const timeText = (startTimeStr && endTimeStr) ? `${startTimeStr} - ${endTimeStr} saatleri arasında` : 'gün boyunca';
      const dateText = dateFormattedTr ? `${dateFormattedTr} günü ` : '';
      const subtitle = `${dateText}${timeText} şebeke bakım ve yenileme çalışmaları nedeniyle kesinti uygulanacaktır.`;

      const crypto = require('crypto');
      const outageHash = crypto.createHash('md5').update(`${title}_${area}_${startAt}`).digest('hex').slice(0, 12);
      outages.push({
        id: `extracted_outage_${outageHash}`,
        title,
        subtitle,
        type,
        status: 'Planlandı',
        source: isWater ? 'Düziçi Belediyesi Su İşleri' : 'Toroslar EDAŞ',
        sourceKind: 'extracted',
        area: area || 'Düziçi',
        lat: 37.244,
        lng: 36.451,
        date: startAt,
        publishedAt: new Date().toISOString(),
        startAt,
        endAt,
        isActive: true,
      });
    }

    if (isRoad) {
      const title = 'Düziçi Yol ve Asfalt Çalışması';
      const subtitle = `${dateFormattedTr ? `${dateFormattedTr} günü ` : ''}altyapı ve asfalt çalışması nedeniyle kontrollü geçiş sağlanmaktadır.`;

      const crypto = require('crypto');
      const roadHash = crypto.createHash('md5').update(`${title}_${area}_${startAt}`).digest('hex').slice(0, 12);
      roadClosures.push({
        id: `extracted_road_${roadHash}`,
        fingerprint: `extracted_road_${roadHash}`,
        title,
        subtitle,
        status: 'Devam Ediyor',
        reason: 'Altyapı ve Asfalt Serim Çalışması',
        roadCode: 'Düziçi',
        address: area || 'Düziçi / Osmaniye',
        lat: 37.244,
        lng: 36.451,
        alternativeRoute: 'Alternatif güzergâhlara dikkat ediniz.',
        severity: /tamamen|trafiğe kapalı|kapalı/i.test(normalized) ? 'full' : 'partial',
        startAt,
        endAt,
        source: 'Düziçi Belediyesi Fen İşleri',
        kind: 'extracted',
        autoManaged: true,
      });
    }

    return { outages, roadClosures };
  }

  _enrichDuziciArea(areaText, fullText = '') {
    if (!areaText) return 'Düziçi İlçe Geneli';
    let res = areaText;

    const isYaylaContext = /yayla/i.test(fullText) || /yayla/i.test(areaText);

    // 1. Yayla isimlerini zenginleştir
    if (isYaylaContext || /\bçoban\b/i.test(res)) {
      res = res.replace(/\bçoban\b(?!\s+yaylası)/gi, 'Çoban Yaylası');
    }
    if (isYaylaContext || /\bilgiliç\b/i.test(res)) {
      res = res.replace(/\bilgiliç\b(?!\s+(?:yaylası|mevkii))/gi, 'İlgiliç Yaylası / Mevkii');
    }
    if (isYaylaContext || /\btikenli\b/i.test(res)) {
      res = res.replace(/\btikenli\b(?!\s+(?:yaylası|mevkii))/gi, 'Tikenli Yaylası / Mevkii');
    }
    if (isYaylaContext || /\bsoğulcak\b/i.test(res)) {
      res = res.replace(/\bsoğulcak\b(?!\s+yaylası)/gi, 'Soğulcak Yaylası');
    }
    if (isYaylaContext || /\bzorkun\b/i.test(res)) {
      res = res.replace(/\bzorkun\b(?!\s+yaylası)/gi, 'Zorkun Yaylası');
    }

    // 2. Sokak ve dahil kalıplarını düzelt
    res = res.replace(/(\d+(?:,\s*\d+)*(?:\s+ve\s+\d+)?)\s*nolu\s*(?:sokaklar|sokak)?/gi, '$1 Nolu Sokaklar');
    res = res.replace(/(\d+)\s*nolu\s*dahil/gi, '$1 Nolu Sokak dahil');

    return res.trim();
  }
}

module.exports = new OutageExtractorService();
