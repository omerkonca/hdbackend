const municipalityAnnouncementScraper = require('./municipalityAnnouncementScraper');
const toroslarOutageScraper = require('./toroslarOutageScraper');
const fcmService = require('./fcmService');
const outagePushLog = require('../utils/outagePushLog');
const pushTokenService = require('./pushTokenService');

const CACHE_MS = 1 * 60 * 1000; // 1 dk taze veri
const HISTORY_DAYS = 7;

const DUZICI_MAHALLELER = [
  { name: 'İrfanlı Mahallesi', key: 'irfanli', lat: 37.244, lng: 36.451 },
  { name: 'Cumhuriyet Mahallesi', key: 'cumhuriyet', lat: 37.242, lng: 36.449 },
  { name: 'Yeşilova Mahallesi', key: 'yesilova', lat: 37.238, lng: 36.448 },
  { name: 'Şehitler Mahallesi', key: 'sehitler', lat: 37.242, lng: 36.449 },
  { name: 'İstiklal Mahallesi', key: 'istiklal', lat: 37.241, lng: 36.455 },
  { name: 'Kurtuluş Mahallesi', key: 'kurtulus', lat: 37.234, lng: 36.442 },
  { name: 'Üzümlü Mahallesi', key: 'uzumlu', lat: 37.228, lng: 36.465 },
  { name: 'Karlıca Mahallesi', key: 'karlica', lat: 37.245, lng: 36.435 },
  { name: 'Hürriyet Mahallesi', key: 'hurriyet', lat: 37.250, lng: 36.460 },
  { name: 'Ellek Beldesi', key: 'ellek', lat: 37.288, lng: 36.480 },
  { name: 'Yarbaşı Beldesi', key: 'yarbasi', lat: 37.199, lng: 36.430 },
  { name: 'Kuşçu Köyü / Haruniye', key: 'kuscu', lat: 37.381, lng: 36.492 },
  { name: 'Bostanlar', key: 'bostanlar', lat: 37.230, lng: 36.480 },
  { name: 'Gümüş', key: 'gumus', lat: 37.250, lng: 36.420 },
  { name: 'Alibozlu', key: 'alibozlu', lat: 37.210, lng: 36.400 },
  { name: 'Gökçayır', key: 'gokcayir', lat: 37.270, lng: 36.430 },
  { name: 'Pınarbaşı', key: 'pinarbasi', lat: 37.260, lng: 36.450 },
  { name: 'Boyalı', key: 'boyali', lat: 37.290, lng: 36.410 },
  { name: 'Yazlamaz', key: 'yazlamaz', lat: 37.220, lng: 36.470 },
];

function normalizeTr(s = '') {
  return String(s)
    .toLowerCase()
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function extractAffectedMahalleler(item) {
  const blob = normalizeTr(`${item.title || ''} ${item.area || ''} ${item.subtitle || ''}`);
  const matched = [];

  for (const m of DUZICI_MAHALLELER) {
    if (blob.includes(m.key)) {
      matched.push(m);
    }
  }
  return matched;
}

function turkeyDateKey(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function daysBetween(olderKey, newerKey) {
  const older = new Date(`${olderKey}T12:00:00Z`).getTime();
  const newer = new Date(`${newerKey}T12:00:00Z`).getTime();
  return Math.round((newer - older) / (24 * 60 * 60 * 1000));
}

function extractLocationTokens(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[^\wığüşöç\s]/gi, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !/^(ve|veya|ile|nolu|mah|mahallesi|sokak|sokagi|sokağı|caddesi|cad|mevkii|mevkileri|civarı|çevreleri|merkez|düziçi|duzici|kesintisi|elektrik|kesinti)$/i.test(
          w,
        ),
    );
}

function areOutagesSame(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;

  // 1. Aynı Kesinti Türü
  const typeA = String(a.type || '').toUpperCase();
  const typeB = String(b.type || '').toUpperCase();
  if (typeA !== typeB) return false;

  // 2. Aynı Tarih (veya 8 saat içinde)
  const dateA = a.startAt || a.date;
  const dateB = b.startAt || b.date;
  if (dateA && dateB) {
    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();
    if (!isNaN(timeA) && !isNaN(timeB)) {
      const diffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);
      if (diffHours > 8) return false;
    }
  }

  // 3. Etkilenen Bölge / Mahalle / Cadde Benzerliği
  const tokensA = new Set(extractLocationTokens(`${a.title} ${a.area || ''} ${a.subtitle || ''}`));
  const tokensB = new Set(extractLocationTokens(`${b.title} ${b.area || ''} ${b.subtitle || ''}`));

  let sharedCount = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) sharedCount++;
  }

  const minSize = Math.min(tokensA.size, tokensB.size);
  if (minSize > 0 && (sharedCount >= 3 || sharedCount / minSize >= 0.35)) {
    return true;
  }

  return false;
}

