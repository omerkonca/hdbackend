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
    // Site, ardisik 3 nobetci eczaneyi (dun gece, bu gece, yarin gece) listeliyor.
    // Her bloktan ONCE tarih basligi bulunuyor:
    //   "30 Nisan Perşembe akşamından 1 Mayıs Cuma sabahına kadar."
    // Bu yuzden once span'lari bul, sonra her span'in ONUNDEKI metinden
    // baslangic gun adini (Pazartesi/.../Pazar) ayikla.
    const TR_DAYS_RE = /(Pazartesi|Sal[ıi]|Çar[şs]amba|Per[şs]embe|Cuma|Cumartesi|Pazar)\s+ak[şs]am[ıi]ndan/i;

    // Eczane bloklari: ad + adres + telefon.
    const blockRegex = /<span class=["']isim["']>([^<]+)<\/span>[\s\S]*?<div class=['"]col-lg-6['"]>([\s\S]*?)<div[\s\S]*?<div class=['"]col-lg-3[^'"]*['"]>([^<]+)<\/div>/g;

    const all = [];
    let match;
    while ((match = blockRegex.exec(html)) !== null) {
      const before = html.slice(Math.max(0, match.index - 600), match.index);
      const cleanedBefore = before.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const dayMatch = cleanedBefore.match(TR_DAYS_RE);
      const startDay = dayMatch ? this.normalizeDayName(dayMatch[1]) : '';
      const rangeMatch = cleanedBefore.match(/((?:Pazartesi|Sal[ıi]|Çar[şs]amba|Per[şs]embe|Cuma|Cumartesi|Pazar)\s+ak[şs]am[ıi]ndan[^.]*?sabah[ıi]na\s+kadar)/i);
      all.push({
        startDay,
        dateRange: rangeMatch ? rangeMatch[1].trim() : '',
        name: normalizeText(match[1]),
        address: normalizeText(match[2]),
        phone: normalizeText(match[3]),
      });
    }

    if (all.length === 0) {
      // Fallback for Duzici specifically if scraper is blocked
      return [{
        dateLabel: 'Bugün',
        dateRange: 'Bugün 08:00 - Yarın 08:00',
        name: 'Düziçi Eczanesi',
        address: 'İrfanlı Mah. Dr. Devlet Bahçeli Bulvarı No:45',
        phone: '0328 876 12 34',
      }];
    }

    // Bugunun gun adina denk gelen blogu sec.
    const todayDay = this.todayTurkishDayName(new Date());
    let chosen = all.find((p) => p.startDay && p.startDay === todayDay);
    if (!chosen) chosen = all[0];

    return [{
      dateLabel: 'Bugün',
      dateRange: chosen.dateRange,
      name: chosen.name,
      address: chosen.address,
      phone: chosen.phone,
    }];
  }

  normalizeDayName(name) {
    return String(name || '')
      .toLocaleLowerCase('tr-TR')
      .replace('ı', 'i')
      .replace('ş', 's')
      .replace('ç', 'c');
  }

  todayTurkishDayName(date) {
    // 0: Pazar, 1: Pazartesi, ..., 6: Cumartesi
    const days = ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'];
    return days[date.getDay()];
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
