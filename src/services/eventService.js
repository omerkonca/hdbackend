const cheerio = require('cheerio');
const { getTagValue, stripHtml, extractImageUrlFromHtml, fetchWithTimeout } = require('../utils/helpers');
const fileService = require('./fileService');

class EventService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      items: [],
    };
    this.CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
    this.CITIES = ['Osmaniye', 'Adana', 'Hatay', 'Gaziantep', 'Kahramanmaraş'];
  }

  async scrapeBubiletEvents(cityName) {
    const slug = cityName.toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    
    const url = `https://www.bubilet.com.tr/${slug}`;
    
    try {
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const events = [];

      $('a.group.flex.h-full.flex-col').each((i, el) => {
        const title = $(el).find('h3').text().trim();
        const location = $(el).find('p').first().text().trim();
        const dateText = $(el).find('p').eq(1).text().trim(); // örn: 01 Mayıs Paz 22:00
        const price = $(el).find('span').text().trim() || 'Biletli';
        const imageUrl = $(el).find('img').attr('src');
        const link = 'https://www.bubilet.com.tr' + $(el).attr('href');

        if (title && dateText) {
          // Basit tarih parse (yılı 2026 varsayıyoruz)
          const parts = dateText.split(' ');
          const day = parts[0];
          const monthStr = parts[1];
          const time = parts[3];
          
          const months = { 'Ocak': 0, 'Şubat': 1, 'Mart': 2, 'Nisan': 3, 'Mayıs': 4, 'Haziran': 5, 'Temmuz': 6, 'Ağustos': 7, 'Eylül': 8, 'Ekim': 9, 'Kasım': 10, 'Aralık': 11 };
          const month = months[monthStr] || 4;
          
          const eventDate = new Date(2026, month, parseInt(day), 21, 0); // Varsayılan 21:00

          events.push({
            id: `bubilet-${slug}-${i}-${Date.now()}`,
            title,
            category: this.inferCategory(title),
            city: cityName,
            district: location.split(',')[0].trim(),
            location: location,
            date: eventDate.toISOString(),
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14',
            price: price.includes('TL') ? price : 'Biletli',
            link,
            source: 'Bubilet'
          });
        }
      });

      return events;
    } catch (error) {
      console.error(`[EventService] Bubilet error for ${cityName}:`, error.message);
      return [];
    }
  }

  async scrapeGoogleNewsEvents(cityName) {
    const query = encodeURIComponent(`${cityName} konser etkinlik festival 2026`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=tr&gl=TR&ceid=TR:tr`;
    
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) return [];

      const xml = await response.text();
      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      
      return itemBlocks.map((item, index) => {
        const title = getTagValue(item, 'title');
        const link = getTagValue(item, 'link');
        const pubDate = getTagValue(item, 'pubDate');
        const imageUrl = extractImageUrlFromHtml(getTagValue(item, 'description'));

        return {
          id: `news-event-${cityName}-${index}-${Date.now()}`,
          title: title.split(' - ')[0],
          category: this.inferCategory(title),
          city: cityName,
          district: 'Merkez',
          location: cityName,
          date: new Date(pubDate).toISOString(),
          imageUrl: imageUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4',
          price: 'Biletli',
          link,
          source: 'Haber Kaynağı'
        };
      });
    } catch (error) {
      console.error(`[EventService] Error scraping news for ${cityName}:`, error.message);
      return [];
    }
  }

  inferCategory(title) {
    const t = title.toLowerCase();
    if (t.includes('konser') || t.includes('festival')) return 'Konser';
    if (t.includes('tiyatro') || t.includes('oyun')) return 'Tiyatro';
    if (t.includes('sergi')) return 'Sergi';
    return 'Kültür & Sanat';
  }

  async getEvents({ forceRefresh = false } = {}) {
    const now = Date.now();
    const isFresh = now - this.cache.fetchedAt < this.CACHE_TTL_MS;

    if (!forceRefresh && isFresh && this.cache.items.length > 0) {
      return this.cache.items;
    }

    try {
      console.log('[EventService] Refreshing events from sources...');
      const newsEvents = [];
      const bubiletEvents = [];

      for (const city of this.CITIES) {
        try {
          // News scraper
          const items = await this.scrapeGoogleNewsEvents(city);
          newsEvents.push(...items.slice(0, 5));

          // Bubilet scraper
          const bItems = await this.scrapeBubiletEvents(city);
          bubiletEvents.push(...bItems);
        } catch (cityErr) {
          console.warn(`[EventService] Skipping city ${city} due to error:`, cityErr.message);
        }
      }

      let manualEvents = [];
      try {
        const content = await fileService.readCityContent();
        if (content && Array.isArray(content.customEvents) && content.customEvents.length > 0) {
          manualEvents = content.customEvents;
        } else {
          manualEvents = this.getManualEvents();
        }
      } catch (err) {
        console.error('[EventService] Error loading custom events:', err.message);
        manualEvents = this.getManualEvents();
      }
      const allItems = [...manualEvents, ...bubiletEvents, ...newsEvents];

      const seen = new Set();
      const uniqueItems = allItems.filter(e => {
        const normalizedTitle = e.title.toLowerCase()
          .replace(/konseri/gi, '')
          .replace(/etkinliği/gi, '')
          .trim();
        const key = `${normalizedTitle}-${e.city}-${new Date(e.date).getDate()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      uniqueItems.sort((a, b) => new Date(a.date) - new Date(b.date));

      this.cache = {
        fetchedAt: now,
        items: uniqueItems,
      };
      return uniqueItems;
    } catch (error) {
      console.error('❌ EventService global error:', error.message);
      // Fallback: Just return manual events if everything else fails
      return this.getManualEvents();
    }
  }

  getManualEvents() {
    const events = [];
    
    // MAYIS 2026
    const mayEvents = [
      { city: 'Osmaniye', title: 'Düziçi Yöresel Ürünler Pazarı', cat: 'Festival', date: '2026-05-01T09:00:00Z', loc: 'Belediye Meydanı' },
      { city: 'Osmaniye', title: 'Osmaniye Doğa Yürüyüşü', cat: 'Spor', date: '2026-05-01T08:00:00Z', loc: 'Zorkun Yaylası' },
      { city: 'Adana', title: 'Madrigal Konseri', cat: 'Konser', date: '2026-05-01T21:00:00Z', loc: '01 Burda PGM' },
      { city: 'Adana', title: 'Gökhan Türkmen Konseri', cat: 'Konser', date: '2026-05-08T21:00:00Z', loc: '01 Burda PGM' },
      { city: 'Gaziantep', title: 'Duman Konseri', cat: 'Konser', date: '2026-05-13T21:00:00Z', loc: 'GAÜN Mavera KSM' },
      { city: 'Adana', title: 'Duman Konseri', cat: 'Konser', date: '2026-05-14T21:00:00Z', loc: 'Çukurova Üniv. Açıkhava' },
      { city: 'Hatay', title: 'Madrigal Konseri', cat: 'Konser', date: '2026-05-03T21:00:00Z', loc: 'Hatay Kalyon Live' },
      { city: 'Kahramanmaraş', title: 'Maraş Kültür Buluşması', cat: 'Kültür & Sanat', date: '2026-05-02T10:00:00Z', loc: 'Valilik Meydanı' },
      { city: 'Gaziantep', title: 'Antep Gastronomi Günü', cat: 'Festival', date: '2026-05-04T11:00:00Z', loc: 'Festival Park' },
      { city: 'Kahramanmaraş', title: 'Maraş Dondurma Festivali', cat: 'Festival', date: '2026-05-12T10:00:00Z', loc: 'Müftülük Meydanı' },
      { city: 'Osmaniye', title: 'Hastalık Hastası - Tiyatro', cat: 'Tiyatro', date: '2026-05-15T20:00:00Z', loc: 'Cebelibereket KM' },
      { city: 'Adana', title: 'Duman Konseri', cat: 'Konser', date: '2026-05-18T21:00:00Z', loc: 'Çukurova Açıkhava' },
      { city: 'Gaziantep', title: 'Zeynep Bastık', cat: 'Konser', date: '2026-05-22T21:00:00Z', loc: 'Festival Park' },
      { city: 'Adana', title: 'Adana Lezzet Festivali', cat: 'Festival', date: '2026-05-25T11:00:00Z', loc: 'Merkez Park' },
      { city: 'Osmaniye', title: 'Korkut Ata Bahar Şenliği', cat: 'Festival', date: '2026-05-28T14:00:00Z', loc: 'OKÜ Kampüsü' },
      { city: 'Kahramanmaraş', title: 'Edeler Buluşması', cat: 'Kültür & Sanat', date: '2026-05-30T18:00:00Z', loc: 'KAFUM' },
    ];

    // HAZİRAN 2026
    const juneEvents = [
      { city: 'Adana', title: 'Sertab Erener', cat: 'Konser', date: '2026-06-03T21:00:00Z', loc: '01 Burda PGM' },
      { city: 'Gaziantep', title: 'Cem Adrian', cat: 'Konser', date: '2026-06-05T21:00:00Z', loc: 'GAÜN Mavera' },
      { city: 'Hatay', title: 'İskenderun Deniz Festivali', cat: 'Festival', date: '2026-06-10T10:00:00Z', loc: 'Sahil Şeridi' },
      { city: 'Osmaniye', title: 'Yaz Sinemaları: Eşkıya', cat: 'Kültür & Sanat', date: '2026-06-12T20:30:00Z', loc: 'Masal Park' },
      { city: 'Adana', title: 'Adamlar Konseri', cat: 'Konser', date: '2026-06-15T21:00:00Z', loc: 'Hayal Kahvesi' },
      { city: 'Gaziantep', title: 'Sunay Akın Anlatısı', cat: 'Kültür & Sanat', date: '2026-06-18T20:00:00Z', loc: 'Şahinbey KM' },
      { city: 'Kahramanmaraş', title: 'Göksun Yayla Şenlikleri', cat: 'Festival', date: '2026-06-20T11:00:00Z', loc: 'Göksun Meydanı' },
      { city: 'Hatay', title: 'Karsu Konseri', cat: 'Konser', date: '2026-06-25T21:00:00Z', loc: 'Expo Antakya' },
      { city: 'Osmaniye', title: 'Voleybol Turnuvası Finali', cat: 'Spor', date: '2026-06-28T19:00:00Z', loc: 'Tosyalı Spor Kompleksi' },
    ];

    // TEMMUZ 2026
    const julyEvents = [
      { city: 'Adana', title: 'Yüzyüzeyken Konuşuruz', cat: 'Konser', date: '2026-07-02T21:00:00Z', loc: 'Çukurova Açıkhava' },
      { city: 'Gaziantep', title: 'GastroAntep Çocuk Atölyesi', cat: 'Kültür & Sanat', date: '2026-07-05T14:00:00Z', loc: 'Mutfak Sanatları Merkezi' },
      { city: 'Osmaniye', title: 'Zorkun Yaylası Şenlikleri', cat: 'Festival', date: '2026-07-10T10:00:00Z', loc: 'Zorkun Yaylası' },
      { city: 'Hatay', title: 'Mabel Matiz', cat: 'Konser', date: '2026-07-15T21:00:00Z', loc: 'İskenderun Açıkhava' },
      { city: 'Kahramanmaraş', title: 'Afşin Eshab-ı Kehf Etkinlikleri', cat: 'Festival', date: '2026-07-20T10:00:00Z', loc: 'Afşin' },
      { city: 'Adana', title: 'Yaz Konserleri: Fatma Turgut', cat: 'Konser', date: '2026-07-25T21:00:00Z', loc: 'Merkez Park' },
    ];

    const all = [...mayEvents, ...juneEvents, ...julyEvents];
    
    return all.map((e, i) => ({
      id: `manual-${i}-${Date.now()}`,
      title: e.title,
      category: e.cat,
      city: e.city,
      district: 'Merkez',
      location: e.loc,
      date: e.date,
      imageUrl: this.getImageForCategory(e.cat),
      price: e.cat === 'Festival' || e.cat === 'Kültür & Sanat' ? 'Ücretsiz' : '450 TL',
      link: 'https://www.biletix.com',
      source: 'Küratör'
    }));
  }

  getImageForCategory(cat) {
    const map = {
      'Konser': 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&q=80',
      'Festival': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=80',
      'Tiyatro': 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=400&q=80',
      'Spor': 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
      'Kültür & Sanat': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&q=80'
    };
    return map[cat] || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&q=80';
  }
}

module.exports = new EventService();
