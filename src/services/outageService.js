const config = require('../config');

class OutageService {
  constructor() {
    this.cache = {
      data: [
        {
          title: "İrfanlı Mah. Su Kesintisi",
          subtitle: "Ana boru arızası nedeniyle akşam 20:00'ye kadar.",
          type: "SU",
          status: "Devam Ediyor",
          date: new Date().toISOString()
        },
        {
          title: "Cumhuriyet Mah. Elektrik Kesintisi",
          subtitle: "Şebeke yenileme çalışması (09:00 - 13:00).",
          type: "ELEKTRİK",
          status: "Tamamlandı",
          date: new Date().toISOString()
        }
      ],
      fetchedAt: Date.now()
    };
  }

  async getOutages(options = {}) {
    const { forceRefresh = false } = options;
    const cacheValid = (Date.now() - this.cache.fetchedAt) < 30 * 60 * 1000; // 30 mins

    if (!forceRefresh && cacheValid) {
      return this.cache.data;
    }

    // Gercek hayatta burada Toroslar EDAS veya ASKİ/OSKİ scraper'i calisir.
    // Simdilik backend seviyesinde dinamik bir yapi kuruyoruz.
    try {
      // Örnek: const response = await axios.get('OFFICIAL_SOURCE_URL');
      // this.cache.data = this.parseOutages(response.data);
      this.cache.fetchedAt = Date.now();
      return this.cache.data;
    } catch (error) {
      console.error('Outage fetch error:', error);
      return this.cache.data; // Hata durumunda cache'deki eski veriyi don
    }
  }
}

module.exports = new OutageService();
