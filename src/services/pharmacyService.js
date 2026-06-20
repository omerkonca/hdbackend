const config = require('../config');
const { normalizeText, fetchWithTimeout, stripHtml } = require('../utils/helpers');
const { normalizePharmacyDateLabels } = require('../utils/pharmacyDutyLabels');

function istanbulDateKey(ms = Date.now()) {
  const shiftMs = 8.5 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms - shiftMs));
}

class PharmacyService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      pharmacies: [],
    };
  }

  parseDutyPharmacyHtml(html) {
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

    const bugun = parseTab('nav-bugun', 'Bugün');
    const yarin = parseTab('nav-yarin', 'Yarın');

    if (bugun.length === 0 && yarin.length === 0) {
      throw new Error('Eczane verisi parse edilemedi.');
    }

    return [...bugun, ...yarin];
  }

  async scrapeDutyPharmacies() {
    const response = await fetchWithTimeout(config.PHARMACY.URL, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        referer: 'https://www.eczaneler.gen.tr/',
        'cache-control': 'no-cache',
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
      if (cacheDate !== nowDate) {
        console.log(`[pharmacy] Supabase cache is from a different day (${cacheDate} vs ${nowDate})`);
        return null;
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
      const supabase = require('../utils/supabaseClient');
      await supabase.from('pharmacies').delete().gt('id', 0);

      const rows = pharmacies.map((p) => ({
        name: p.name,
        address: p.address,
        phone: p.phone,
        date_label: p.dateLabel,
        date_range: p.dateRange,
        fetched_at: new Date().toISOString(),
      }));
      if (rows.length > 0) {
        await supabase.from('pharmacies').insert(rows);
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
