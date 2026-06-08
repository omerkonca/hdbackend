const config = require('../config');
const { fetchWithTimeout } = require('../utils/helpers');

class PrayerService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      data: null,
    };
    this.CACHE_TTL_MS = 6 * 60 * 60 * 1000; // Cache for 6 hours
  }

  async getPrayerTimes() {
    const now = Date.now();
    const isFresh = now - this.cache.fetchedAt < this.CACHE_TTL_MS;
    
    if (isFresh && this.cache.data) {
      return this.cache.data;
    }

    try {
      console.log('[prayer-service] Fetching fresh prayer times from Aladhan API...');
      const response = await fetchWithTimeout(
        'https://api.aladhan.com/v1/timingsByCity?city=Duzici&country=Turkey&method=13'
      );
      if (!response.ok) {
        throw new Error(`Aladhan API response status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result && result.data) {
        this.cache = {
          fetchedAt: now,
          data: result.data,
        };
        return result.data;
      }
      
      throw new Error('Invalid Aladhan API response format.');
    } catch (error) {
      console.error('❌ Failed to fetch prayer times from Aladhan:', error.message);
      // Fallback to stale cache if available, or throw
      if (this.cache.data) {
        console.log('[prayer-service] Returning cached stale prayer times.');
        return this.cache.data;
      }
      throw error;
    }
  }
}

module.exports = new PrayerService();
