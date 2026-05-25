const config = require('../config');
const { normalizeText, normalizeForCompare } = require('../utils/helpers');

class PharmacyService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      pharmacies: [],
    };
  }

  parseDutyPharmacyHtml(html) {
    const bugunStartIdx = html.indexOf('id="nav-bugun"');
    if (bugunStartIdx === -1) {
      throw new Error('id="nav-bugun" bulunamadı.');
    }

    const tableEndIdx = html.indexOf('</table>', bugunStartIdx);
    if (tableEndIdx === -1) {
      throw new Error('Tablo bitişi bulunamadı.');
    }

    const bugunHtml = html.substring(bugunStartIdx, tableEndIdx);

    // Tarih aralığını parse et
    const rangeRegex = /class=["']d-flex alert alert-warning[^>]*>([\s\S]*?)<\/div>/i;
    const rangeMatch = bugunHtml.match(rangeRegex);
    const dateRange = rangeMatch ? normalizeText(rangeMatch[1]) : '';

    const nameRegex = /<span class=["']isim["']>([^<]+)<\/span>/g;
    const all = [];
    let nameMatch;

    while ((nameMatch = nameRegex.exec(bugunHtml)) !== null) {
      const name = normalizeText(nameMatch[1]);
      const nameIdx = nameMatch.index;

      const rest = bugunHtml.substring(nameIdx);
      const detailRegex = /class=['"]col-lg-6['"]>([\s\S]*?)<\/div>[\s\S]*?class=['"]col-lg-3[^'"]*['"]>([\s\S]*?)<\/div>/;
      const detailMatch = rest.match(detailRegex);

      if (detailMatch) {
        const address = normalizeText(detailMatch[1]);
        const phone = normalizeText(detailMatch[2]);
        all.push({
          dateLabel: 'Bugün',
          dateRange,
          name,
          address,
          phone,
        });
      }
    }

    return all;
  }

  async scrapeDutyPharmacies() {
    const response = await fetch(config.PHARMACY.URL, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      },
    });
    if (!response.ok) {
      throw new Error(`Kaynak sayfa alinamadi: ${response.status}`);
    }
    const html = await response.text();
    const pharmacies = this.parseDutyPharmacyHtml(html);
    if (pharmacies.length === 0) {
      throw new Error('Eczane verisi parse edilemedi.');
    }
    return pharmacies;
  }

  async getDutyPharmacies({ forceRefresh = false } = {}) {
    const now = Date.now();
    const isFresh = now - this.cache.fetchedAt < config.PHARMACY.CACHE_TTL_MS;
    if (!forceRefresh && isFresh && this.cache.pharmacies.length > 0) {
      return this.cache.pharmacies;
    }
    const pharmacies = await this.scrapeDutyPharmacies();
    this.cache = {
      fetchedAt: now,
      pharmacies,
    };
    return pharmacies;
  }
}

module.exports = new PharmacyService();
