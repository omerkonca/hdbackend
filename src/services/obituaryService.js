const cheerio = require('cheerio');
const supabase = require('../utils/supabaseClient');
const { fetchWithTimeout } = require('../utils/helpers');

const MONTHS = [
  '', 'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran',
  'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik',
];
const WEEKDAYS = [
  '', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar',
];

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9',
};

class ObituaryService {
  constructor() {
    this.cache = { fetchedAt: 0, items: [] };
    this.CACHE_TTL_MS = 1000 * 60 * 30; // 30 dk
    this.MAX_AGE_DAYS = 60;
    this.OSMANIYE_DAYS = 30;
  }

  async getObituaries({ forceRefresh = false } = {}) {
    const fresh = Date.now() - this.cache.fetchedAt < this.CACHE_TTL_MS;
    if (!forceRefresh && fresh && this.cache.items.length > 0) {
      return this.cache.items;
    }

    let items = await this.readFromSupabase();
    const stale =
      !items.length ||
      Date.now() - new Date(items[0]?.fetchedAt || 0).getTime() > this.CACHE_TTL_MS;

    if (forceRefresh || stale || items.length === 0) {
      const scraped = await this.scrapeAll();
      if (scraped.length > 0) {
        items = scraped;
        await this.saveToSupabase(items);
      }
    }

    this.cache = { fetchedAt: Date.now(), items };
    return items;
  }

  async scrapeAll() {
    const [akdeniz, osmaniyeBel, duziciBel] = await Promise.all([
      this.scrapeAkdenizGazetesi(),
      this.scrapeOsmaniyeBel(),
      this.scrapeDuziciBel(),
    ]);
    return this.mergeItems([...akdeniz, ...osmaniyeBel, ...duziciBel]);
  }

  async scrapeAkdenizGazetesi() {
    const urls = this.buildAkdenizDailyUrls(35);
    const items = [];

    for (let i = 0; i < urls.length; i += 6) {
      const batch = urls.slice(i, i + 6);
      const pages = await Promise.all(batch.map((url) => this.fetchHtml(url)));
      pages.forEach((html, idx) => {
        if (!html || html.length < 2000) return;
        if (!/vefat edenler/i.test(html)) return;
        items.push(...this.parseAkdenizArticle(html, batch[idx]));
      });
    }

    return items;
  }