function mergeOutagePair(primary, secondary) {
  // Bölgeleri birleştir
  const areaParts = new Set();
  for (const part of `${primary.area || ''}, ${secondary.area || ''}`.split(/[,;\n•]+/)) {
    const trimmed = part.trim();
    if (trimmed && trimmed.length > 1) areaParts.add(trimmed);
  }
  const combinedArea = [...areaParts].join(', ');

  // Daha belirgin ve spesifik başlığı seç
  let bestTitle = primary.title;
  if (/düziçi ilçesi/i.test(primary.title) && !/düziçi ilçesi/i.test(secondary.title)) {
    bestTitle = secondary.title;
  } else if (
    (secondary.title || '').length > (primary.title || '').length &&
    !/düziçi ilçesi/i.test(secondary.title)
  ) {
    bestTitle = secondary.title;
  }

  // En erken başlangıç, en geç bitiş
  let startAt = primary.startAt || secondary.startAt;
  if (primary.startAt && secondary.startAt) {
    startAt = new Date(primary.startAt) < new Date(secondary.startAt) ? primary.startAt : secondary.startAt;
  }
  let endAt = primary.endAt || secondary.endAt;
  if (primary.endAt && secondary.endAt) {
    endAt = new Date(primary.endAt) > new Date(secondary.endAt) ? primary.endAt : secondary.endAt;
  }

  return {
    ...primary,
    title: bestTitle,
    area: combinedArea || primary.area,
    startAt,
    endAt,
    source: primary.source || secondary.source || 'Toroslar EDAŞ',
    subtitle: primary.subtitle && primary.subtitle.length > 20 ? primary.subtitle : secondary.subtitle,
  };
}

function mergeOutages(lists) {
  const all = [];
  for (const list of lists) {
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && item.title) all.push({ ...item });
      }
    }
  }

  const merged = [];
  for (const item of all) {
    const matchedIndex = merged.findIndex((existing) => areOutagesSame(existing, item));
    if (matchedIndex >= 0) {
      merged[matchedIndex] = mergeOutagePair(merged[matchedIndex], item);
    } else {
      merged.push(item);
    }
  }

  return merged;
}

class OutageService {
  constructor() {
    this.cache = {
      data: [],
      history: [],
      fetchedAt: 0,
      source: 'belediye-duyuru',
    };
    this._lastFingerprint = '';
    this._isFetching = false;

    // Arka planda her 2.5 dakikada bir otomatik taze tut (Kullanıcı asla beklemesin)
    setInterval(() => {
      this._fetchFreshOutages().catch(() => {});
    }, 2.5 * 60 * 1000);
  }

