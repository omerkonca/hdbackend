const municipalityAnnouncementScraper = require('./municipalityAnnouncementScraper');
const roadClosureStore = require('./roadClosureStore');
const { isValidRoadClosureRecord } = require('./roadClosureFilters');

class RoadClosureSyncService {
  constructor() {
    this.lastSyncAt = 0;
    this.cache = { data: [], fetchedAt: 0 };
    this.syncing = false;
  }

  async _collectLive() {
    const belediye = await municipalityAnnouncementScraper.fetchRoadRelatedAnnouncements({
      max: 20,
    });

    return belediye.filter((item) =>
      isValidRoadClosureRecord({
        title: item.title,
        subtitle: item.subtitle,
        source: item.source,
        kind: item.kind,
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
      await roadClosureStore.save(state);

      const list = roadClosureStore.toPublicList(state);
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
      const list = roadClosureStore.toPublicList(state);
      this.cache = { data: list, fetchedAt: Date.now() };
      return list;
    } finally {
      this.syncing = false;
    }
  }

  async getRoadClosures(options = {}) {
    return this.sync({ force: options.forceRefresh === true });
  }
}

module.exports = new RoadClosureSyncService();