  buildAkdenizDailyUrls(days = 35) {
    const urls = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const slug = `${d.getDate()}-${MONTHS[d.getMonth() + 1]}-${d.getFullYear()}-${WEEKDAYS[d.getDay() === 0 ? 7 : d.getDay()]}-gunu-vefat-edenler`;
      urls.push(`https://www.akdenizgazetesi.com/${slug}`);
    }
    return urls;
  }

  parseAkdenizArticle(html, pageUrl) {
    const $ = cheerio.load(html);
    let bodyText = $('article .post-content, article .article-text, article, .content, main')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const endMarkers = ['Muhabir:', 'Editörün', 'Bunlar da', 'Yorumlar', 'Son Haberler'];
    for (const marker of endMarkers) {
      const idx = bodyText.indexOf(marker);
      if (idx > 0) bodyText = bodyText.slice(0, idx);
    }

    const pageDate = this.parseDateFromAkdenizUrl(pageUrl);
    const parts = bodyText.split(/\s+Taziye Adresi:\s*/);
    if (parts.length < 2) return [];

    const items = [];
    let currentName = this.extractTrailingName(parts[0]);

    for (let i = 1; i < parts.length; i++) {
      const segment = parts[i];
      const definSplit = segment.split(/\s+Defin Yeri:\s*/);
      if (definSplit.length < 2) continue;

      const condolence = definSplit[0].trim();
      let afterDefin = definSplit.slice(1).join(' Defin Yeri: ').trim();
      afterDefin = afterDefin
        .split(/\s+(?:Yaz |İçeriği |Muhabir|Editörün|Bunlar |Cenaze |Karaçay )/)[0]
        .trim();
      const tokens = afterDefin.split(/\s+/).filter(Boolean);

      let burial = afterDefin;
      let nextName = '';

      if (tokens.length >= 3) {
        const candidate = tokens.slice(-2).join(' ');
        if (this.isValidObituaryName(candidate)) {
          burial = tokens.slice(0, -2).join(' ');
          nextName = candidate;
        }
      } else if (tokens.length === 2) {
        const candidate = tokens.join(' ');
        if (this.isValidObituaryName(candidate)) {
          burial = '';
          nextName = candidate;
        }
      }

      if (currentName && this.isValidObituaryName(currentName)) {
        const scope = this.inferScope(burial, condolence);
        items.push(
          this.buildItem({
            id: `akdeniz-${pageUrl}-${items.length}`,
            fullName: currentName,
            deathDate: pageDate,
            scope,
            condolenceAddress: condolence,
            burialPlace: burial,
            district: this.inferDistrict(burial, condolence),
            neighborhood: this.extractNeighborhood(condolence),
            source: 'Akdeniz Gazetesi',
            sourceUrl: pageUrl,
          }),
        );
      }

      currentName = nextName;
    }
    return items;
  }

  extractTrailingName(text = '') {
    const cleaned = text.trim();
    const match = cleaned.match(/([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s.'-]{2,40})$/);
    return match ? match[1].trim() : '';
  }

  isValidObituaryName(name = '') {
    const upper = name.toUpperCase();
    const banned = [
      'İÇERİĞİ', 'GÖRÜNTÜLE', 'VEFAT', 'OSMANİYE', 'MUHABİR', 'EDİTÖR',
      'MERKEZİNDE', 'HAŞEREYLE', 'YAZ BOYUNCA', 'BUNLAR',
    ];
    if (banned.some((word) => upper.includes(word))) return false;
    const words = name.trim().split(/\s+/);
    if (words.length < 1 || words.length > 4) return false;
    return words.every((word) => word.length >= 2);
  }

  parseDateFromAkdenizUrl(url = '') {
    const slug = url.match(/(\d{1,2})-([a-z]+)-(\d{4})-/i);
    if (!slug) return new Date().toISOString();
    const monthIndex = MONTHS.indexOf(slug[2].toLowerCase());
    const month = monthIndex > 0 ? monthIndex : 1;
    return new Date(`${slug[3]}-${String(month).padStart(2, '0')}-${slug[1].padStart(2, '0')}T12:00:00.000Z`).toISOString();
  }

  async scrapeDuziciBel() {
    const url = 'https://duzici.bel.tr/vefat-edenler';
    const html = await this.fetchHtml(url);
    if (!html) return [];

    const $ = cheerio.load(html);
    const modals = {};
    $('[id^="modal-"]').each((_, el) => {
      const id = $(el).attr('id')?.replace('modal-', '');
      const text = $(el).find('.modal-body p').first().text().trim();
      if (id && text) modals[id] = text;
    });

    const items = [];
    $('tr.fs14').each((index, row) => {
      const cells = $(row).find('th');
      const name = $(cells[0]).text().trim();
      const dateRaw = $(cells[1]).text().trim();
      const modalId = $(row).find('[data-target]').attr('data-target')?.replace('#modal-', '');
      if (!name) return;

      const detail = modalId ? modals[modalId] || '' : '';
      const deathDate = this.parseDate(dateRaw);
      items.push(this.buildItem({
        id: `duzici-bel-${modalId || index}`,
        fullName: name,
        deathDate,
        scope: 'duzici',
        detail,
        district: 'Düziçi',
        neighborhood: this.extractNeighborhood(detail),
        burialPlace: this.extractBurial(detail),
        source: 'Düziçi Belediyesi',
        sourceUrl: url,
      }));
    });
    return items;
  }

  async scrapeOsmaniyeBel() {
    const links = new Set(this.buildOsmaniyeDailyUrls(this.OSMANIYE_DAYS));
    const categoryHtml = await this.fetchHtml('https://osmaniye-bld.gov.tr/kategori/vefaat');
    if (categoryHtml) {
      const hrefs = categoryHtml.match(/href="([^"]*\d{1,2}-[a-zçğıöşü]+-\d{4}-[a-zçğıöşü]+\.html)"/gi) || [];
      hrefs.forEach((raw) => {
        const match = raw.match(/href="([^"]+)"/i);
        if (match) links.add(this.normalizeUrl(match[1], 'https://osmaniye-bld.gov.tr'));
      });
    }

    const items = [];
    const urls = [...links];
    for (let i = 0; i < urls.length; i += 5) {
      const batch = urls.slice(i, i + 5);
      const pages = await Promise.all(batch.map((url) => this.fetchHtml(url)));
      pages.forEach((html, idx) => {
        if (!html) return;
        items.push(...this.parseOsmaniyeDaily(html, urls[i + idx]));
      });
    }
    return items;
  }

  parseOsmaniyeDaily(html, pageUrl) {
    const $ = cheerio.load(html);
    const items = [];
    const pageDateText = $('body').text().match(/Cenaze Bilgi Sistemi\s*TARİH:\s*([^\n|]+)/i);
    const pageDate = this.parseDate(pageDateText?.[1] || '');

    $('table').each((_, table) => {
      const rows = $(table).find('tr');
      let current = null;
      rows.each((__, row) => {
        const text = $(row).text().replace(/\s+/g, ' ').trim();
        if (!text) return;

        const nameMatch = text.match(/Adı\s*&\s*Soyadı\s*(.+)$/i);
        if (nameMatch) {
          if (current?.fullName) items.push(current);
          current = this.buildItem({
            id: `osmaniye-bel-${pageUrl}-${items.length}`,
            fullName: nameMatch[1].trim(),
            deathDate: pageDate,
            scope: this.inferScope('', ''),
            district: 'Osmaniye',
            source: 'Osmaniye Belediyesi',
            sourceUrl: pageUrl,
          });
          return;
        }
        if (!current) return;

        const condolenceMatch = text.match(/Taziye Adresi\s*(.+)$/i);
        if (condolenceMatch) {
          current.condolenceAddress = condolenceMatch[1].trim();
          current.neighborhood = this.extractNeighborhood(current.condolenceAddress);
          current.scope = this.inferScope(current.burialPlace, current.condolenceAddress);
          current.district = this.inferDistrict(current.burialPlace, current.condolenceAddress);
          return;
        }

        const burialMatch = text.match(/Defin Yeri\s*(.+)$/i);
        if (burialMatch) {
          current.burialPlace = burialMatch[1].trim();
          current.scope = this.inferScope(current.burialPlace, current.condolenceAddress);
          current.district = this.inferDistrict(current.burialPlace, current.condolenceAddress);
        }
      });
      if (current?.fullName) items.push(current);
    });

    return items;
  }

  buildOsmaniyeDailyUrls(days = 30) {
    const urls = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const slug = `${d.getDate()}-${MONTHS[d.getMonth() + 1]}-${d.getFullYear()}-${WEEKDAYS[d.getDay() === 0 ? 7 : d.getDay()]}`;
      urls.push(`https://osmaniye-bld.gov.tr/${slug}.html`);
    }
    return urls;
  }

  buildItem(raw) {
    return {
      id: raw.id,
      fullName: raw.fullName,
      deathDate: raw.deathDate || new Date().toISOString(),
      scope: raw.scope || 'osmaniye',
      detail: raw.detail || '',
      district: raw.district || '',
      neighborhood: raw.neighborhood || '',
      condolenceAddress: raw.condolenceAddress || '',
      burialPlace: raw.burialPlace || '',
      age: raw.age || null,
      source: raw.source || '',
      sourceUrl: raw.sourceUrl || '',
      detailUrl: raw.detailUrl || '',
      fetchedAt: new Date().toISOString(),
    };
  }

  inferScope(burial = '', condolence = '') {
    const text = `${burial} ${condolence}`.toLowerCase();
    if (text.includes('düziçi') || text.includes('duzici')) return 'duzici';
    if (text.includes('yarbaşı') || text.includes('yarbaşi') || text.includes('ellek')) return 'duzici';
    return 'osmaniye';
  }

  inferDistrict(burial = '', condolence = '') {
    const text = `${burial} ${condolence}`;
    if (/düziçi/i.test(text)) return 'Düziçi';
    const districts = ['Kadirli', 'Bahçe', 'Sumbas', 'Hasanbeyli', 'Toprakkale', 'Merkez'];
    for (const d of districts) {
      if (text.toLowerCase().includes(d.toLowerCase())) return d;
    }
    return 'Osmaniye';
  }

  extractNeighborhood(text = '') {
    const mahalle = text.match(/([A-Za-zÇĞİÖŞÜçğıöşü\s]+)\s+Mahalles/i);
    if (mahalle) return `${mahalle[1].trim()} Mahallesi`;
    const belde = text.match(/([A-Za-zÇĞİÖŞÜçğıöşü\s]+)\s+Beldes/i);
    if (belde) return `${belde[1].trim()} Beldesi`;
    return '';
  }

  extractBurial(detail = '') {
    const match = detail.match(/Cenazesi\s+(.+?)\s+defnedilecektir/i);
    return match ? match[1].trim() : '';
  }

  parseDate(raw = '') {
    if (!raw) return new Date().toISOString();
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`).toISOString();

    const dotted = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotted) {
      return new Date(`${dotted[3]}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}T12:00:00.000Z`).toISOString();
    }
    return new Date().toISOString();
  }

  mergeItems(items) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.MAX_AGE_DAYS);
    const seen = new Set();
    const out = [];

    for (const item of items) {
      if (!item.fullName) continue;
      if (new Date(item.deathDate) < cutoff) continue;
      const key = `${item.fullName.toLowerCase()}|${item.deathDate.substring(0, 10)}|${item.scope}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }

    out.sort((a, b) => new Date(b.deathDate) - new Date(a.deathDate));
    return out;
  }

  async readFromSupabase() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.MAX_AGE_DAYS);
      const { data, error } = await supabase
        .from('obituary_items')
        .select('*')
        .gte('death_date', cutoff.toISOString())
        .order('death_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        deathDate: row.death_date,
        scope: row.scope,
        detail: row.detail || '',
        district: row.district || '',
        neighborhood: row.neighborhood || '',
        condolenceAddress: row.condolence_address || '',
        burialPlace: row.burial_place || '',
        age: row.age,
        source: row.source || '',
        sourceUrl: row.source_url || '',
        detailUrl: row.detail_url || '',
        fetchedAt: row.fetched_at,
      }));
    } catch (err) {
      console.warn('[obituaries] Supabase read failed:', err.message);
      return [];
    }
  }

  async saveToSupabase(items) {
    if (!items.length) return;
    try {
      const rows = items.map((item) => ({
        id: item.id,
        full_name: item.fullName,
        death_date: item.deathDate,
        scope: item.scope,
        detail: item.detail,
        district: item.district,
        neighborhood: item.neighborhood,
        condolence_address: item.condolenceAddress,
        burial_place: item.burialPlace,
        age: item.age,
        source: item.source,
        source_url: item.sourceUrl,
        detail_url: item.detailUrl,
        fetched_at: item.fetchedAt,
      }));
      const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
      const db = requireSupabaseAdmin();
      const { error } = await db.from('obituary_items').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      console.log(`[obituaries] Supabase synced (${rows.length} items)`);
    } catch (err) {
      console.warn('[obituaries] Supabase write failed:', err.message);
    }
  }

  async fetchHtml(url) {
    try {
      const res = await fetchWithTimeout(url, { headers: FETCH_HEADERS });
      if (!res.ok) return null;
      return res.text();
    } catch (err) {
      console.warn(`[obituaries] fetch failed ${url}:`, err.message);
      return null;
    }
  }

  normalizeUrl(href, base) {
    if (href.startsWith('http')) return href;
    if (href.startsWith('/')) return `${base}${href}`;
    return `${base}/${href}`;
  }
}

module.exports = new ObituaryService();
