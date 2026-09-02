const fs = require('fs');
const path = require('path');
const config = require('../config');
const { normalizeText, fetchPage, stripHtml, fetchWithTimeout } = require('../utils/helpers');
const { normalizePharmacyDateLabels } = require('../utils/pharmacyDutyLabels');
const fcmService = require('./fcmService');

function istanbulDateKey(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

class PharmacyService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      pharmacies: [],
    };
    this._lastPushedDateKey = '';
  }

  parseDutyPharmacyHtml(html) {
    // Find all tab IDs matching id="nav-xxxx"
    const tabIdRegex = /id=["'](nav-[a-zA-Z0-9_-]+)["']/g;
    const tabIds = [];
    let match;
    while ((match = tabIdRegex.exec(html)) !== null) {
      tabIds.push(match[1]);
    }

    // If no nav- tabs found, fallback to hardcoded ones
    const uniqueTabIds = tabIds.length > 0 ? [...new Set(tabIds)] : ['nav-bugun', 'nav-yarin'];

    const parseTab = (tabId, dateLabel) => {
      const startIdx = html.indexOf(`id="${tabId}"`);
      if (startIdx === -1) return [];

      const tableEndIdx = html.indexOf('</table>', startIdx);
      if (tableEndIdx === -1) return [];

      const tabHtml = html.substring(startIdx, tableEndIdx);

      const rangeRegex = /class=["']d-flex alert alert-warning[^>]*>([\s\S]*?)<\/div>/i;
      const rangeMatch = tabHtml.match(rangeRegex);
      const dateRange = rangeMatch ? normalizeText(rangeMatch[1]) : '';

      const nameRegex = /<span class=["']isim["']>([^<]+)<\/span>/g;
      const list = [];
      let nameMatch;

      while ((nameMatch = nameRegex.exec(tabHtml)) !== null) {
        const name = normalizeText(nameMatch[1]);
        const nameIdx = nameMatch.index;

        const rest = tabHtml.substring(nameIdx);
        const detailRegex = /class=['"]col-lg-6['"]>([\s\S]*?)<\/div>[\s\S]*?class=['"]col-lg-3[^'"]*['"]>([\s\S]*?)<\/div>/;
        const detailMatch = rest.match(detailRegex);

        if (detailMatch) {
          const address = stripHtml(detailMatch[1]);
          const phone = stripHtml(detailMatch[2]);
          list.push({
            dateLabel,
            dateRange,
            name,
            address,
            phone,
          });
        }
      }
      return list;
    };

    const list = [];
    for (const tabId of uniqueTabIds) {
      const dateLabel = tabId.toLowerCase().includes('yarin') ? 'Yarın' : 'Bugün';
      list.push(...parseTab(tabId, dateLabel));
    }

    if (list.length === 0) {
      throw new Error('Eczane verisi parse edilemedi.');
    }

    return list;
  }

  parseJinaPharmacyMarkdown(text) {
    const body = String(text || '').includes('Markdown Content:')
      ? String(text).split('Markdown Content:')[1]
      : String(text || '');

    const lines = body.split('\n').map(line => line.trim()).filter(Boolean);
    const pharmacies = [];
    let activeDateRange = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if line is a date range, e.g. "26 Haziran Cuma akşamından 27 Haziran C.tesi sabahına kadar."
      if (/^\d{1,2}\s+[a-zA-ZçğıöşüÇĞİÖŞÜ]/i.test(line) && (line.includes('sabahına kadar') || line.includes('gün boyu') || line.includes('sabahına kadar'))) {
        activeDateRange = line;
        continue;
      }

      // Check if line contains a pharmacy link, e.g. "[Yeşilova Şifa Eczanesi](...)"
      const nameMatch = line.match(/^\[([^\]]+)\]\(https:\/\/www\.eczaneler\.gen\.tr\/eczane\//);
      if (nameMatch) {
        const name = normalizeText(nameMatch[1]);
        let address = '';
        let phone = '';

        // Look ahead to find address and phone
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j];
          if (nextLine.startsWith('[') || /^\d{1,2}\s+[a-zA-ZçğıöşüÇĞİÖŞÜ]/i.test(nextLine)) {
            break; // Met another pharmacy or date range
          }
          if ((/^(0\s*\(?\d{3}\)?)/.test(nextLine) || /^\d{10,11}/.test(nextLine) || nextLine.includes('(')) && !nextLine.startsWith('![') && !nextLine.includes('http')) {
            phone = normalizeText(nextLine);
          } else if (nextLine.includes('Mahallesi') || nextLine.includes('Cad') || nextLine.includes('Sok') || nextLine.includes('No:') || nextLine.includes('Karşısı') || nextLine.includes('karşısı') || nextLine.startsWith('→') || nextLine.startsWith('-')) {
            if (address) {
              address += ' ' + normalizeText(nextLine);
            } else {
              address = normalizeText(nextLine);
            }
          }
        }

        if (name && (phone || address)) {
          pharmacies.push({
            name,
            address: address || 'Düziçi / Osmaniye',
            phone: phone || '',
            dateLabel: 'Bugün', // Will be corrected by normalizePharmacyDateLabels
            dateRange: activeDateRange,
          });
        }
      }
    }

    if (pharmacies.length === 0) {
      throw new Error('Jina eczane verisi parse edilemedi.');
    }
    return pharmacies;
  }

  async scrapeDutyPharmaciesViaJina() {
    const target = config.PHARMACY.URL;
    const jinaUrl = `https://r.jina.ai/${target}`;
    const res = await fetchWithTimeout(
      jinaUrl,
      {
        headers: {
          Accept: 'text/plain',
          'User-Agent':
            'Mozilla/5.0 (compatible; HepsiDuziciBot/1.0; +https://hdbackend-vo99.onrender.com)',
        },
      },
      30000,
    );
    if (!res.ok) {
      throw new Error(`Jina proxy ${res.status}`);
    }
    const text = await res.text();
    return this.parseJinaPharmacyMarkdown(text);
  }

  async scrapeDutyPharmaciesHtml() {
    const response = await fetchPage(
      config.PHARMACY.URL,
      {
        referer: 'https://www.google.com/',
        site: 'cross-site',
      },
      25000,
    );
    const html = await response.text();
    const pharmacies = this.parseDutyPharmacyHtml(html);
    if (pharmacies.length === 0) {
      throw new Error('Eczane verisi parse edilemedi.');
    }
    return pharmacies;
  }

  async scrapeDutyPharmaciesEczanelerOrg() {
    const url = 'https://eczaneler.org/osmaniye-duzici-nobetci-eczaneleri';
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      },
      15000,
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    const list = [];
    $('h3').each((i, el) => {
      const title = $(el).text().trim();
      if (
        title.toLowerCase().includes('eczane') &&
        !title.toLowerCase().includes('diğer') &&
        !title.toLowerCase().includes('hizmet') &&
        !title.toLowerCase().includes('nasıl') &&
        !title.toLowerCase().includes('saatleri') &&
        !title.toLowerCase().includes('sorular')
      ) {
        const parent = $(el).parent();
        const address = parent.find('.line-clamp-2').text().replace(/\s+/g, ' ').trim() ||
                        parent.find('span:contains("Mahallesi"), span:contains("Cad"), span:contains("Sok")').text().replace(/\s+/g, ' ').trim() ||
                        'Düziçi / Osmaniye';
        const phone = parent.find('a[href^="tel:"]').text().trim() ||
                      parent.find('a[href^="tel:"]').attr('href')?.replace('tel:', '').trim() || '';
        let dateRange = '';
        parent.find('span').each((_, span) => {
          const t = $(span).text().trim();
          if (/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(t)) {
            dateRange = t;
          }
        });

        if (title && (phone.length >= 6 || address.length >= 10)) {
          list.push({
            name: title.replace(/\s+/g, ' ').trim(),
            address: address.replace(/\s+/g, ' ').trim(),
            phone: phone.replace(/\s+/g, ' ').trim(),
            dateLabel: 'Bugün',
            dateRange: dateRange || 'Bugün 08:00 - Yarın 08:00',
          });
        }
      }
    });

    if (list.length === 0) {
      throw new Error('Eczaneler.org üzerinden eczane verisi parse edilemedi.');
    }
    return list;
  }

  async scrapePostaDutyPharmacies() {
    const urls = [
      'https://www.posta.com.tr/nobetci-eczaneler/osmaniye/duzici/',
      'https://www.milliyet.com.tr/nobetci-eczaneler/osmaniye/duzici/',
      'https://www.gazetevatan.com/nobetci-eczaneler/osmaniye/duzici/',
    ];

    for (const url of urls) {
      try {
        const res = await fetchWithTimeout(
          url,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            },
          },
          10000,
        );

        if (!res.ok) continue;
        const html = await res.text();
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);

        const infoText =
          $('.ecz-module-info-text').text().trim() ||
          'Bugün akşamdan yarına kadar';

        const pharmacies = [];
        $('.ecz-module-pharmacy-item').each((i, el) => {
          const name = $(el)
            .find('.ecz-module-pharmacy-name')
            .first()
            .text()
            .trim();
          let address = $(el)
            .find('.ecz-module-pharmacy-location')
            .first()
            .text()
            .trim();
          address = address.replace(/^Adres:\s*/i, '').trim();

          let phone = $(el)
            .find('.ecz-module-pharmacy-contact')
            .first()
            .text()
            .trim();
          phone = phone.replace(/^Telefon:\s*/i, '').trim();

          if (name && !pharmacies.some((p) => p.name === name)) {
            pharmacies.push({
              name,
              address: address || 'Düziçi / Osmaniye',
              phone,
              dateLabel: 'Bugün',
              dateRange: infoText,
            });
          }
        });

        if (pharmacies.length > 0) {
          return pharmacies;
        }
      } catch (err) {
        console.warn(`[pharmacy] Scrape failed for ${url}:`, err.message);
      }
    }

    throw new Error('Posta/Milliyet eczane verisi parse edilemedi.');
  }

  async scrapeDutyPharmacies() {
    try {
      return await this.scrapePostaDutyPharmacies();
    } catch (errPosta) {
      console.warn(
        '[pharmacy] Posta/Milliyet scrape failed, trying Eczaneler.org:',
        errPosta.message,
      );
      try {
        return await this.scrapeDutyPharmaciesEczanelerOrg();
      } catch (errOrg) {
        console.warn(
          '[pharmacy] Eczaneler.org scrape failed, trying legacy HTML:',
          errOrg.message,
        );
        try {
          return await this.scrapeDutyPharmaciesHtml();
        } catch (err) {
          console.warn(
            '[pharmacy] HTML scrape failed, trying Jina fallback:',
            err.message,
          );
          return await this.scrapeDutyPharmaciesViaJina();
        }
      }
    }
  }

  loadFromLocalFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      const cachePath = path.resolve(
        __dirname,
        '../../data/pharmacies_cache.json',
      );
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.pharmacies) && parsed.pharmacies.length > 0) {
          console.log('[pharmacy] Loaded pharmacies from local file backup.');
          return parsed.pharmacies;
        }
      }
    } catch (err) {
      console.error('[pharmacy] Local file cache read failed:', err.message);
    }
    return null;
  }

  saveToLocalFile(pharmacies) {
    try {
      const fs = require('fs');
      const path = require('path');
      const cachePath = path.resolve(
        __dirname,
        '../../data/pharmacies_cache.json',
      );
      fs.writeFileSync(
        cachePath,
        JSON.stringify(
          { updatedAt: new Date().toISOString(), pharmacies },
          null,
          2,
        ),
        'utf8',
      );
    } catch (err) {
      console.error('[pharmacy] Local file cache write failed:', err.message);
    }
  }

  async loadFromSupabase() {
    try {
      const supabase = require('../utils/supabaseClient');
      const { data, error } = await supabase
        .from('pharmacies')
        .select('name, address, phone, date_label, date_range, fetched_at')
        .order('fetched_at', { ascending: false });

      if (error || !data?.length) return null;

      const latestFetchedAt = data[0].fetched_at;
      if (!latestFetchedAt) return null;

      const cacheDate = istanbulDateKey(new Date(latestFetchedAt).getTime());
      const nowDate = istanbulDateKey();
      const ageMs = Date.now() - new Date(latestFetchedAt).getTime();
      const maxStaleMs = 36 * 60 * 60 * 1000;
      if (cacheDate !== nowDate) {
        if (ageMs > maxStaleMs) {
          console.log(`[pharmacy] Supabase cache too old (${cacheDate} vs ${nowDate})`);
          return null;
        }
        console.warn(`[pharmacy] Supabase cache farklı gün ama yedek olarak kullanılıyor (${cacheDate})`);
      }

      const latestBatch = data.filter(
        (row) => row.fetched_at === latestFetchedAt,
      );

      return latestBatch.map((row) => ({
        name: row.name,
        address: row.address,
        phone: row.phone,
        dateLabel: row.date_label || 'Bugün',
        dateRange: row.date_range || '',
      }));
    } catch (err) {
      console.error('❌ Supabase pharmacy fallback failed:', err.message);
      return null;
    }
  }

  async syncToSupabase(pharmacies) {
    try {
      const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
      const db = requireSupabaseAdmin();
      await db.from('pharmacies').delete().gt('id', 0);

      const rows = pharmacies.map((p) => ({
        name: p.name,
        address: p.address,
        phone: p.phone,
        date_label: p.dateLabel,
        date_range: p.dateRange,
        fetched_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        await db.from('pharmacies').insert(rows);
        console.log(`[pharmacy] ${rows.length} pharmacies synced to Supabase.`);
      }
    } catch (err) {
      console.error('❌ Supabase pharmacy cache sync failed:', err.message);
    }
  }

  shouldUseMemoryCache(forceRefresh) {
    if (forceRefresh) return false;
    if (!this.cache.pharmacies.length) return false;
    const isFresh = Date.now() - this.cache.fetchedAt < config.PHARMACY.CACHE_TTL_MS;
    const sameDay = istanbulDateKey(this.cache.fetchedAt) === istanbulDateKey();
    return isFresh && sameDay;
  }

  enrichPharmacies(pharmacies) {
    if (!pharmacies || !pharmacies.length) return pharmacies;

    const inDuziciBounds = (lat, lng) =>
      lat != null &&
      lng != null &&
      lat >= 37.15 &&
      lat <= 37.42 &&
      lng >= 36.38 &&
      lng <= 36.62;

    try {
      const fs = require('fs');
      const path = require('path');
      const correctionsPath = path.resolve(__dirname, '../../data/map_corrections.json');
      if (fs.existsSync(correctionsPath)) {
        const corrections = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));
        const lookup = corrections.pharmacies || {};
        
        const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9çğışöü]/gi, '').trim();
        
        const lookupMap = new Map();
        for (const [key, value] of Object.entries(lookup)) {
          lookupMap.set(norm(key), value);
        }

        const findMatch = (name) => {
          const n = norm(name);
          if (lookupMap.has(n)) return lookupMap.get(n);
          for (const [key, value] of lookupMap.entries()) {
            if (n.length >= 4 && key.length >= 4 && (n.includes(key) || key.includes(n))) {
              return value;
            }
          }
          return null;
        };

        return pharmacies.map(p => {
          const match = findMatch(p.name);
          if (match && (match.lat || match.lng || match.googleMapsUrl)) {
            const lat = match.lat ?? p.lat;
            const lng = match.lng ?? p.lng;
            const coordsOk = inDuziciBounds(lat, lng);
            return {
              ...p,
              lat: coordsOk ? lat : p.lat,
              lng: coordsOk ? lng : p.lng,
              googleMapsUrl: coordsOk
                ? (match.googleMapsUrl || p.googleMapsUrl)
                : p.googleMapsUrl,
            };
          }
          return p;
        });
      }
    } catch (err) {
      console.error('[pharmacy] Failed to enrich pharmacies with coordinates:', err.message);
    }
    return pharmacies;
  }

  async getDutyPharmacies({ forceRefresh = false } = {}) {
    if (this.shouldUseMemoryCache(forceRefresh)) {
      return this.enrichPharmacies(
        normalizePharmacyDateLabels(this.cache.pharmacies),
      );
    }

    try {
      const pharmacies = await this.scrapeDutyPharmacies();
      const normalized = normalizePharmacyDateLabels(pharmacies);
      this.cache = {
        fetchedAt: Date.now(),
        pharmacies: normalized,
      };
      this.saveToLocalFile(normalized);
      await this.syncToSupabase(normalized);
      this.maybePushDutyPharmacy(normalized).catch(() => {});
      return this.enrichPharmacies(normalized);
    } catch (err) {
      console.warn('[pharmacy] scrape failed:', err.message);

      const supabaseData = await this.loadFromSupabase();
      if (supabaseData?.length) {
        const normalized = normalizePharmacyDateLabels(supabaseData);
        this.cache = {
          fetchedAt: Date.now(),
          pharmacies: normalized,
        };
        this.saveToLocalFile(normalized);
        this.maybePushDutyPharmacy(normalized).catch(() => {});
        return this.enrichPharmacies(normalized);
      }

      const sameDayMemory =
        this.cache.pharmacies.length > 0 &&
        istanbulDateKey(this.cache.fetchedAt) === istanbulDateKey();
      if (sameDayMemory) {
        console.warn('[pharmacy] using same-day memory cache after scrape failure');
        return this.enrichPharmacies(
          normalizePharmacyDateLabels(this.cache.pharmacies),
        );
      }

      const localFileData = this.loadFromLocalFile();
      if (localFileData?.length) {
        console.warn('[pharmacy] using local file fallback after all scrapes failed');
        const normalized = normalizePharmacyDateLabels(localFileData);
        this.cache = {
          fetchedAt: Date.now(),
          pharmacies: normalized,
        };
        return this.enrichPharmacies(normalized);
      }

      throw err;
    }
  }

  async maybePushDutyPharmacy(pharmacies) {
    if (this._isPushingPharmacy) return;

    // 1. Saat kontrolü (Türkiye saati UTC+3)
    const now = new Date();
    const istanbulOffset = 3 * 60; // UTC+3
    const localMs = now.getTime() + (istanbulOffset + now.getTimezoneOffset()) * 60000;
    const istDate = new Date(localMs);
    const istHour = istDate.getHours();
    const istMinute = istDate.getMinutes();
    const timeVal = istHour * 60 + istMinute;

    // Yalnızca sabah nöbet devrinden sonra (08:30 - 11:00 arası) gönderilebilir.
    // Gece veya öğleden sonra kesinlikle otomatik push atılmaz!
    if (timeVal < 510 || timeVal > 660) {
      return;
    }

    const todayKey = istanbulDateKey();

    // 2. Kalıcı kontrol (Sunucu yeniden başlasa bile diske bakılır)
    const PUSH_STATE_FILE = path.join(__dirname, '../../data/last_pharmacy_push.json');
    let lastPushedKey = this._lastPushedDateKey;
    if (!lastPushedKey && fs.existsSync(PUSH_STATE_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(PUSH_STATE_FILE, 'utf8'));
        lastPushedKey = saved.lastPushedDateKey;
      } catch (_) {}
    }

    if (lastPushedKey === todayKey) return;
    if (!fcmService.isFcmConfigured()) return;
    if (!pharmacies || !pharmacies.length) return;

    const todayPharmacy = pharmacies.find((p) => p.dateLabel === 'Bugün') || pharmacies[0];
    if (!todayPharmacy) return;

    this._isPushingPharmacy = true;
    this._lastPushedDateKey = todayKey;

    try {
      try {
        fs.writeFileSync(
          PUSH_STATE_FILE,
          JSON.stringify({ lastPushedDateKey: todayKey, sentAt: new Date().toISOString() }, null, 2),
          'utf8',
        );
      } catch (_) {}

      // Hafta sonu (Cumartesi = 6, Pazar = 0) ise HERKESE (news_duzici), hafta içi ise SADECE PLUS (pharmacy_plus)
      const dayOfWeek = istDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const targetTopic = isWeekend ? 'news_duzici' : 'pharmacy_plus';
      const title = isWeekend ? '🏥 Hafta Sonu Nöbetçi Eczane' : '👑 Bugün Nöbetçi Eczane (Plus)';
      const body = isWeekend
        ? `${todayPharmacy.name} (${todayPharmacy.address || 'Düziçi'}) nöbetçidir. Sağlıklı hafta sonları dileriz.`
        : `${todayPharmacy.name} (${todayPharmacy.address || 'Düziçi'}) nöbetçidir.`;

      await fcmService.sendToTopic(targetTopic, {
        title,
        body,
        collapseKey: `pharmacy_duty_${todayKey}`,
        data: {
          route: 'screen:pharmacy',
          pharmacyName: todayPharmacy.name,
          isWeekend: isWeekend ? 'true' : 'false',
        },
      });
      console.log(`[pharmacy] Nöbetçi eczane push bildirimi gönderildi -> Hedef: ${targetTopic} (${todayPharmacy.name})`);
    } catch (err) {
      console.warn('[pharmacy] push failed:', err.message);
    } finally {
      this._isPushingPharmacy = false;
    }
  }
}

module.exports = new PharmacyService();
