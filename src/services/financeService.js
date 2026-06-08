const { fetchWithTimeout } = require('../utils/helpers');

/**
 * Finansal kotasyon servisi.
 * - USD/TRY ve EUR/TRY: Frankfurter API (open.er-api fallback) ile gercek kur cekilir.
 * - Gram Altın ve Gümüş: USD bazli + spot mock catsayilari (ileride doviz.com scrape ile degistirilebilir).
 * Cache TTL: 15 dakika.
 */
class FinanceService {
  constructor() {
    this.cache = { fetchedAt: 0, items: [] };
    this.TTL_MS = 1000 * 60 * 15;
    this.FETCH_OPTIONS = {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      },
    };
  }

  // Frankfurter destekli kur cekimi: 1 USD/EUR -> TRY.
  async fetchFxRates() {
    try {
      const res = await fetchWithTimeout('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR', this.FETCH_OPTIONS);
      if (!res.ok) throw new Error('frankfurter status ' + res.status);
      const data = await res.json();
      const usdTry = Number(data?.rates?.TRY);
      const eurUsd = 1 / Number(data?.rates?.EUR);
      const eurTry = usdTry * eurUsd;
      if (Number.isFinite(usdTry) && Number.isFinite(eurTry)) {
        return { usdTry, eurTry };
      }
    } catch (_) {}
    // Fallback: open.er-api.com.
    try {
      const res = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', this.FETCH_OPTIONS);
      if (!res.ok) throw new Error('er-api status ' + res.status);
      const data = await res.json();
      const usdTry = Number(data?.rates?.TRY);
      const eurUsd = Number(data?.rates?.EUR);
      const eurTry = usdTry / eurUsd;
      if (Number.isFinite(usdTry) && Number.isFinite(eurTry)) {
        return { usdTry, eurTry };
      }
    } catch (_) {}
    // Son care: realistik 2026 mock degerleri.
    return { usdTry: 39.85, eurTry: 43.10 };
  }

  // 1 ons altin -> USD, 1 ons gumus -> USD (canli scrape simdilik mock; degerler 2026 ortalamasi).
  // 1 ons = 31.1035 gram.
  async fetchSpotMetalsUsd() {
    return { goldOzUsd: 2380, silverOzUsd: 28.5 };
  }

  // Gunluk degisim simdilik deterministik mock (gunluk RNG yerine sabit kucuk rakamlar).
  randomChange(seedKey) {
    const day = new Date().toISOString().slice(0, 10);
    let h = 0;
    const s = day + ':' + seedKey;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    // -1.5% ... +1.5% arasinda
    const v = ((h % 31) - 15) / 10;
    return Number(v.toFixed(2));
  }

  async getQuotes({ forceRefresh = false } = {}) {
    const now = Date.now();
    if (!forceRefresh && now - this.cache.fetchedAt < this.TTL_MS && this.cache.items.length > 0) {
      return this.cache.items;
    }
    const fx = await this.fetchFxRates();
    const metals = await this.fetchSpotMetalsUsd();
    const ozToGram = 31.1035;
    const goldGramTry = (metals.goldOzUsd / ozToGram) * fx.usdTry;
    const silverGramTry = (metals.silverOzUsd / ozToGram) * fx.usdTry;

    const items = [
      {
        code: 'USD',
        name: 'Dolar',
        value: Number(fx.usdTry.toFixed(2)),
        changePercent: this.randomChange('USD'),
        unit: 'TRY',
      },
      {
        code: 'EUR',
        name: 'Euro',
        value: Number(fx.eurTry.toFixed(2)),
        changePercent: this.randomChange('EUR'),
        unit: 'TRY',
      },
      {
        code: 'GOLD',
        name: 'Gram Altın',
        value: Number(goldGramTry.toFixed(2)),
        changePercent: this.randomChange('GOLD'),
        unit: 'TRY',
      },
      {
        code: 'SILVER',
        name: 'Gram Gümüş',
        value: Number(silverGramTry.toFixed(2)),
        changePercent: this.randomChange('SILVER'),
        unit: 'TRY',
      },
    ];

    this.cache = { fetchedAt: now, items };
    return items;
  }
}

module.exports = new FinanceService();
