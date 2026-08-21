const municipalityAnnouncementScraper = require('./municipalityAnnouncementScraper');
const toroslarOutageScraper = require('./toroslarOutageScraper');
const fcmService = require('./fcmService');
const outagePushLog = require('../utils/outagePushLog');

const CACHE_MS = 1 * 60 * 1000; // 1 dk taze veri
const HISTORY_DAYS = 7;

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

function mergeOutages(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const item of list) {
      const key = item.id || `${item.sourceKind || 'x'}_${item.title}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
  }
  return [...map.values()];
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
  }

  async maybePushNewOutages(activeItems) {
    const fingerprint = activeItems.map((i) => i.id).sort().join('|');
    if (!fingerprint || fingerprint === this._lastFingerprint) return;
    this._lastFingerprint = fingerprint;

    if (!fcmService.isFcmConfigured()) return;

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

  async getOutages(options = {}) {
    const { forceRefresh = false } = options;
    const cacheValid = Date.now() - this.cache.fetchedAt < CACHE_MS;

    if (!forceRefresh && cacheValid) {
      return this.cache.data;
    }

    try {
      const fileService = require('./fileService');
      const newsService = require('./newsService');
      const outageExtractorService = require('./outageExtractorService');

      const [belediye, toroslar, cityData] = await Promise.all([
        municipalityAnnouncementScraper.fetchOutageAnnouncements({ max: 40 }),
        toroslarOutageScraper.fetchDuziciOutages(),
        fileService.readCityContent().catch(() => ({})),
      ]);

      const manualOutages = Array.isArray(cityData?.outages) ? cityData.outages : [];
      const merged = mergeOutages([manualOutages, belediye, toroslar]);
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
          // Bitiş saati bilinmiyorsa başlangıçtan 10 saat sonra sona ermiş kabul edilir
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

      const activeIds = new Set(active.map((item) => item.id));
      const history = expiredOrHistory.filter((item) => {
        if (activeIds.has(item.id)) return false;
        const publishedKey = turkeyDateKey(new Date(item.publishedAt || item.date || Date.now()));
        return daysBetween(publishedKey, todayKey) <= HISTORY_DAYS;
      });

      await this.maybePushNewOutages(active);

      this.cache.data = active;
      this.cache.history = history;
      this.cache.fetchedAt = Date.now();
      this.cache.source =
        toroslar.length > 0 ? 'belediye+toroslar' : belediye.length > 0 ? 'belediye-duyuru' : 'empty';

      console.info(
        `[outages] ${active.length} aktif, ${history.length} geçmiş (saati geçenler geçmişe taşındı)`,
      );
      return active;
    } catch (error) {
      console.error('Outage fetch error:', error);
      if (this.cache.data.length > 0 && !forceRefresh) {
        return this.cache.data;
      }
      this.cache.data = [];
      this.cache.history = [];
      this.cache.fetchedAt = Date.now();
      this.cache.source = 'error';
      return [];
    }
  }

  getHistory() {
    return this.cache.history || [];
  }
}

module.exports = new OutageService();
