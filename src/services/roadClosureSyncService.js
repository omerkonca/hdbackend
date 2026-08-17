const municipalityAnnouncementScraper = require('./municipalityAnnouncementScraper');
const osmaniyeMunicipalityScraper = require('./osmaniyeMunicipalityScraper');
const kgmRoadClosureScraper = require('./kgmRoadClosureScraper');
const roadClosureStore = require('./roadClosureStore');
const { isValidRoadClosureRecord } = require('./roadClosureFilters');
const { loadBaseline } = require('./roadClosureBaseline');

class RoadClosureSyncService {
  constructor() {
    this.lastSyncAt = 0;
    this.cache = { data: [], fetchedAt: 0 };
    this.syncing = false;
  }

  async _collectLive() {
    const newsService = require('./newsService');
    const outageExtractorService = require('./outageExtractorService');

    const [duziciBel, osmaniyeBel, kgm, baseline] = await Promise.all([
      municipalityAnnouncementScraper.fetchRoadRelatedAnnouncements({ max: 25 }),
      osmaniyeMunicipalityScraper.fetchRoadRelatedAnnouncements({ max: 15 }),
      kgmRoadClosureScraper.fetchRelevantClosures(),
      loadBaseline(),
    ]);

    let newsExtractedRoads = [];
    try {
      const recentNews = await newsService.getNews({ max: 15 });
      for (const item of recentNews) {
        const text = `${item.title} ${item.summary || ''}`;
        if (/yol yap|asfalt|trafiğe kapat|şerit daral|menfez|kilit parke/i.test(text)) {
          const ext = await outageExtractorService.extractFromText(text);
          if (ext.roadClosures?.length) {
            newsExtractedRoads.push(...ext.roadClosures);
          }
        }
      }
    } catch (_) {}

    const byKey = new Map();
    const mergeKey = (item) => {
      const t = `${item.title} ${item.subtitle || ''}`.toLocaleLowerCase('tr-TR');
      if (t.includes('trafik komisyon')) return 'trafik-komisyon';
      if (t.includes('yenileniyor') && (t.includes('erdogan') || t.includes('erdoğan'))) {
        return 'rte-bulvari';
      }
      if (t.includes('uzunban') && t.includes('asfalt')) {
        return 'belediye-uzunbani-asfalt';
      }
      if (item.kind === 'kgm' && item.kgmMeta?.kkNo) {
        return `kgm-${item.kgmMeta.kkNo}`;
      }
      // Liste sayfası fingerprint'lerini title'a indir
      const fp = `${item.fingerprint || item.id || ''}`;
      if (/^belediye_(duyurular|haberler)$/i.test(fp)) {
        return `belediye_${(item.title || '')
          .toLocaleLowerCase('tr-TR')
          .replace(/[^a-z0-9çğıöşü]+/gi, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 48)}`;
      }
      return item.fingerprint || item.id;
    };

    const score = (item) => {
      let s = 0;
      const url = item.announcementUrl || '';
      if (url && /\/(duyurular|haberler)\/[^/]+/i.test(url)) s += 3;
      if (item.kind === 'kgm') s += 2;
      if (item.autoManaged === false) s += 5;
      if ((item.subtitle || '').length > 40) s += 1;
      return s;
    };

    const sources = [...baseline, ...kgm, ...duziciBel, ...osmaniyeBel, ...newsExtractedRoads];
    for (const item of sources) {
      const key = mergeKey(item);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        continue;
      }
      if (existing.autoManaged === false) continue;
      if (item.autoManaged === false || item.kind === 'kgm' || score(item) > score(existing)) {
        byKey.set(key, item);
      }
    }

    return Array.from(byKey.values()).filter((item) =>
      isValidRoadClosureRecord({
        title: item.title,
        subtitle: item.subtitle,
        source: item.source,
        kind: item.kind,
        lat: item.lat,
        lng: item.lng,
      }),
    );
  }

  _filterPublicList(list) {
    return list.filter((item) =>
      isValidRoadClosureRecord({
        title: item.title,
        subtitle: item.subtitle,
        source: item.source,
        kind: item.kind,
        lat: item.lat,
        lng: item.lng,
      }),
    );
  }

  async sync({ force = false } = {}) {
    const minInterval = 3 * 60 * 1000;
    if (!force && Date.now() - this.lastSyncAt < minInterval) {
      return this.cache.data;
    }
    if (this.syncing) return this.cache.data;

    this.syncing = true;
    try {
      const live = await this._collectLive();
      let state = await roadClosureStore.sync(live, { missedThreshold: 1 });
      state = roadClosureStore.applyLifecycle(state);
      state = { ...state, items: roadClosureStore._filterValidItems(state.items) };
      await roadClosureStore.save(state);

      const list = this._filterPublicList(roadClosureStore.toPublicList(state));
      this.cache = { data: list, fetchedAt: Date.now() };
      this.lastSyncAt = Date.now();
      console.log(
        `[road-closures] otomatik sync: ${list.filter((i) => (i.status || '').includes('Devam')).length} aktif / ${list.length} toplam`,
      );
      return list;
    } catch (err) {
      console.error('[road-closures] sync failed:', err.message);
      if (this.cache.data.length > 0) return this.cache.data;
      const state = roadClosureStore.applyLifecycle(await roadClosureStore.load());
      const list = this._filterPublicList(roadClosureStore.toPublicList(state));
      this.cache = { data: list, fetchedAt: Date.now() };
      return list;
    } finally {
      this.syncing = false;
    }
  }

  async getRoadClosures(options = {}) {
    const list = await this.sync({ force: options.forceRefresh === true });
    return this._filterPublicList(list);
  }
}

module.exports = new RoadClosureSyncService();