  /// 👑 PLUS ÜYELERE ÖZEL: Mahalle ve Sokağa Göre Planlı Kesinti Bildirimi
  async pushPlannedOutagesToPlusUsers(activeItems) {
    if (!fcmService.isFcmConfigured()) return;

    const now = Date.now();
    const plannedItems = activeItems.filter((item) => {
      if (!item) return false;
      const isExplicitlyPlanned =
        item.status === 'Planlandı' ||
        String(item.type || '').toUpperCase() === 'PLANLI';
      const isFuture = item.startAt && new Date(item.startAt).getTime() > now;
      return isExplicitlyPlanned || isFuture;
    });

    if (plannedItems.length === 0) return;

    try {
      const plusDevices = await pushTokenService.fetchPlusDeviceTokens();
      if (!plusDevices || plusDevices.length === 0) return;

      for (const outage of plannedItems) {
        const outageId = outage.id || `outage_${outage.title}`;
        const affectedMahalleler = extractAffectedMahalleler(outage);
        const outageBlob = normalizeTr(`${outage.title || ''} ${outage.area || ''} ${outage.subtitle || ''}`);
        const isWater = String(outage.type).toUpperCase() === 'SU';
        const icon = isWater ? '💧' : '⚡';

        // Tarih formatı (ör: 26 Ağustos 09:00 - 17:00)
        let timeLabel = '';
        if (outage.startAt) {
          try {
            const startD = new Date(outage.startAt);
            const endD = outage.endAt ? new Date(outage.endAt) : null;
            const dayStr = startD.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
            const startH = `${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`;
            const endH = endD
              ? `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`
              : '';
            timeLabel = `${dayStr} ${startH}${endH ? ` - ${endH}` : ''}`;
          } catch (_) {}
        }

        for (const device of plusDevices) {
          const token = device.token;
          if (!token) continue;

          if (await outagePushLog.wasPlusPushed(outageId, token)) {
            continue;
          }

          let matched = false;
          let matchedLabel = '';

          // 1. Mahalle Eşleşmesi
          if (device.mahalle && device.mahalle.trim().length > 0) {
            const userMahKey = normalizeTr(device.mahalle);
            for (const m of affectedMahalleler) {
              if (userMahKey.includes(m.key) || m.key.includes(userMahKey)) {
                matched = true;
                matchedLabel = m.name;
                break;
              }
            }
            if (!matched && outageBlob.includes(userMahKey)) {
              matched = true;
              matchedLabel = device.mahalle;
            }
          }

          // 2. Sokak Eşleşmesi
          if (!matched && device.sokak && device.sokak.trim().length > 2) {
            const userSokKey = normalizeTr(device.sokak);
            if (outageBlob.includes(userSokKey)) {
              matched = true;
              matchedLabel = device.sokak;
            }
          }

          // 3. GPS Koordinat Yakınlığı (1.8 km mesafe)
          if (!matched && device.lat && device.lng) {
            for (const m of affectedMahalleler) {
              const dist = haversineKm(device.lat, device.lng, m.lat, m.lng);
              if (dist <= 1.8) {
                matched = true;
                matchedLabel = m.name;
                break;
              }
            }
          }

          if (matched) {
            const pushTitle = `${icon} ${matchedLabel || 'Mahallenizde'}: Planlı Kesinti (Plus)`;
            const pushBody = timeLabel
              ? `📍 ${timeLabel} arasında planlanan bakım kesintisi bildirildi. Önleminizi almayı unutmayın!`
              : `📍 ${outage.title || outage.area}. Planlanan kesinti için önleminizi almayı unutmayın!`;

            console.log(`[outages-plus] Plus üyeye özel kesinti bildirimi gönderiliyor: ${matchedLabel} -> ${token.slice(-8)}`);

            const res = await fcmService.sendToDevice(token, {
              title: pushTitle,
              body: pushBody,
              data: {
                route: 'screen:outages',
                outageId: String(outageId),
                area: String(outage.area || ''),
                isPlus: 'true',
              },
            });

            if (res.success) {
              await outagePushLog.markPlusPushed(outageId, token);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[outages-plus] Plus özel bildirim hatası:', err.message);
    }
  }

  async maybePushNewOutages(activeItems) {
    const fingerprint = activeItems.map((i) => i.id).sort().join('|');
    if (!fingerprint || fingerprint === this._lastFingerprint) return;
    this._lastFingerprint = fingerprint;

    if (!fcmService.isFcmConfigured()) return;

    // 1. Önce Plus üyelere özel mahalle/sokak bildirimlerini gönder
    await this.pushPlannedOutagesToPlusUsers(activeItems);

    // 2. Genel genel konu bildirimi
    for (const item of activeItems.slice(0, 3)) {
      const id = item.id || `outage_${item.title}`;
      if (await outagePushLog.wasPushed(id)) continue;

      const isWater = String(item.type).toUpperCase() === 'SU';
      const title = isWater ? 'Düziçi\'de su kesintisi ⚠️' : 'Düziçi\'de elektrik kesintisi ⚡';
      const body = item.area ? `${item.area}: ${item.title}` : item.title;

      const result = await fcmService.sendToTopic('outages_duzici', {
        title,
        body,
        data: {
          route: 'screen:outages',
          area: String(item.area || ''),
          outageId: id,
        },
      });

      if (result.success) {
        await outagePushLog.markPushed(id);
        console.log(`[outages] push gönderildi: ${item.title}`);
      }
    }
  }

  async _fetchFreshOutages() {
    if (this._isFetching) return this.cache.data;
    this._isFetching = true;

    try {
      const fileService = require('./fileService');
      const newsService = require('./newsService');
      const outageExtractorService = require('./outageExtractorService');

      const [belediye, toroslar, cityData, recentNews] = await Promise.all([
        municipalityAnnouncementScraper.fetchOutageAnnouncements({ max: 40 }),
        toroslarOutageScraper.fetchDuziciOutages(),
        fileService.readCityContent().catch(() => ({})),
        newsService.getNews({ max: 30 }).catch(() => []),
      ]);

      const newsExtractedOutages = [];
      if (Array.isArray(recentNews)) {
        for (const item of recentNews) {
          const text = `${item.title || ''}\n${item.summary || ''}\n${item.fullText || ''}`;
          if (/kesinti|su kesint|elektrik kesint|şebeke bakım|su hattı|ana boru|arıza onarım|sular akmıyor|sular kesilecek|elektrikler kesilecek|toroslar edaş|aski/i.test(text)) {
            try {
              const ext = await outageExtractorService.extractFromText(text);
              if (ext.outages && ext.outages.length > 0) {
                for (const o of ext.outages) {
                  o.source = o.source || item.sourceName || 'Düziçi Yerel Haber';
                  o.announcementUrl = item.sourceUrl || '';
                  newsExtractedOutages.push(o);
                }
              }
            } catch (err) {
              console.warn('[outage-service] Haberden kesinti çıkarırken hata:', err.message);
            }
          }
        }
      }

      const manualOutages = Array.isArray(cityData?.outages) ? cityData.outages : [];
      const merged = mergeOutages([manualOutages, belediye, toroslar, newsExtractedOutages]);
      const now = new Date();
      const nowMs = now.getTime();
      const todayKey = turkeyDateKey();

      // Saati biten kesintiler otomatik olarak Aktif'ten kalkar, Geçmiş'e düşer!
      const active = [];
      const expiredOrHistory = [];

      for (const item of merged) {
        if (!item || !item.title) continue;

        // Eski bozuk/yarım haber kayıtlarını temizle
        if (/Yaylalarda Kesinti Var|3 İlçede|Yaz aylarında/i.test(item.title) || /Yaz aylarında vatandaşların/i.test(item.subtitle || '')) {
          continue;
        }

        if (item.isActive === false || item.status === 'Tamamlandı') {
          expiredOrHistory.push(item);
          continue;
        }

        let isExpired = false;
        if (item.endAt) {
          const endMs = new Date(item.endAt).getTime();
          if (!isNaN(endMs) && endMs < nowMs) {
            isExpired = true;
          }
        } else if (item.startAt) {
          const startMs = new Date(item.startAt).getTime();
          if (!isNaN(startMs) && startMs + 10 * 60 * 60 * 1000 < nowMs) {
            isExpired = true;
          }
        }

        if (isExpired) {
          item.status = 'Tamamlandı';
          expiredOrHistory.push(item);
        } else {
          active.push(item);
        }
      }

      // 1. Aktif / Planlı Kesintiler: En yakın tarihten ileriye doğru sırala
      active.sort((a, b) => {
        const timeA = new Date(a.startAt || a.date || '2099-01-01').getTime();
        const timeB = new Date(b.startAt || b.date || '2099-01-01').getTime();
        return timeA - timeB;
      });

      const activeIds = new Set(active.map((item) => item.id));
      const history = expiredOrHistory
        .filter((item) => {
          if (activeIds.has(item.id)) return false;
          const publishedKey = turkeyDateKey(new Date(item.publishedAt || item.date || Date.now()));
          return daysBetween(publishedKey, todayKey) <= HISTORY_DAYS;
        })
        .sort((a, b) => {
          const timeA = new Date(a.endAt || a.startAt || a.date || 0).getTime();
          const timeB = new Date(b.endAt || b.startAt || b.date || 0).getTime();
          return timeB - timeA;
        });

      await this.maybePushNewOutages(active);

      this.cache.data = active;
      this.cache.history = history;
      this.cache.fetchedAt = Date.now();
      this.cache.source =
        toroslar.length > 0 ? 'belediye+toroslar' : belediye.length > 0 ? 'belediye-duyuru' : 'empty';

      console.info(
        `[outages] ${active.length} aktif, ${history.length} geçmiş güncellendi.`,
      );
      return active;
    } catch (error) {
      console.error('Outage fetch error:', error);
      return this.cache.data;
    } finally {
      this._isFetching = false;
    }
  }

  async getOutages(options = {}) {
    const { forceRefresh = false } = options;
    const cacheAge = Date.now() - this.cache.fetchedAt;
    const hasData = this.cache.data.length > 0;

    // ⚡ Stale-While-Revalidate: Önbellekte veri varsa ANINDA (0 ms) dön,
    // Önbellek eskiyse arka planda sessizce tazele!
    if (!forceRefresh && hasData) {
      if (cacheAge > CACHE_MS) {
        this._fetchFreshOutages().catch(() => {});
      }
      return this.cache.data;
    }

    return await this._fetchFreshOutages();
  }

  getHistory() {
    return this.cache.history || [];
  }
}

module.exports = new OutageService();
