const fileService = require('./fileService');

/**
 * Akaryakit fiyat servisi.
 * Sirayla:
 *   1) Canli scrape: doviz.com -> goyakit.com -> akaryakit.org
 *   2) city_content.json -> fuel.prices (admin override)
 *   3) Realistik fallback (Nisan 2026 ortalamasi)
 *
 * Cache TTL: 60 dakika.
 */
class FuelService {
  constructor() {
    this.cache = { fetchedAt: 0, items: [], source: '' };
    this.TTL_MS = 1000 * 60 * 60;
    this.HEADERS = {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      'accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8',
    };
  }

  async getPrices({ forceRefresh = false } = {}) {
    const now = Date.now();
    if (!forceRefresh && now - this.cache.fetchedAt < this.TTL_MS && this.cache.items.length > 0) {
      return this.cache.items;
    }

    let items = null;
    let source = '';

    // 1) Admin override (city_content.json)
    try {
      const data = await fileService.readCityContent();
      const fromJson = Array.isArray(data?.fuel?.prices) ? data.fuel.prices : null;
      if (fromJson && fromJson.length > 0) {
        const adminItems = fromJson
          .filter((p) => p && p.code && Number.isFinite(Number(p.price)))
          .map((p) => ({
            code: String(p.code).toUpperCase(),
            name: String(p.name || ''),
            price: Number(p.price),
            unit: String(p.unit || 'TL/L'),
          }));
        if (adminItems.length > 0) {
          items = adminItems;
          source = 'admin';
        }
      }
    } catch (_) {}

    // 2) Canli scrape (admin override yoksa)
    if (!items) {
      const scrapers = [
        () => this.scrapeFromDoviz(),
        () => this.scrapeFromGoYakit(),
        () => this.scrapeFromAkaryakitOrg(),
      ];
      for (const fn of scrapers) {
        try {
          const result = await fn();
          if (result && result.length === 3) {
            items = result;
            source = result.__source || 'scrape';
            break;
          }
        } catch (_) {}
      }
    }

    // 3) Fallback (guncel ortalama)
    if (!items || items.length === 0) {
      items = this.fallbackPrices();
      source = 'fallback';
    }

    const prevItems = this.cache.items || [];
    const enriched = items.map((item) => {
      const prev = prevItems.find((p) => p.code === item.code);
      if (!prev || !Number.isFinite(prev.price)) {
        return { ...item, change: null, previousPrice: null };
      }
      const change = Number((item.price - prev.price).toFixed(2));
      return {
        ...item,
        change: change === 0 ? null : change,
        previousPrice: prev.price,
      };
    });

    this.cache = { fetchedAt: now, items: enriched, source };
    return enriched;
  }

  fallbackPrices() {
    return [
      { code: 'GASOLINE', name: 'Benzin', price: 65.40, unit: 'TL/L' },
      { code: 'DIESEL', name: 'Motorin', price: 73.47, unit: 'TL/L' },
      { code: 'LPG', name: 'LPG', price: 35.94, unit: 'TL/L' },
    ];
  }

  async fetchHtml(url) {
    const res = await fetch(url, {
      method: 'GET',
      headers: this.HEADERS,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  }

  parseTrNumber(s) {
    if (!s) return NaN;
    return parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  }

  buildItems(gasoline, diesel, lpg) {
    if (![gasoline, diesel, lpg].every((v) => Number.isFinite(v) && v > 0)) return null;
    return [
      { code: 'GASOLINE', name: 'Benzin', price: Number(gasoline.toFixed(2)), unit: 'TL/L' },
      { code: 'DIESEL', name: 'Motorin', price: Number(diesel.toFixed(2)), unit: 'TL/L' },
      { code: 'LPG', name: 'LPG', price: Number(lpg.toFixed(2)), unit: 'TL/L' },
    ];
  }

  /**
   * doviz.com Osmaniye sayfasi.
   * Aranan kalip: "ortalama benzin fiyati 65,29 lira, motorin fiyati 73,42 lira, LPG fiyati 35,00 liradir"
   */
  async scrapeFromDoviz() {
    const html = await this.fetchHtml('https://www.doviz.com/akaryakit-fiyatlari/osmaniye');
    const m = html.match(
      /ortalama\s+benzin\s+fiyat[ıi]\s+([\d.,]+)\s+lira[,\s]+motorin\s+fiyat[ıi]\s+([\d.,]+)\s+lira[,\s]+LPG\s+fiyat[ıi]\s+([\d.,]+)\s+lira/i,
    );
    if (m) {
      const items = this.buildItems(
        this.parseTrNumber(m[1]),
        this.parseTrNumber(m[2]),
        this.parseTrNumber(m[3]),
      );
      if (items) {
        items.__source = 'doviz.com';
        return items;
      }
    }
    return null;
  }

  /**
   * goyakit.com.tr - Osmaniye / Duzici satiri.
   * Ornek: "Osmaniye / Düziçi | 65.40 | 73.47 | 35.94"
   */
  async scrapeFromGoYakit() {
    const html = await this.fetchHtml('https://www.goyakit.com.tr/osmaniye-guncel-akaryakit-otogaz-fiyatlari');
    const re = /Düzi[cç]i[\s\S]{0,400}?([\d.,]+)[\s\S]{1,80}?([\d.,]+)[\s\S]{1,80}?([\d.,]+)/i;
    const m = html.match(re);
    if (m) {
      const items = this.buildItems(
        this.parseTrNumber(m[1]),
        this.parseTrNumber(m[2]),
        this.parseTrNumber(m[3]),
      );
      if (items) {
        items.__source = 'goyakit.com.tr';
        return items;
      }
    }
    return null;
  }

  /**
   * akaryakit.org Osmaniye sayfasi - GO firmasi satirini parse eder.
   * Sutun sirasi: BENZIN | OTOGAZ(LPG) | MOTORIN
   */
  async scrapeFromAkaryakitOrg() {
    const html = await this.fetchHtml('https://akaryakit.org/osmaniye-akaryakit-fiyatlari');
    const re = />\s*GO\s*<[\s\S]{0,300}?([\d.,]+)\s*₺[\s\S]{0,200}?([\d.,]+)\s*₺[\s\S]{0,200}?([\d.,]+)\s*₺/i;
    const m = html.match(re);
    if (m) {
      const benzin = this.parseTrNumber(m[1]);
      const lpg = this.parseTrNumber(m[2]);
      const motorin = this.parseTrNumber(m[3]);
      const items = this.buildItems(benzin, motorin, lpg);
      if (items) {
        items.__source = 'akaryakit.org';
        return items;
      }
    }
    return null;
  }

  getCacheInfo() {
    return {
      fetchedAt: this.cache.fetchedAt,
      itemCount: this.cache.items.length,
      source: this.cache.source,
      ageMinutes: this.cache.fetchedAt
        ? Math.round((Date.now() - this.cache.fetchedAt) / 60000)
        : null,
    };
  }
}

module.exports = new FuelService();
