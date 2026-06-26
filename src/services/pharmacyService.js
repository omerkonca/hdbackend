const config = require('../config');
const { normalizeText, fetchPage, stripHtml, fetchWithTimeout } = require('../utils/helpers');
const { normalizePharmacyDateLabels } = require('../utils/pharmacyDutyLabels');

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

  async scrapeDutyPharmacies() {
    try {
      return await this.scrapeDutyPharmaciesHtml();
    } catch (err) {
      console.warn('[pharmacy] HTML scrape failed, trying Jina fallback:', err.message);
      return await this.scrapeDutyPharmaciesViaJina();
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
      await this.syncToSupabase(normalized);
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

      throw err;
    }
  }
}

module.exports = new PharmacyService();
