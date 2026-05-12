const fileService = require('./fileService');

/**
 * Keşfet verisi tek kaynak olarak assets/data/city_content.json içindeki explore bölümünden okunur.
 */
class DiscoverService {
  async getDiscoverData() {
    const city = await fileService.readCityContent();
    const ex = city.explore || {};
    return {
      categories: Array.isArray(ex.categories) ? ex.categories : [],
      suggestions: Array.isArray(ex.suggestions) ? ex.suggestions : [],
    };
  }

  async searchPlaces(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return [];

    const { categories } = await this.getDiscoverData();
    const results = [];
    const seen = new Set();

    const keyOf = (place) => `${place.name || ''}|${place.address || ''}`;

    categories.forEach((cat) => {
      (cat.places || []).forEach((place) => {
        const hay = `${place.name || ''} ${place.shortDescription || ''} ${place.detail || ''} ${place.tag || ''}`.toLowerCase();
        if (!hay.includes(q)) return;
        const key = keyOf(place);
        if (seen.has(key)) return;
        seen.add(key);
        results.push(place);
      });
    });

    return results;
  }
}

module.exports = new DiscoverService();
