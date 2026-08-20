const cheerio = require('cheerio');
const config = require('../config');
const fileService = require('./fileService');
const {
  getTagValue,
  stripHtml,
  extractImageUrlFromHtml,
  extractOgImageFromHtml,
  decodeXmlEntities,
  normalizeText,
  normalizeForCompare,
  truncateNewsExcerpt,
  areNewsTitlesDuplicate,
  fetchWithTimeout,
  fetchPage,
  buildBrowserHeaders,
} = require('../utils/helpers');

class NewsService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      items: [],
    };
    this.RSS_ACCEPT =
      'application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.8';
    this.RSS_TIMEOUT_MS = 20000;
    this.ARTICLE_TIMEOUT_MS = 25000;
    this.SLOW_HOST_TIMEOUT_MS = 30000;
    this._currentRefreshPromise = null;
  }

  getFetchTimeoutMs(url = '') {
    const u = String(url || '');
    if (/akdenizgazetesi\.com|sabirgazetesi\.com|hasretgazetesi\.com|basakgazetesi\.com/i.test(u)) {
      return this.SLOW_HOST_TIMEOUT_MS;
    }
    if (/news\.google\.com/i.test(u)) return this.ARTICLE_TIMEOUT_MS;
    return this.ARTICLE_TIMEOUT_MS;
  }

  mapDbRowToItem(row) {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      imageUrl: row.image_url,
      images: Array.isArray(row.images) ? row.images : (row.image_url ? [row.image_url] : []),
      videoUrl: row.video_url || null,
      createdAt: row.created_at,
      sourceUrl: row.source_url,
      sourceName: row.source_name,
      category: row.category,
      verified: row.verified === true,
      isAiGenerated: row.is_ai_generated === true,
      isAiOptimized: row.is_ai_optimized === true,
      fullText: row.full_text || undefined,
    };
  }

  async getPublisherNewsFromDb(limit = 40) {
    const supabase = require('../utils/supabaseClient');
    // verified + kendi id önekleri (Türkçe source_name eq kaçın)
    const { data, error } = await supabase
      .from('news_items')
      .select('id, title, summary, image_url, images, created_at, source_url, source_name, category, video_url, verified, is_ai_generated, is_ai_optimized, full_text')
      .or('verified.eq.true,id.like.news-custom-%,id.like.news-ai-reporter-%')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => this.mapDbRowToItem(row));
  }

  prependToCache(item) {
    if (!item?.id) return;
    const rest = (this.cache.items || []).filter((x) => x.id !== item.id);
    this.cache = {
      fetchedAt: Date.now(),
      items: [item, ...rest],
    };
  }

  extractImageFromItem(itemBlock) {
    const fields = [
      getTagValue(itemBlock, 'description'),
      getTagValue(itemBlock, 'content:encoded'),
    ];
    for (const field of fields) {
      const url = extractImageUrlFromHtml(field);
      if (url) return url;
    }
    const mediaMatch = itemBlock.match(/<media:content[^>]+url="([^"]+)"/i);
    if (mediaMatch) return decodeXmlEntities(mediaMatch[1]);
    const mediaThumb = itemBlock.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
    if (mediaThumb) return decodeXmlEntities(mediaThumb[1]);
    const encMatch = itemBlock.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="[^"]*image[^"]*"/i);
    if (encMatch) return decodeXmlEntities(encMatch[1]);
    const enc2 = itemBlock.match(/<enclosure[^>]+url="([^"]+)"/i);
    if (enc2) return decodeXmlEntities(enc2[1]);
    return '';
  }

  itemQualityScore(item) {
    let score = 0;
    if (this.isOwnPublisherItem(item)) score += 100;
    if (item.verified === true) score += 40;
    if (item.imageUrl) score += 20;
    const url = String(item.sourceUrl || '');
    if (url && !/news\.google\.com/i.test(url)) score += 30;
    if (/akdenizgazetesi\.com|sabirgazetesi\.com|hasretgazetesi\.com|basakgazetesi\.com/i.test(url)) score += 10;
    if (item.sourceName && !/google news/i.test(item.sourceName)) score += 5;
    return score;
  }

  normalizeNewsTitleKey(title = '') {
    return normalizeForCompare(String(title || ''))
      .replace(/\s*-\s*(sabir|hasret|akdeniz|basak|başak|google)\s+gazetesi.*$/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  extractPubDate(itemBlock) {
    const tags = ['pubDate', 'dc:date', 'published', 'updated', 'date'];
    for (const tag of tags) {
      const raw = getTagValue(itemBlock, tag);
      if (!raw) continue;
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020) {
        return parsed.toISOString();
      }
    }
    return null;
  }

  isEligibleForPush(item) {
    const maxAgeMs = (config.NEWS.PUSH_MAX_AGE_HOURS || 36) * 60 * 60 * 1000;
    const publishedAt = item?.createdAt ? new Date(item.createdAt).getTime() : NaN;
    if (!Number.isFinite(publishedAt) || publishedAt <= 0) {
      console.log(`[news] push atlandı (yayın tarihi yok): "${item?.title || ''}"`);
      return false;
    }
    const ageMs = Date.now() - publishedAt;
    if (ageMs > maxAgeMs) {
      const hoursAgo = Math.round(ageMs / (60 * 60 * 1000));
      console.log(`[news] push atlandı (${hoursAgo} saat önce yayınlandı): "${item.title}"`);
      return false;
    }
    if (ageMs < -5 * 60 * 1000) {
      console.log(`[news] push atlandı (gelecek tarihli): "${item.title}"`);
      return false;
    }
    return true;
  }

  mergeItemPreferBetter(existing, candidate) {
    const ownExisting = this.isOwnPublisherItem(existing);
    const ownCandidate = this.isOwnPublisherItem(candidate);
    if (ownExisting && !ownCandidate) return existing;
    if (ownCandidate && !ownExisting) return candidate;

    // Dış kaynak kopyalarında: ilk yayınlanan kalsın (Sabır 09:00 > Hasret 09:30)
    const ta = new Date(existing?.createdAt || existing?.created_at || 0).getTime();
    const tb = new Date(candidate?.createdAt || candidate?.created_at || 0).getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
      const earlier = ta <= tb ? existing : candidate;
      const later = ta <= tb ? candidate : existing;
      // Daha iyi görsel/özet varsa erken kayda taşı
      if (
        !earlier.imageUrl &&
        later.imageUrl &&
        this.itemQualityScore(later) > this.itemQualityScore(earlier) + 15
      ) {
        return {
          ...earlier,
          imageUrl: later.imageUrl || earlier.imageUrl,
          summary: earlier.summary || later.summary,
        };
      }
      return earlier;
    }

    return this.itemQualityScore(candidate) > this.itemQualityScore(existing)
      ? candidate
      : existing;
  }

  isOwnPublisherItem(item) {
    if (!item) return false;
    const id = String(item.id || '');
    if (id.startsWith('news-custom-') || id.startsWith('news-ai-reporter-')) return true;
    if (item.verified === true) {
      const name = String(item.sourceName || item.source_name || '').toLowerCase();
      if (name.includes('hepsi')) return true;
    }
    const url = String(item.sourceUrl || item.source_url || '').toLowerCase();
    return url.includes('forvibe.app/duzici-news') || url.includes('forvibe.app/duzici-ai-reporter');
  }

  areDuplicateNews(existing, candidate) {
    return areNewsTitlesDuplicate(existing?.title, candidate?.title, {
      createdAtA: existing?.createdAt || existing?.created_at,
      createdAtB: candidate?.createdAt || candidate?.created_at,
    });
  }

  dedupeNewsList(items) {
    const sorted = [...items].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    const kept = [];
    for (const item of sorted) {
      const dupIndex = kept.findIndex((existing) => this.areDuplicateNews(existing, item));
      if (dupIndex >= 0) {
        kept[dupIndex] = this.mergeItemPreferBetter(kept[dupIndex], item);
      } else {
        kept.push(item);
      }
    }
    const own = kept.filter((item) => this.isOwnPublisherItem(item));
    if (own.length === 0) return kept;
    return kept.filter((item) => {
      if (this.isOwnPublisherItem(item)) return true;
      return !own.some((o) => this.areDuplicateNews(o, item));
    });
  }

  async aiDeduplicateNews(items) {
    let aiClient;
    try {
      aiClient = require('./aiClient');
    } catch (_) {
      return items;
    }

    if (!aiClient?.isConfigured?.() || !Array.isArray(items) || items.length <= 1) {
      return items;
    }

    try {
      // Son 48 saat içindeki güncel haberleri aday al
      const recentCutoff = Date.now() - 48 * 60 * 60 * 1000;
      const candidates = items.filter((item) => {
        if (!item?.createdAt) return true;
        return new Date(item.createdAt).getTime() >= recentCutoff;
      });

      if (candidates.length <= 1) return items;

      const inputList = candidates.map((item, idx) => ({
        id: item.id || String(idx),
        title: item.title,
        summary: (item.summary || '').slice(0, 140),
        source: item.sourceName,
        date: item.createdAt,
      }));

      const systemPrompt = `Sen yerel haber editörü ve tekilleştirme uzmanısın.
Sana verilen yerel haber listesinde AYNI gerçek olayı veya gelişmeyi anlatan haberleri bulup gruplandıracaksın.

KURALLAR:
1. SADECE VE SADECE tamamen aynı somut olayı (örneğin aynı kaza, aynı köprünün açılış açıklaması, aynı ziyaret, aynı yangın) anlatan haberleri birleştir.
2. Farklı olaylar (örneğin iki farklı kişinin ziyareti, iki farklı kaza, farklı kurumların açıklamaları) ASLA birleştirilmemelidir.
3. Çıktı olarak sadece ve sadece JSON formatında { "duplicateGroups": [ ["id1", "id2"], ... ] } döndür. Aynı olayı anlatan haber yoksa "duplicateGroups": [] döndür.`;

      const userPrompt = `Aşağıdaki haberleri incele ve aynı olayı anlatanları grupla:\n${JSON.stringify(inputList, null, 2)}`;

      const res = await aiClient.generateJson({ systemPrompt, userPrompt });
      const groups = res?.data?.duplicateGroups;

      if (!Array.isArray(groups) || groups.length === 0) {
        return items;
      }

      console.log(`[news:ai-dedup] AI ${groups.length} adet kopya haber grubu tespit etti.`);

      const itemMap = new Map(items.map((it) => [it.id, it]));
      const idsToRemove = new Set();

      for (const group of groups) {
        if (!Array.isArray(group) || group.length <= 1) continue;
        const groupItems = group.map((id) => itemMap.get(id)).filter(Boolean);
        if (groupItems.length <= 1) continue;

        const best = groupItems.reduce((prev, curr) => this.mergeItemPreferBetter(prev, curr));
        for (const it of groupItems) {
          if (it.id !== best.id) {
            idsToRemove.add(it.id);
            console.log(`[news:ai-dedup] "${it.title}" elendi -> "${best.title}" korundu.`);
          }
        }
      }

      return items.filter((item) => !idsToRemove.has(item.id));
    } catch (err) {
      console.warn('[news:ai-dedup] AI tekilleştirme atlandı:', err.message);
      return items;
    }
  }

  duziciKeywordRe() {
    // İlçe + mahalle/köy/yaygın yerel yer adları
    return /duzici|yarbasi|yarba[sş]i|ellek|atalan|duldul|d[uü]ld[uü]l|bocekli|b[oö]cekli|uzunban|irfanl|haruniye|ku[sş][cç]u|bostanlar|[uü]z[uü]ml[uü]|cesmeli|[cç]e[sş]meli|g[oö]kd[uü]z[uü]|karaca[oö]ren|a[gğ]izhan|bo[gğ]azi[cç]i|cumhuriyet mah|h[uü]rriyet mah/;
  }

  osmaniyeKeywordRe() {
    return /osmaniye|kadirli|bah[cç]e|hasanbeyli|toprakkale|s[uü]mba[sş]|d[uü]zi[cç]i|duzici|yarbasi|ellek|atalan|haruniye|ceyhan|erzin/;
  }

  nationalNoiseRe() {
    return /nas[iı]l yap[iı]l[iı]r|i[sş]te tam [oö]l[cç][uü]|tarifi|kabak tatl[iı]|i?neg[oö]l k[oö]fte|manda kaymak|egzama neden|dijital kart nereden|kademeli emeklilik|emekli (maa[sş]|zam|promosyon)|fenerbah[cç]e|galatasaray|be[sş]ikta[sş]|trabzonspor|super lig|s[uü]per lig|transfer iddia|o[gğ]uz ayd[iı]n|okullara g[uü]venlik g[oö]revlisi|2026 kademeli|yks tercih|milyon aday|tercihleri sona/;
  }

  farAreaNoiseRe() {
    return /\b(istanbul|ankara|izmir|bursa|antalya|adana|mersin|hatay|gaziantep|diyarbak[iı]r|konya|kayseri|zonguldak|samsun|trabzon|eski[sş]ehir|denizli|mu[gğ]la|ayd[iı]n|manisa|balıkesir|tekirda[gğ]|sakarya|kocaeli)\b/;
  }

  isDuziciRelated(title, summary) {
    const text = normalizeForCompare(`${title || ''} ${summary || ''}`);
    return this.duziciKeywordRe().test(text);
  }

  /** Başka il/ilçe odaklı haber — Düziçi feed/push'e düşmesin. */
  isNonDuziciRegionalFocus(title, summary) {
    if (this.isDuziciRelated(title, summary)) return false;
    const text = normalizeForCompare(`${title || ''} ${summary || ''}`);
    const otherDistrict =
      /\b(iskenderun|antakya|defne|arsuz|payas|samandag|samanda[gğ]|kadirli|bahce|bah[cç]e|hasanbeyli|toprakkale|s[uü]mba[sş]|ceyhan|imamoglu|karaisali|tarsus|silifke|anamur)\b/;
    if (otherDistrict.test(text)) return true;
    if (this.farAreaNoiseRe().test(text) && !this.isOsmaniyeRelated(title, summary)) return true;
    return false;
  }

  /** Push / liste: yalnızca içerikte Düziçi yer adı / ilçe sinyali. */
  isDuziciNewsItem(title, summary) {
    return this.isDuziciRelated(title, summary);
  }

  isOsmaniyeRelated(title, summary) {
    const text = normalizeForCompare(`${title || ''} ${summary || ''}`);
    return this.osmaniyeKeywordRe().test(text);
  }

  isNationalNoise(title, summary) {
    const text = normalizeForCompare(`${title || ''} ${summary || ''}`);
    if (this.nationalNoiseRe().test(text)) return true;
    // Uzak şehir + yerel sinyal yoksa çöp
    if (this.farAreaNoiseRe().test(text) && !this.isOsmaniyeRelated(title, summary)) {
      return true;
    }
    return false;
  }

  inferNewsCategory(title = '', summary = '', sourceName = '', { scope = 'auto' } = {}) {
    if (this.isDuziciRelated(title, summary)) return 'Düziçi';
    if (this.isOsmaniyeRelated(title, summary)) return 'Osmaniye';
    if (scope === 'osmaniye') return 'Osmaniye';
    const source = normalizeForCompare(sourceName || '');
    if (/hepsi/.test(source)) return 'Düziçi';
    return 'Osmaniye';
  }

  isAkdenizNews(item) {
    if (!item) return false;
    const url = String(item.sourceUrl || item.url || item.source_url || item.link || '').toLowerCase();
    const source = String(item.sourceName || item.source_name || item.source || '').toLowerCase();
    return url.includes('akdenizgazetesi') || source.includes('akdeniz');
  }

  /**
   * Scope'a göre yerel/ilçe haberlerini tut, ulusal gürültüyü ve Akdeniz haberlerini at.
   * Dedicated Düziçi feed'lerde keyword şartını yumuşatır (köy haberleri kaçmasın).
   */
  applyScopeRelevanceFilter(items, { scope = 'auto', filterDuzici = false } = {}) {
    const rawList = Array.isArray(items) ? items : [];
    const list = rawList.filter((x) => !this.isAkdenizNews(x));
    if (scope === 'duzici' && !filterDuzici) {
      return list.filter((x) => {
        if (this.isNationalNoise(x.title, x.summary)) return false;
        if (this.isNonDuziciRegionalFocus(x.title, x.summary)) return false;
        return true;
      });
    }
    if (scope === 'duzici') {
      return list.filter((x) => {
        if (this.isNationalNoise(x.title, x.summary)) return false;
        return this.isDuziciRelated(x.title, x.summary);
      });
    }
    if (filterDuzici) {
      return list.filter(
        (x) =>
          !this.isNationalNoise(x.title, x.summary) &&
          this.isDuziciRelated(x.title, x.summary),
      );
    }
    if (scope === 'osmaniye') {
      return list.filter((x) => {
        if (this.isNationalNoise(x.title, x.summary)) return false;
        return this.isOsmaniyeRelated(x.title, x.summary);
      });
    }
    return list.filter((x) => !this.isNationalNoise(x.title, x.summary));
  }

  async resolveArticleUrl(articleUrl) {
    const url = String(articleUrl || '').trim();
    if (!url || !url.startsWith('http')) return url;
    if (!/news\.google\.com|google\.com\/url/i.test(url)) return url;
    try {
      const response = await fetchPage(
        url,
        {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          dest: 'document',
          mode: 'navigate',
          site: 'cross-site',
        },
        this.getFetchTimeoutMs(url),
      );
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const data = $('c-wiz[data-p]').attr('data-p');
      if (!data) return url;
      
      const obj = JSON.parse(data.replace('%.@.', '["garturlreq",'));
      const payload = {
        'f.req': JSON.stringify([[
          ['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), 'null', 'generic']
        ]])
      };

      const postResponse = await fetchWithTimeout(
        'https://news.google.com/_/DotsSplashUi/data/batchexecute',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            ...buildBrowserHeaders('https://news.google.com/'),
          },
          body: new URLSearchParams(payload).toString(),
        },
        this.ARTICLE_TIMEOUT_MS,
      );

      const rawText = await postResponse.text();
      const cleanedText = rawText.replace(")]}'\n", "");
      const outerArray = JSON.parse(cleanedText);
      const innerDataStr = outerArray[0][2];
      const innerArray = JSON.parse(innerDataStr);
      const decodedUrl = innerArray[1];
      
      return decodedUrl || url;
    } catch (err) {
      console.warn('[news] Google News link decode failed, using original:', err.message);
      return url;
    }
  }

  parseNewsRss(xml, { max = 50, sourceName = '', filterDuzici = false, scope = 'auto' } = {}) {
    const crypto = require('crypto');
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    let parsed = itemBlocks
      .map((item, index) => {
        const title = getTagValue(item, 'title');
        const link = getTagValue(item, 'link');
        const pubDateIso = this.extractPubDate(item);
        const descriptionRaw = getTagValue(item, 'description');
        const source = getTagValue(item, 'source') || sourceName;
        const imageUrl = this.extractImageFromItem(item);
        const summary = stripHtml(descriptionRaw);
        
        const urlHash = crypto.createHash('md5').update(link || '').digest('hex');
        const resolvedSourceName = sourceName || source;
        return {
          id: `news-${urlHash}`,
          title,
          summary: summary || title,
          imageUrl: imageUrl || null,
          createdAt: pubDateIso,
          sourceUrl: link || null,
          sourceName: resolvedSourceName,
          category: this.inferNewsCategory(title, summary || title, resolvedSourceName, { scope }),
        };
      })
      .filter((x) => x.title && x.sourceUrl);
    parsed = this.applyScopeRelevanceFilter(parsed, { scope, filterDuzici });
    return parsed.slice(0, max);
  }

  async fetchRss(url) {
    const timeoutMs = this.getFetchTimeoutMs(url) || this.RSS_TIMEOUT_MS;
    try {
      const res = await fetchPage(
        url,
        {
          accept: this.RSS_ACCEPT,
          dest: 'document',
          mode: 'navigate',
          site: 'cross-site',
        },
        timeoutMs,
      );
      return res.text();
    } catch (err) {
      throw new Error(err.message?.includes('alinamadi') ? `RSS alinamadi: ${err.message}` : err.message);
    }
  }

  async resolveSources() {
    // Once city_content.json'daki news.sources'a bak; aktif olanlari kullan.
    try {
      const data = await fileService.readCityContent();
      const fromJson = Array.isArray(data?.news?.sources) ? data.news.sources : null;
      if (fromJson && fromJson.length > 0) {
        const active = fromJson
          .filter((s) => s && s.url && s.isActive !== false)
          .map((s) => ({
            url: String(s.url),
            name: String(s.name || ''),
            filterDuzici: s.filterDuzici === true,
            scope: String(s.scope || 'auto'),
          }));
        if (active.length > 0) return active;
      }
    } catch (_) {
      // JSON okunamazsa config'e dus.
    }
    return config.NEWS.SOURCES;
  }

  async scrapeNews({ max = 100 } = {}) {
    const allItems = [];
    const sources = await this.resolveSources();
    const batchSize = 3;
    for (let offset = 0; offset < sources.length; offset += batchSize) {
      const batch = sources.slice(offset, offset + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (src) => {
          const xml = await this.fetchRss(src.url);
          const perSourceMax =
            src.scope === 'duzici' && src.filterDuzici !== true ? 50 : 35;
          return this.parseNewsRss(xml, {
            max: perSourceMax,
            sourceName: src.name,
            filterDuzici: src.filterDuzici === true,
            scope: src.scope || 'auto',
          });
        }),
      );
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const src = batch[i];
        if (result.status === 'fulfilled') {
          allItems.push(...result.value);
        } else {
          console.warn(`[news] ${src.name} atlandi:`, result.reason?.message || result.reason);
        }
      }
    }
    const merged = this.mergeAndDedupeNews(allItems, max);
    if (merged.length === 0) {
      throw new Error('Hicbir kaynaktan haber alinamadi.');
    }
    return merged;
  }

  mergeAndDedupeNews(allItems, max) {
    const enriched = allItems.map((raw) => ({
      ...raw,
      category: raw.category || this.inferNewsCategory(raw.title, raw.summary, raw.sourceName),
    }));
    // Son güvenlik ağı: sync'e ulusal çöp girmesin
    const cleaned = enriched.filter((item) => !this.isNationalNoise(item.title, item.summary));
    const merged = this.dedupeNewsList(cleaned);
    const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAgeMs;
    const fresh = merged.filter((item) => {
      if (!item.createdAt) return true;
      return new Date(item.createdAt).getTime() >= cutoff;
    });
    fresh.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    // Düziçi ve Osmaniye dengeli gelsin (biri diğerini boğmasın)
    const isDuziciCat = (item) => this.isDuziciNewsItem(item.title, item.summary);
    const duzici = fresh.filter(isDuziciCat);
    const osmaniye = fresh.filter((item) => !isDuziciCat(item));
    duzici.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    const targetD = Math.min(duzici.length, Math.max(20, Math.ceil(max * 0.55)));
    const targetO = Math.min(osmaniye.length, Math.max(max - targetD, Math.floor(max * 0.4)));
    const picked = [...duzici.slice(0, targetD), ...osmaniye.slice(0, targetO)];
    picked.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    if (picked.length >= max) return picked.slice(0, max);
    // Kalan slotları diğer gruptan doldur
    const ids = new Set(picked.map((i) => i.id));
    for (const item of fresh) {
      if (picked.length >= max) break;
      if (ids.has(item.id)) continue;
      picked.push(item);
      ids.add(item.id);
    }
    return picked.slice(0, max);
  }

  async enrichItemsFromCache(items) {
    const urls = items.map((item) => item.sourceUrl).filter(Boolean);
    if (urls.length === 0) return items;

    try {
      const supabase = require('../utils/supabaseClient');
      const allData = [];
      const chunkSize = 20;
      for (let i = 0; i < urls.length; i += chunkSize) {
        const chunk = urls.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('news_items')
          .select('source_url, image_url, full_text, category, images')
          .in('source_url', chunk);
        if (error) throw error;
        if (data) allData.push(...data);
      }

      const cacheByUrl = new Map((allData || []).map((row) => [row.source_url, row]));
      return items.map((item) => {
        const cached = cacheByUrl.get(item.sourceUrl);
        if (!cached) return item;
        const excerpt = cached.full_text && cached.full_text.trim().length > 0
          ? truncateNewsExcerpt(cached.full_text)
          : null;
        return {
          ...item,
          imageUrl: item.imageUrl || cached.image_url || null,
          images: Array.isArray(cached.images) ? cached.images : (cached.image_url ? [cached.image_url] : (item.imageUrl ? [item.imageUrl] : [])),
          category: item.category || cached.category || this.inferNewsCategory(item.title, item.summary, item.sourceName),
          fullText: excerpt || item.fullText || null,
        };
      });
    } catch (err) {
      console.error('❌ Supabase news cache read failed:', err.message);
      return items;
    }
  }

  async getNews({ forceRefresh = false, max = 20 } = {}) {
    const now = Date.now();
    const isFresh = now - this.cache.fetchedAt < config.NEWS.CACHE_TTL_MS;

    // 1. Memory cache is fresh -> return immediately (publisher inject)
    if (!forceRefresh && isFresh && this.cache.items.length > 0) {
      return this.withPublisherNews(this.cache.items, max);
    }

    // 2. Memory cache is stale -> return immediately and refresh in background
    if (!forceRefresh && this.cache.items.length > 0) {
      console.log('[news] Returning stale memory cache, refreshing in background...');
      this._refreshNewsBackground(max).catch(() => {});
      return this.withPublisherNews(this.cache.items, max);
    }

    // 3. Memory cache is empty -> check Supabase database (fast cache fallback)
    if (!forceRefresh) {
      try {
        console.log('[news] Memory cache is empty, trying Supabase DB cache...');
        const supabase = require('../utils/supabaseClient');
        const { data, error } = await supabase
          .from('news_items')
          .select('id, title, summary, image_url, images, created_at, source_url, source_name, category, video_url, verified, is_ai_generated, is_ai_optimized, full_text')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data && data.length > 0) {
          const dbItems = data.map(row => this.mapDbRowToItem(row));

          // Populate memory cache (mark fetchedAt as old so background refresh triggers)
          this.cache = {
            fetchedAt: 0,
            items: dbItems,
          };

          console.log(`[news] Loaded ${dbItems.length} items from Supabase cache. Refreshing from RSS in background...`);
          this._refreshNewsBackground(max).catch(() => {});
          return dbItems.slice(0, max);
        }
      } catch (dbErr) {
        console.error('❌ Supabase news read fallback failed:', dbErr.message);
      }
    }

    // 4. Fallback (cold start AND database empty, or forceRefresh) -> fetch synchronously
    return this._fetchAndCacheNews(max);
  }

  async withPublisherNews(items, max) {
    try {
      const publisherItems = await this.getPublisherNewsFromDb(30);
      if (!publisherItems.length) return items.slice(0, max);
      return this.mergeAndDedupeNews([...publisherItems, ...items], max);
    } catch (err) {
      console.warn('[news] withPublisherNews failed:', err.message);
      return items.slice(0, max);
    }
  }

  async _refreshNewsBackground(max) {
    try {
      await this._fetchAndCacheNews(max);
      console.log('[news] Background news refresh complete.');
    } catch (e) {
      console.warn('[news] Background news refresh failed:', e.message);
    }
  }

  async _fetchAndCacheNews(max) {
    if (this._currentRefreshPromise) {
      console.log('[news] Fetch already in progress, waiting for existing promise...');
      const items = await this._currentRefreshPromise;
      return items.slice(0, max);
    }

    this._currentRefreshPromise = (async () => {
      const now = Date.now();
      let items = await this.scrapeNews({ max: Math.max(max, 120) });
      items = await this.enrichItemsFromCache(items);
      try {
        const publisherItems = await this.getPublisherNewsFromDb(40);
        if (publisherItems.length > 0) {
          items = this.mergeAndDedupeNews([...publisherItems, ...items], Math.max(max, 120));
        }
      } catch (pubErr) {
        console.warn('[news] Publisher news merge skipped:', pubErr.message);
      }

      // AI Anlamsal Tekilleştirme (Semantic Deduplication)
      try {
        items = await this.aiDeduplicateNews(items);
      } catch (aiErr) {
        console.warn('[news] AI tekilleştirme hatası:', aiErr.message);
      }
      this.cache = {
        fetchedAt: now,
        items,
      };

      // Supabase cache sync (awaited within the lock so it runs atomically)
      try {
        await this._syncNewsToSupabase(items);
      } catch (err) {
        console.error('❌ Supabase news cache sync error:', err.message);
      }

      return items;
    })();

    try {
      const items = await this._currentRefreshPromise;
      return items.slice(0, max);
    } finally {
      this._currentRefreshPromise = null;
    }
  }

  async _syncNewsToSupabase(items) {
    try {
      const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
      const newsPushLog = require('../utils/newsPushLog');
      const db = requireSupabaseAdmin();
      // Kendi yayıncı haberlerini RSS sync ile ezme (verified/video/full_text korunur)
      const syncItems = items.filter(
        (item) =>
          !(item?.id || '').startsWith('news-custom-') &&
          !(item?.id || '').startsWith('news-ai-reporter-') &&
          item?.verified !== true,
      );
      const rows = syncItems.map(item => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        image_url: item.imageUrl,
        created_at: item.createdAt,
        source_url: item.sourceUrl,
        source_name: item.sourceName,
        category: item.category,
        fetched_at: new Date().toISOString(),
        is_ai_generated: item.isAiGenerated || false,
        is_ai_optimized: item.isAiOptimized || false,
      }));

      const ids = syncItems.map(item => item.id);
      const urls = [...new Set(syncItems.map(item => item.sourceUrl).filter(Boolean))];
      const { data: existing, error: checkError } = await db
        .from('news_items')
        .select('id, title, source_url')
        .in('id', ids);

      let existingByUrl = [];
      if (urls.length > 0) {
        const urlChunkSize = 20;
        for (let i = 0; i < urls.length; i += urlChunkSize) {
          const chunk = urls.slice(i, i + urlChunkSize);
          try {
            const { data: urlRows, error: urlError } = await db
              .from('news_items')
              .select('id, title, source_url')
              .in('source_url', chunk);
            if (urlError) {
              console.error('[news] Supabase URL kontrolü başarısız:', urlError.message);
            } else if (urlRows) {
              existingByUrl.push(...urlRows);
            }
          } catch (urlErr) {
            console.error('[news] Supabase URL kontrolü başarısız:', urlErr.message);
          }
        }
      }

      if (checkError) {
        console.error('[news] Supabase mevcut haber kontrolü başarısız:', checkError.message);
      }

      if (!checkError && existing) {
        const existingIds = new Set([
          ...(existing || []).map((row) => row.id),
          ...existingByUrl.map((row) => row.id),
        ]);
        const existingUrls = new Set(existingByUrl.map((row) => row.source_url).filter(Boolean));
        const existingTitleKeys = new Set(
          [...(existing || []), ...existingByUrl]
            .map((row) => this.normalizeNewsTitleKey(row.title))
            .filter(Boolean),
        );
        const existingRows = [...(existing || []), ...existingByUrl];

        const newItems = syncItems.filter((item) => {
          if (existingIds.has(item.id)) return false;
          if (item.sourceUrl && existingUrls.has(item.sourceUrl)) return false;
          const titleKey = this.normalizeNewsTitleKey(item.title);
          if (titleKey && existingTitleKeys.has(titleKey)) return false;
          if (existingRows.some((row) => this.areDuplicateNews(row, item))) return false;
          return true;
        });

        // Aynı sync turunda Sabır+Hasret gibi kopyaları tekilleştir (ilk kalan)
        const uniqueNewItems = [];
        for (const item of [...newItems].sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return ta - tb;
        })) {
          if (uniqueNewItems.some((kept) => this.areDuplicateNews(kept, item))) continue;
          uniqueNewItems.push(item);
        }

        if (uniqueNewItems.length > 0) {
          console.log(`[news] ${uniqueNewItems.length} yeni haber tespit edildi. Push bildirimleri kontrol ediliyor...`);

          try {
            const fcmService = require('./fcmService');
            if (!fcmService.isFcmConfigured()) {
              console.warn('[news] FCM yapılandırılmamış (FIREBASE_SERVICE_ACCOUNT_JSON). Push atlanıyor.');
            } else {
              let pushCount = 0;
              const pushedKeysThisRun = new Set();

              for (const item of uniqueNewItems.slice(0, 5)) {
                if (!this.isEligibleForPush(item)) {
                  continue;
                }
                const titleKey = this.normalizeNewsTitleKey(item.title);
                if (await newsPushLog.wasPushed(item.id, titleKey)) {
                  console.log(`[news] push atlandı (daha önce gönderildi / aynı konu): "${item.title}"`);
                  continue;
                }
                if (titleKey && pushedKeysThisRun.has(titleKey)) {
                  continue;
                }
                if (
                  [...pushedKeysThisRun].length > 0 &&
                  uniqueNewItems.some(
                    (other) =>
                      other !== item &&
                      pushedKeysThisRun.has(this.normalizeNewsTitleKey(other.title)) &&
                      this.areDuplicateNews(other, item),
                  )
                ) {
                  continue;
                }

                const isDuzici = this.isDuziciNewsItem(item.title, item.summary);

                const topic = isDuzici ? 'news_duzici' : 'news_osmaniye';
                const pushTitle = isDuzici ? "Düziçi'nde Yeni Gelişme 📰" : "Osmaniye'de Yeni Gelişme 📰";

                console.log(`[news] FCM bildirim gönderiliyor: "${item.title}" -> Konu: ${topic}`);
                const result = await fcmService.sendToTopic(topic, {
                  title: pushTitle,
                  body: item.title,
                  data: {
                    route: String(item.id),
                  },
                });

                if (result.success) {
                  await newsPushLog.markPushed(item.id, titleKey);
                  if (titleKey) pushedKeysThisRun.add(titleKey);
                  pushCount += 1;
                } else {
                  console.error(`[news] FCM başarısız (${item.id}):`, result.error);
                }
              }

              if (pushCount > 0) {
                console.log(`[news] ${pushCount} haber bildirimi gönderildi.`);
              }
            }
          } catch (pushErr) {
            console.error('[news] Push bildirimleri gönderilemedi:', pushErr.message);
          }
        }

        // DB'ye yazarken: mevcut kayıtlara konu-kopyası olan YENİ satırları atla (Hasret vs Sabır)
        const skipInsertIds = new Set(
          syncItems
            .filter((item) => {
              if (existingIds.has(item.id)) return false;
              const titleKey = this.normalizeNewsTitleKey(item.title);
              if (titleKey && existingTitleKeys.has(titleKey)) return true;
              return existingRows.some((row) => this.areDuplicateNews(row, item));
            })
            .map((item) => item.id),
        );
        if (skipInsertIds.size > 0) {
          console.log(`[news] ${skipInsertIds.size} kopya haber DB'ye yazılmadı (benzer başlık).`);
        }
        const filteredSync = this.dedupeNewsList(
          syncItems.filter((item) => !skipInsertIds.has(item.id)),
        );
        rows.length = 0;
        rows.push(
          ...filteredSync.map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            image_url: item.imageUrl,
            created_at: item.createdAt,
            source_url: item.sourceUrl,
            source_name: item.sourceName,
            category: item.category,
            fetched_at: new Date().toISOString(),
            is_ai_generated: item.isAiGenerated || false,
            is_ai_optimized: item.isAiOptimized || false,
          })),
        );
      }

      if (rows.length > 0) {
        const { error: upsertError } = await db.from('news_items').upsert(rows);
        if (upsertError) {
          console.error('❌ Supabase news upsert failed:', upsertError.message);
          return;
        }
        console.log(`[news] ${rows.length} news items synced to Supabase.`);
      }

      // Arka planda yeni eklenen veya tam metni bulunmayan haberleri pre-fetch et
      this.preFetchFullTexts(syncItems).catch(err => {
        console.error('❌ Background news pre-fetch trigger error:', err.message);
      });

      // 60 günden eski dış kaynak haberlerini otomatik temizle (günde 1 kez)
      this.cleanupOldScrapedNews().catch(err => {
        console.error('❌ Background news cleanup error:', err.message);
      });
    } catch (err) {
      console.error('❌ Supabase news cache sync failed:', err.message);
    }
  }

  async cleanupOldScrapedNews({ retentionDays = 60 } = {}) {
    try {
      const now = Date.now();
      if (this._lastCleanupAt && (now - this._lastCleanupAt < 24 * 60 * 60 * 1000)) {
        return;
      }
      this._lastCleanupAt = now;

      const supabase = require('../utils/supabaseClient');
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('news_items')
        .delete()
        .lt('created_at', cutoff)
        .eq('verified', false)
        .eq('is_ai_generated', false)
        .not('id', 'like', 'news-custom-%')
        .not('id', 'like', 'news-ai-reporter-%')
        .select('id');

      if (error) {
        console.error('❌ Old news auto-cleanup error:', error.message);
      } else if (data && data.length > 0) {
        console.log(`🧹 [news] Auto-cleaned ${data.length} scraped news items older than ${retentionDays} days.`);
      }
    } catch (err) {
      console.error('❌ Old news auto-cleanup exception:', err.message);
    }
  }

  async optimizeNewsWithAI({ title, fullText }) {
    const aiClient = require('./aiClient');
    if (!aiClient.isConfigured()) {
      throw new Error('AI client is not configured.');
    }

    const systemPrompt =
      'Sen Düziçi ve Osmaniye bölgesi için çalışan usta ve profesyonel bir yerel haber editörüsün. ' +
      'Görevin, sana verilen ham haber içeriğini gazete kalitesinde, akıcı, zengin ve sürükleyici ' +
      'bütünleşik bir haber metnine dönüştürmektir. ' +
      'Gereksiz site reklamlarını, "ayrıntılar için tıklayın", spam linkleri tamamen temizle. ' +
      'Haberin olay akışını bozmadan, okuyucunun keyifle okuyacağı zengin ve net 2-3 paragraflık bir haber gövdesi oluştur. ' +
      'Yanıtını sadece belirtilen JSON formatında ver.';

    const userPrompt =
      `Ham Haber Başlığı: ${title}\n\n` +
      `Ham Haber Gövde Metni:\n${fullText}\n\n` +
      `GÖREV TALİMATLARI:\n` +
      `1. title: Haber için ilgi çekici, profesyonel ve imlası düzgün yeni bir başlık yaz (max 100 karakter).\n` +
      `2. summary: Bildirim ve liste kartları için 2 cümlelik net bir özet yaz (max 220 karakter).\n` +
      `3. fullText: Haberin tamamını akıcı, profesyonel 2 ila 4 paragraftan oluşan tek ve bütünleşik bir haber yazısı olarak kaleme al. Paragraflar arasında çift satır boşluğu bırak. Markdown (#, *) veya HTML etiketleri kullanma.\n\n` +
      `JSON FORMATI:\n` +
      `{\n` +
      `  "title": "...",\n` +
      `  "summary": "...",\n` +
      `  "fullText": "..."\n` +
      `}`;

    const { data } = await aiClient.generateJson({ systemPrompt, userPrompt });
    return {
      title: data.title || title,
      summary: data.summary || '',
      fullText: data.fullText || fullText,
    };
  }

  async preFetchFullTexts(items) {
    const supabase = require('../utils/supabaseClient');
    const urls = items.map(item => item.sourceUrl).filter(Boolean);
    if (urls.length === 0) return;

    try {
      const allData = [];
      const chunkSize = 20;
      for (let i = 0; i < urls.length; i += chunkSize) {
        const chunk = urls.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('news_items')
          .select('source_url, full_text, image_url, is_ai_optimized')
          .in('source_url', chunk);
        if (error) throw error;
        if (data) allData.push(...data);
      }

      const cachedByUrl = new Map((allData || []).map((row) => [row.source_url, row]));
      const itemsToFetch = items.filter((item) => {
        if (!item.sourceUrl) return false;
        const cached = cachedByUrl.get(item.sourceUrl);
        const hasText = cached?.full_text && cached.full_text.trim().length > 80;
        const hasImage = (cached?.image_url && cached.image_url.trim()) || (item.imageUrl && item.imageUrl.trim());
        return !hasText || !hasImage;
      });

      if (itemsToFetch.length === 0) return;

      console.log(`[news] Arka planda ${itemsToFetch.length} adet haber detayi cekiliyor...`);

      const limit = 3;
      for (let i = 0; i < itemsToFetch.length; i += limit) {
        const chunk = itemsToFetch.slice(i, i + limit);
        await Promise.all(chunk.map(async (item) => {
          try {
            if (/news\.google\.com/i.test(item.sourceUrl || '')) {
              return;
            }
            const details = await this.fetchArticleDetails(item.sourceUrl);
            const update = {};

            // AI Beautification
            let optimized = null;
            let beautifyEnabled = config.AI_NEWS.BEAUTIFY_SCRAPED;
            let cityContent = null;
            try {
              cityContent = await fileService.readCityContent();
              if (cityContent?.aiNewsSettings?.beautifyScraped !== undefined) {
                beautifyEnabled = cityContent.aiNewsSettings.beautifyScraped === true;
              }
            } catch (_) {}

            if (beautifyEnabled && details.fullText && details.fullText.trim().length > 80) {
              try {
                const settings = cityContent?.aiNewsSettings || {};
                const dailyLimit = Number(settings.beautifyDailyLimit ?? 25);
                const today = new Date().toISOString().slice(0, 10);
                let countToday = Number(settings.beautifyCountToday || 0);
                if (settings.beautifyCountDate !== today) {
                  countToday = 0;
                }
                const alreadyOptimized = cachedByUrl.get(item.sourceUrl)?.is_ai_optimized === true;
                if (!alreadyOptimized && (dailyLimit <= 0 || countToday < dailyLimit)) {
                  console.log(`[news-ai] Optimizing scraped article with AI: ${item.sourceUrl}`);
                  optimized = await this.optimizeNewsWithAI({
                    title: item.title,
                    fullText: details.fullText
                  });
                  if (optimized && cityContent) {
                    settings.beautifyCountDate = today;
                    settings.beautifyCountToday = countToday + 1;
                    settings.lastBeautifyAt = new Date().toISOString();
                    settings.lastBeautifyOk = true;
                    cityContent.aiNewsSettings = settings;
                    await fileService.writeCityContent(cityContent).catch(() => {});
                  }
                }
              } catch (aiErr) {
                console.warn(`[news-ai] AI optimization failed for ${item.sourceUrl}:`, aiErr.message);
              }
            }

            if (optimized) {
              update.title = optimized.title;
              update.summary = optimized.summary;
              update.full_text = optimized.fullText;
              update.is_ai_optimized = true;
            } else {
              if (details.fullText && details.fullText.trim().length > 0) {
                update.full_text = details.fullText;
              }
            }

            if (details.imageUrl && details.imageUrl.trim().length > 0) {
              update.image_url = details.imageUrl;
            }
            if (details.images && details.images.length > 0) {
              update.images = details.images;
            }
            if (Object.keys(update).length > 0) {
              await supabase
                .from('news_items')
                .update(update)
                .eq('source_url', item.sourceUrl);
              console.log(`[news] Arka planda haber detayi onbellege alindi: ${item.sourceUrl}`);
            }
          } catch (e) {
            console.error(`[news] Arka planda haber detayi cekme basarisiz (${item.sourceUrl}):`, e.message);
          }
        }));
      }
    } catch (err) {
      console.error('❌ Arka plan haber onbellekleme kontrolu basarisiz:', err.message);
    }
  }

  extractContainerContent(html, regex) {
    const match = html.match(regex);
    if (!match) return null;
    const startTag = match[0];
    const tagMatch = startTag.match(/^<([a-z1-6]+)/i);
    if (!tagMatch) return null;
    const tagName = tagMatch[1].toLowerCase();
    
    const startIdx = html.indexOf(startTag);
    const contentStartIdx = startIdx + startTag.length;
    
    const openToken = `<${tagName}`;
    const closeToken = `</${tagName}>`;
    
    const openRegex = new RegExp(openToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    const closeRegex = new RegExp(closeToken.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    
    let openTags = 1;
    let pos = contentStartIdx;
    
    const regexIndexOf = (str, re, start) => {
      const idx = str.substring(start).search(re);
      return idx >= 0 ? idx + start : -1;
    };
    
    while (openTags > 0 && pos < html.length) {
      const nextOpen = regexIndexOf(html, openRegex, pos);
      const nextClose = regexIndexOf(html, closeRegex, pos);
      
      if (nextClose === -1) break;
      
      if (nextOpen !== -1 && nextOpen < nextClose) {
        openTags++;
        pos = nextOpen + openToken.length;
      } else {
        openTags--;
        pos = nextClose + closeToken.length;
      }
    }
    
    return html.slice(contentStartIdx, pos - closeToken.length);
  }

  async fetchArticleHtml(articleUrl) {
    const resolvedUrl = await this.resolveArticleUrl(articleUrl);
    const url = String(resolvedUrl || '').trim();
    if (!url || !url.startsWith('http')) {
      throw new Error('Gecersiz URL');
    }
    const res = await fetchPage(
      url,
      {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        dest: 'document',
        mode: 'navigate',
        site: 'cross-site',
      },
      this.getFetchTimeoutMs(url),
    );
    const buf = Buffer.from(await res.arrayBuffer());
    let html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const replacementRatio = (html.match(/\uFFFD/g) || []).length / Math.max(html.length, 1);
    if (replacementRatio > 0.001) {
      try {
        html = new TextDecoder('windows-1254', { fatal: false }).decode(buf);
      } catch (_) {
        html = buf.toString('latin1');
      }
    }
    return { html, resolvedUrl: url };
  }

  async fetchArticleImage(articleUrl) {
    const { html } = await this.fetchArticleHtml(articleUrl);
    const imageUrl = extractOgImageFromHtml(html);
    return imageUrl || null;
  }

  extractArticleSlug(articleUrl) {
    try {
      const path = new URL(String(articleUrl || '')).pathname;
      const slug = path.split('/').filter(Boolean).pop() || '';
      return slug.replace(/\.html?$/i, '').toLowerCase();
    } catch (_) {
      return '';
    }
  }

  imageBelongsToArticle(url, slug) {
    if (!slug) return true;
    const u = String(url || '').toLowerCase();
    if (u.includes(slug)) return true;
    const filename = u.split('/').pop().replace(/\.\w+$/, '').replace(/\d+$/, '');
    const slugCore = slug.slice(0, Math.min(slug.length, 24));
    return filename.includes(slugCore);
  }

  filterImagesForArticle(images, articleUrl) {
    const slug = this.extractArticleSlug(articleUrl);
    if (!slug) return images.slice(0, 8);
    const filtered = images.filter((url) => this.imageBelongsToArticle(url, slug));
    if (filtered.length > 0) return filtered.slice(0, 8);
    return images.slice(0, 1);
  }

  isInsideForeignArticleLink($, el, articleSlug) {
    if (!articleSlug) return false;
    const $link = $(el).closest('a[href]');
    if (!$link.length) return false;
    const href = String($link.attr('href') || '').toLowerCase();
    if (!href || href === '#' || href.startsWith('javascript:')) return false;
    if (href.includes(articleSlug)) return false;
    if (/\/[a-z0-9][\w-]{8,}/i.test(href) && !href.includes(articleSlug.slice(0, 16))) {
      return true;
    }
    return false;
  }

  resolveImgSrc($el) {
    const attrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-lazy'];
    for (const attr of attrs) {
      const val = String($el.attr(attr) || '').trim();
      if (!val || val.startsWith('data:')) continue;
      if (val.startsWith('http')) return val;
      if (val.startsWith('//')) return `https:${val}`;
    }
    const srcset = String($el.attr('srcset') || '').trim();
    if (srcset) {
      const best = srcset
        .split(',')
        .map((part) => part.trim().split(/\s+/))
        .filter((parts) => parts[0])
        .sort((a, b) => {
          const wA = parseInt(a[1], 10) || 0;
          const wB = parseInt(b[1], 10) || 0;
          return wB - wA;
        })[0];
      if (best && best[0]) {
        const url = best[0];
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return `https:${url}`;
      }
    }
    return null;
  }

  normalizeImageUrlForDedup(url) {
    try {
      const u = new URL(url);
      u.hash = '';
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'].forEach((k) => {
        u.searchParams.delete(k);
      });
      return u.toString().replace(/\/+$/, '');
    } catch (_) {
      return String(url || '').trim();
    }
  }

  isNoiseImageUrl(url) {
    const u = String(url || '').toLowerCase();
    if (!u.startsWith('http')) return true;
    if (/logo|icon|avatar|sprite|favicon|widget|google-news|emoji|badge|pixel|spacer|placeholder|blank\.gif|1x1\.|tracking|doubleclick|googlesyndication|facebook\.com\/tr|gravatar|profile|yazar|author|social|sosyal|share|paylas/i.test(u)) {
      return true;
    }
    if (/\b(related|ilgili|sidebar|banner|reklam|advert|\bads?\b|thumb(?:nail)?|small)\b/i.test(u)) {
      return true;
    }
    // WordPress / CDN kucuk onizleme boyutlari (ilgili haber listelerinde cok yaygin)
    if (/-\d{2,3}x\d{2,3}\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) {
      return true;
    }
    if (/\/crop\/\d{2,3}x\d{2,3}\//i.test(u)) {
      return true;
    }
    if (/[?&](w|width|h|height)=\d{1,3}(?:&|$)/i.test(u)) {
      return true;
    }
    return false;
  }

  isNoiseImageElement($, el) {
    const $el = $(el);
    const ancestors = $el.parents().addBack();
    const noiseClassRe = /share|sosyal|social|related|ilgili|comment|yorum|sidebar|breadcrumb|tag-list|tags|author|byline|meta|footer|menu|popup|modal|advert|\bads?\b|banner|newsletter|subscribe|widget|toolbar|read-more|next-prev|pagination|cookie|post-info|post-meta|haber-info|haber-meta|stats|tools|other-news|diger-haber|son-haber|editor|muhabir/i;
    for (let i = 0; i < ancestors.length; i++) {
      const node = ancestors.eq(i);
      const cls = String(node.attr('class') || '');
      const id = String(node.attr('id') || '');
      if (noiseClassRe.test(cls) || noiseClassRe.test(id)) return true;
      if (node.is('nav, header, footer, aside, figure figcaption')) return true;
    }
    const width = parseInt($el.attr('width'), 10);
    const height = parseInt($el.attr('height'), 10);
    if ((width > 0 && width < 120) || (height > 0 && height < 120)) return true;
    return false;
  }

  findArticleBodyContainer($) {
    $('script, style, noscript, nav, header, footer, aside, form, iframe, svg').remove();
    const noiseClassRe = /share|sosyal|social|related|ilgili|comment|yorum|sidebar|breadcrumb|tag-list|tags|author|byline|meta|footer|menu|popup|modal|advert|\bads?\b|banner|newsletter|subscribe|widget|toolbar|read-more|next-prev|pagination|cookie|post-info|post-meta|haber-info|haber-meta|stats|tools|other-news|diger-haber|son-haber/i;
    $('[class],[id]').each((_, el) => {
      const $node = $(el);
      const cls = String($node.attr('class') || '');
      const id = String($node.attr('id') || '');
      if (noiseClassRe.test(cls) || noiseClassRe.test(id)) {
        $node.remove();
      }
    });

    const bodySelectors = [
      'div[itemprop="articleBody"]',
      'div[property="articleBody"]',
      '.article-body',
      '.entry-content',
      '.article-content',
      '.post-content',
      '.news-content',
      '.haber-icerik',
      '.haberDetay',
      '.haber-detay',
      '.content-body',
      '.article__body',
      '.article-text',
      '.story-body',
      '.detail-content',
      'article',
      'main',
    ];

    for (const sel of bodySelectors) {
      const $candidate = $(sel).first();
      if ($candidate.length && $candidate.text().trim().length > 100) {
        return $candidate;
      }
    }
    return $('body');
  }

  extractArticleImages(html, articleUrl = '') {
    const MAX_IMAGES = 8;
    const images = [];
    const seen = new Set();
    const slug = this.extractArticleSlug(articleUrl);
    const addImage = ($, el) => {
      if (images.length >= MAX_IMAGES) return;
      if (this.isNoiseImageElement($, el)) return;
      if (this.isInsideForeignArticleLink($, el, slug)) return;
      const src = this.resolveImgSrc($(el));
      if (!src || this.isNoiseImageUrl(src)) return;
      const key = this.normalizeImageUrlForDedup(src);
      if (seen.has(key)) return;
      seen.add(key);
      images.push(src);
    };

    try {
      const $ = cheerio.load(html);

      // 1) Kapak / hero gorseli (icerik metninin ustundeki ana foto)
      const heroSelectors = [
        'article .col-lg-8 .inner img',
        'article .position-relative.d-block img',
        '.detail-photo img',
        '.detail-image img',
        '.post-thumbnail img',
        'article header img',
      ];
      for (const sel of heroSelectors) {
        $(sel).each((_, el) => addImage($, el));
        if (images.length > 0) break;
      }

      // 2) Sadece haber metni alanindaki gorseller (paragraf / figure)
      const contentSelectors = [
        '.article-text p img',
        '.article-text figure img',
        '.entry-content p img',
        '.entry-content figure img',
        '.article-body p img',
        '.article-body figure img',
        '.haber-icerik p img',
        '.haber-detay p img',
        'div[itemprop="articleBody"] p img',
        'div[itemprop="articleBody"] figure img',
        '.post-content p img',
        '.news-content p img',
      ];
      for (const sel of contentSelectors) {
        $(sel).each((_, el) => addImage($, el));
      }
    } catch (e) {
      console.error('[news] Failed to extract article images:', e.message);
    }
    return this.filterImagesForArticle(images, articleUrl);
  }

  async fetchArticleImages(articleUrl) {
    const { html } = await this.fetchArticleHtml(articleUrl);
    const imageUrl = extractOgImageFromHtml(html) || null;
    const bodyImages = this.extractArticleImages(html, articleUrl);
    const images = [];
    if (imageUrl && this.imageBelongsToArticle(imageUrl, this.extractArticleSlug(articleUrl))) {
      images.push(imageUrl);
    } else if (imageUrl && bodyImages.length === 0) {
      images.push(imageUrl);
    }
    for (const src of bodyImages) {
      if (!images.includes(src)) images.push(src);
      if (images.length >= 8) break;
    }
    return { imageUrl: images[0] || imageUrl, images };
  }

  async fetchArticleDetails(articleUrl) {
    const { html } = await this.fetchArticleHtml(articleUrl);
    const imageUrl = extractOgImageFromHtml(html) || null;
    const fullText = this.parseArticleHtmlToText(html);
    
    // Tüm resimleri çek ve ana resmi ilk sıraya yerleştir (max 8)
    const bodyImages = this.extractArticleImages(html, articleUrl);
    const slug = this.extractArticleSlug(articleUrl);
    const images = [];
    if (imageUrl && (this.imageBelongsToArticle(imageUrl, slug) || bodyImages.length === 0)) {
      images.push(imageUrl);
    }
    for (const src of bodyImages) {
      if (!images.includes(src)) {
        images.push(src);
      }
      if (images.length >= 8) break;
    }
    
    return { fullText, imageUrl: images[0] || imageUrl, images };
  }

  async fetchArticleFullText(articleUrl) {
    const { html } = await this.fetchArticleHtml(articleUrl);
    return this.parseArticleHtmlToText(html);
  }

  parseArticleHtmlToText(html) {
    try {
      const $ = cheerio.load(html);

      // 1. Gürültü ve reklam elementlerini kaldır
      $('script, style, noscript, nav, header, footer, aside, form, iframe, svg, button, figcaption, .post-flash, .article-source, [id^="ad_"], [class*="advert"], [class*="banner"], [class*="share"], [class*="sosyal"], [class*="related"]').remove();

      // 2. Makale gövde kapsayıcısını bul
      const selectors = [
        '[property="articleBody"]',
        '[itemprop="articleBody"]',
        '.article-text',
        '.article-body',
        '.entry-content',
        '.post-content',
        '.haber-icerik',
        '.haberDetay',
        '.haber-detay',
        'article',
        'main',
      ];

      let $container = null;
      for (const sel of selectors) {
        const candidate = $(sel).first();
        if (candidate.length && candidate.text().trim().length > 80) {
          $container = candidate;
          break;
        }
      }

      if (!$container) {
        $container = $('body');
      }

      // 3. Paragrafları ve alt başlıkları temiz bir şekilde topla
      const blocks = [];
      $container.find('p, h1, h2, h3, h4, h5, h6, li, blockquote').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        const noiseLineRe = /^(paylaş|paylas|tweet|linkedin|pinterest|telegram|whatsapp|yazdır|yazdir|kopyala|facebook|reddit|önceki|sonraki|paylaşım|yorum|haber merkezi|editör|yayınlanma|güncelleme|reklam|sponsor|abone ol|kategori|etiket|tüm hakları saklıdır|copyright|©.*|kaynak\s*:.*|muhabir\s*:.*|içeriği görüntüle.*|https?:\/\/\S+)$/i;
        if (text.length > 20 && !noiseLineRe.test(text) && !blocks.includes(text)) {
          blocks.push(text);
        }
      });

      if (blocks.length > 0) {
        return blocks.join('\n\n');
      }

      return $container.text().replace(/\s+/g, ' ').trim();
    } catch (e) {
      console.error('[news] Cheerio parser failed:', e.message);
      return '';
    }
  }
}

module.exports = new NewsService();
