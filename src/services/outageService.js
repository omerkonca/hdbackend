const municipalityAnnouncementScraper = require('./municipalityAnnouncementScraper');

const CACHE_MS = 30 * 60 * 1000; // 30 dk

class OutageService {
  constructor() {
    this.cache = {
      data: [],
      fetchedAt: 0,
      source: 'belediye-duyuru',
    };
  }

  async getOutages(options = {}) {
    const { forceRefresh = false } = options;
    const cacheValid = Date.now() - this.cache.fetchedAt < CACHE_MS;

    if (!forceRefresh && cacheValid) {
      return this.cache.data;
    }

    try {
      const items = await municipalityAnnouncementScraper.fetchOutageAnnouncements({
        max: 25,
      });
      this.cache.data = items;
      this.cache.fetchedAt = Date.now();
      this.cache.source = items.length > 0 ? 'belediye-duyuru' : 'empty';
      console.info(`[outages] ${items.length} belediye duyurusu`);
      return items;
    } catch (error) {
      console.error('Outage fetch error:', error);
      if (this.cache.data.length > 0 && !forceRefresh) {
        return this.cache.data;
      }
      this.cache.data = [];
      this.cache.fetchedAt = Date.now();
      this.cache.source = 'error';
      return [];
    }
  }
}

module.exports = new OutageService();
