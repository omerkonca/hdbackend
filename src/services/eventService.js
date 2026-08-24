const cheerio = require('cheerio');
const config = require('../config');
const { getTagValue, stripHtml, extractImageUrlFromHtml, fetchWithTimeout } = require('../utils/helpers');
const fileService = require('./fileService');

class EventService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      items: [],
    };
    this.CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (full server)
    this.CITIES = ['Osmaniye', 'Adana', 'Hatay', 'Gaziantep', 'Kahramanmaraş'];
  }

  getCacheTtlMs() {
    if (config.RUNTIME?.LIGHT_BACKGROUND_JOBS) {
      return 30 * 60 * 1000; // Render: 30 dk
    }
    return this.CACHE_TTL_MS;
  }

  invalidateCache() {
    this.cache = { fetchedAt: 0, items: [] };
  }

  normalizeEventImageUrl(url, maxWidth = 480) {
    let u = String(url || '').trim();
    if (!u) return u;
    if (u.startsWith('//')) u = `https:${u}`;
    if (u.startsWith('/')) u = `https://www.bubilet.com.tr${u}`;
    if (u.includes('cdn.bubilet.com.tr/cdn-cgi/image/')) {
      return u.replace(/width=\d+/, `width=${maxWidth}`);
    }
    if (u.includes('images.unsplash.com') && !/[?&]w=/.test(u)) {
      return `${u}${u.includes('?') ? '&' : '?'}w=${maxWidth}&q=80&auto=format`;
    }
    return u;
  }

  extractBubiletImageUrl($el) {
    const img = $el.find('img').first();
    const direct =
      img.attr('src') ||
      img.attr('data-src') ||
      img.attr('data-nimg') ||
      '';
    if (direct && !direct.startsWith('data:')) {
      return this.normalizeEventImageUrl(direct);
    }

    const srcset = img.attr('srcset') || $el.find('source').attr('srcset') || '';
    const first = String(srcset).split(',')[0]?.trim().split(/\s+/)[0] || '';
    return first ? this.normalizeEventImageUrl(first) : '';
  }

  parseBubiletDate(dateText) {
    const parts = String(dateText || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;

    const day = parseInt(parts[0], 10);
    if (!Number.isFinite(day) || day < 1 || day > 31) return null;

    const monthKey = parts[1]
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    const months = {
      ocak: 0, subat: 1, mart: 2, nisan: 3, mayis: 4, haziran: 5,
      temmuz: 6, agustos: 7, eylul: 8, ekim: 9, kasim: 10, aralik: 11,
    };
    const month = months[monthKey];
    if (month === undefined) return null;

    let hour = 21;
    let minute = 0;
    const timePart = parts.find((p) => /^\d{1,2}:\d{2}$/.test(p));
    if (timePart) {
      const [h, m] = timePart.split(':').map((n) => parseInt(n, 10));
      if (Number.isFinite(h)) hour = h;
      if (Number.isFinite(m)) minute = m;
    }

    const now = new Date();
    let year = now.getFullYear();
    let eventDate = new Date(year, month, day, hour, minute);
    const staleMs = 45 * 24 * 60 * 60 * 1000;
    if (eventDate.getTime() < now.getTime() - staleMs) {
      eventDate = new Date(year + 1, month, day, hour, minute);
    }
    return eventDate;
  }

  normalizeCustomEvents(raw = []) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => e && typeof e === 'object' && String(e.title || '').trim())
      .map((e, index) => ({
        id: String(e.id || `custom-${index + 1}`),
        title: String(e.title || '').trim(),
        category: String(e.category || 'Etkinlik').trim(),
        city: String(e.city || 'Osmaniye').trim(),
        district: String(e.district || 'Merkez').trim(),
        location: String(e.location || e.district || 'Merkez').trim(),
        date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
        imageUrl: this.normalizeEventImageUrl(
          String(e.imageUrl || this.getImageForCategory(e.category || '')),
        ),
        price: String(e.price || 'Ücretsiz').trim(),
        link: String(e.link || '').trim(),
        source: String(e.source || 'Yönetici').trim(),
      }));
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
        const imageUrl = this.extractBubiletImageUrl($(el));
        const link = 'https://www.bubilet.com.tr' + $(el).attr('href');

        if (title && dateText) {
          const eventDate = this.parseBubiletDate(dateText);
          if (!eventDate) return;

          const href = String($(el).attr('href') || '');
          const hrefSlug = href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || `evt-${i}`;

          events.push({
            id: `bubilet-${slug}-${hrefSlug}`,
            title,
            category: this.inferCategory(title),
            city: cityName,
            district: location.split(',')[0].trim(),
            location: location,
            date: eventDate.toISOString(),
            imageUrl: imageUrl || this.getImageForCategory(this.inferCategory(title)),
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
          imageUrl: this.normalizeEventImageUrl(
            imageUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4',
          ),
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
    const ttl = this.getCacheTtlMs();
    const isFresh = now - this.cache.fetchedAt < ttl;

    if (!forceRefresh && isFresh && this.cache.items.length > 0) {
      return this.cache.items;
    }

    try {
      console.log('[EventService] Refreshing events from sources...');
      const newsEvents = [];
      let bubiletEvents = [];

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

      // Save scraped Bubilet events to DB cache if we successfully found any
      if (bubiletEvents.length > 0) {
        try {
          const content = await fileService.readCityContent();
          content.scrapedEvents = bubiletEvents;
          await fileService.writeCityContent(content);
          console.log('[EventService] Successfully saved scraped Bubilet events to Supabase.');
        } catch (dbErr) {
          console.warn('[EventService] Failed to write scraped events to database:', dbErr.message);
        }
      } else {
        // If scrape returned 0 events (e.g. blocked by Cloudflare), fall back to DB cache
        try {
          const content = await fileService.readCityContent();
          if (content && Array.isArray(content.scrapedEvents) && content.scrapedEvents.length > 0) {
            const nowTime = new Date();
            const cachedFuture = content.scrapedEvents.filter(e => new Date(e.date) >= nowTime);
            bubiletEvents.push(...cachedFuture);
            console.log(`[EventService] Loaded ${cachedFuture.length} cached Bubilet events from database.`);
          }
        } catch (dbErr) {
          console.error('[EventService] Failed to read cached events from database:', dbErr.message);
        }
      }

      let manualEvents = [];
      try {
        const content = await fileService.readCityContent();
        if (content && Array.isArray(content.customEvents) && content.customEvents.length > 0) {
          manualEvents = this.normalizeCustomEvents(content.customEvents);
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
    
    // AĞUSTOS 2026
    const augustEvents = [
      { city: 'Osmaniye', title: 'Düziçi Yöresel Ürünler Pazarı', cat: 'Festival', date: '2026-08-01T09:00:00Z', loc: 'Belediye Meydanı' },
      { city: 'Osmaniye', title: 'Osmaniye Doğa Yürüyüşü', cat: 'Spor', date: '2026-08-01T08:00:00Z', loc: 'Zorkun Yaylası' },
      { city: 'Adana', title: 'Madrigal Konseri', cat: 'Konser', date: '2026-08-01T21:00:00Z', loc: '01 Burda PGM' },
      { city: 'Adana', title: 'Gökhan Türkmen Konseri', cat: 'Konser', date: '2026-08-08T21:00:00Z', loc: '01 Burda PGM' },
      { city: 'Gaziantep', title: 'Duman Konseri', cat: 'Konser', date: '2026-08-13T21:00:00Z', loc: 'GAÜN Mavera KSM' },
      { city: 'Adana', title: 'Duman Konseri', cat: 'Konser', date: '2026-08-14T21:00:00Z', loc: 'Çukurova Üniv. Açıkhava' },
      { city: 'Hatay', title: 'Madrigal Konseri', cat: 'Konser', date: '2026-08-03T21:00:00Z', loc: 'Hatay Kalyon Live' },
      { city: 'Kahramanmaraş', title: 'Maraş Kültür Buluşması', cat: 'Kültür & Sanat', date: '2026-08-02T10:00:00Z', loc: 'Valilik Meydanı' },
      { city: 'Gaziantep', title: 'Antep Gastronomi Günü', cat: 'Festival', date: '2026-08-04T11:00:00Z', loc: 'Festival Park' },
      { city: 'Kahramanmaraş', title: 'Maraş Dondurma Festivali', cat: 'Festival', date: '2026-08-12T10:00:00Z', loc: 'Müftülük Meydanı' },
      { city: 'Osmaniye', title: 'Hastalık Hastası - Tiyatro', cat: 'Tiyatro', date: '2026-08-15T20:00:00Z', loc: 'Cebelibereket KM' },
      { city: 'Adana', title: 'Duman Konseri', cat: 'Konser', date: '2026-08-18T21:00:00Z', loc: 'Çukurova Açıkhava' },
      { city: 'Gaziantep', title: 'Zeynep Bastık', cat: 'Konser', date: '2026-08-22T21:00:00Z', loc: 'Festival Park' },
      { city: 'Adana', title: 'Adana Lezzet Festivali', cat: 'Festival', date: '2026-08-25T11:00:00Z', loc: 'Merkez Park' },
      { city: 'Osmaniye', title: 'Korkut Ata Bahar Şenliği', cat: 'Festival', date: '2026-08-28T14:00:00Z', loc: 'OKÜ Kampüsü' },
      { city: 'Kahramanmaraş', title: 'Edeler Buluşması', cat: 'Kültür & Sanat', date: '2026-08-30T18:00:00Z', loc: 'KAFUM' },
    ];

    // EYLÜL 2026
    const septemberEvents = [
      { city: 'Adana', title: 'Sertab Erener', cat: 'Konser', date: '2026-09-03T21:00:00Z', loc: '01 Burda PGM' },
      { city: 'Gaziantep', title: 'Cem Adrian', cat: 'Konser', date: '2026-09-05T21:00:00Z', loc: 'GAÜN Mavera' },
      { city: 'Hatay', title: 'İskenderun Deniz Festivali', cat: 'Festival', date: '2026-09-10T10:00:00Z', loc: 'Sahil Şeridi' },
      { city: 'Osmaniye', title: 'Yaz Sinemaları: Eşkıya', cat: 'Kültür & Sanat', date: '2026-09-12T20:30:00Z', loc: 'Masal Park' },
      { city: 'Adana', title: 'Adamlar Konseri', cat: 'Konser', date: '2026-09-15T21:00:00Z', loc: 'Hayal Kahvesi' },
      { city: 'Gaziantep', title: 'Sunay Akın Anlatısı', cat: 'Kültür & Sanat', date: '2026-09-18T20:00:00Z', loc: 'Şahinbey KM' },
      { city: 'Kahramanmaraş', title: 'Göksun Yayla Şenlikleri', cat: 'Festival', date: '2026-09-20T11:00:00Z', loc: 'Göksun Meydanı' },
      { city: 'Hatay', title: 'Karsu Konseri', cat: 'Konser', date: '2026-09-25T21:00:00Z', loc: 'Expo Antakya' },
      { city: 'Osmaniye', title: 'Voleybol Turnuvası Finali', cat: 'Spor', date: '2026-09-28T19:00:00Z', loc: 'Tosyalı Spor Kompleksi' },
    ];

    // EKİM 2026
    const octoberEvents = [
      { city: 'Adana', title: 'Yüzyüzeyken Konuşuruz', cat: 'Konser', date: '2026-10-02T21:00:00Z', loc: 'Çukurova Açıkhava' },
      { city: 'Gaziantep', title: 'GastroAntep Çocuk Atölyesi', cat: 'Kültür & Sanat', date: '2026-10-05T14:00:00Z', loc: 'Mutfak Sanatları Merkezi' },
      { city: 'Osmaniye', title: 'Zorkun Yaylası Şenlikleri', cat: 'Festival', date: '2026-10-10T10:00:00Z', loc: 'Zorkun Yaylası' },
      { city: 'Hatay', title: 'Mabel Matiz', cat: 'Konser', date: '2026-10-15T21:00:00Z', loc: 'İskenderun Açıkhava' },
      { city: 'Kahramanmaraş', title: 'Afşin Eshab-ı Kehf Etkinlikleri', cat: 'Festival', date: '2026-10-20T10:00:00Z', loc: 'Afşin' },
      { city: 'Adana', title: 'Yaz Konserleri: Fatma Turgut', cat: 'Konser', date: '2026-10-25T21:00:00Z', loc: 'Merkez Park' },
    ];

    const all = [...augustEvents, ...septemberEvents, ...octoberEvents];
    
    return all.map((e, i) => ({
      id: `manual-seed-${e.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`,
      title: e.title,
      category: e.cat,
      city: e.city,
      district: 'Merkez',
      location: e.loc,
      date: e.date,
      imageUrl: this.normalizeEventImageUrl(this.getImageForEvent(e.title, e.cat, i)),
      price: e.cat === 'Festival' || e.cat === 'Kültür & Sanat' ? 'Ücretsiz' : '450 TL',
      link: 'https://www.biletix.com',
      source: 'Küratör'
    }));
  }

  getImageForEvent(title = '', cat = '', index = 0) {
    const t = title.toLowerCase();
    
    // Spesifik Etkinlik & Sanatçı Eşleşmeleri
    if (t.includes('lezzet festival') || t.includes('gastronomi') || t.includes('yöresel')) {
      return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80';
    }
    if (t.includes('korkut ata') || t.includes('bahar şenli')) {
      return 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80';
    }
    if (t.includes('doğa yürüyüş') || t.includes('yayla') || t.includes('zorkun')) {
      return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80';
    }
    if (t.includes('duman') || t.includes('adamlar') || t.includes('yüzyüzeyken')) {
      return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80';
    }
    if (t.includes('madrigal') || t.includes('gökhan türkmen')) {
      return 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80';
    }
    if (t.includes('zeynep bastık') || t.includes('fatma turgut') || t.includes('sertab')) {
      return 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&q=80';
    }
    if (t.includes('cem adrian') || t.includes('mabel matiz') || t.includes('karsu')) {
      return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80';
    }
    if (t.includes('dondurma')) {
      return 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600&q=80';
    }
    if (t.includes('tiyatro') || t.includes('hastalık hastası') || t.includes('oyun') || t.includes('stand up')) {
      return 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600&q=80';
    }
    if (t.includes('sinema') || t.includes('eşkıya') || t.includes('film')) {
      return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80';
    }
    if (t.includes('voleybol') || t.includes('spor') || t.includes('maraton') || t.includes('koşu')) {
      return 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600&q=80';
    }
    if (t.includes('edeler') || t.includes('kültür') || t.includes('buluşma') || t.includes('sunay akın')) {
      return 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&q=80';
    }
    if (t.includes('deniz festival') || t.includes('iskenderun') || t.includes('sahil')) {
      return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80';
    }
    if (t.includes('çocuk') || t.includes('atölye')) {
      return 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=600&q=80';
    }

    // Kategoriye Göre Çeşitlendirilmiş Görsel Havuzu
    const concertPool = [
      'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=600&q=80',
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80',
    ];
    const festivalPool = [
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80',
    ];
    const theaterPool = [
      'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=600&q=80',
      'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=600&q=80',
    ];

    if (cat === 'Konser') return concertPool[index % concertPool.length];
    if (cat === 'Festival') return festivalPool[index % festivalPool.length];
    if (cat === 'Tiyatro') return theaterPool[index % theaterPool.length];

    return 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600&q=80';
  }

  getImageForCategory(cat) {
    return this.getImageForEvent('', cat, 0);
  }
}

module.exports = new EventService();
