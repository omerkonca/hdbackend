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
  fetchWithTimeout,
} = require('../utils/helpers');

class NewsService {
  constructor() {
    this.cache = {
      fetchedAt: 0,
      items: [],
    };
    this.FETCH_OPTIONS = {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      },
    };
  }

  extractImageFromItem(itemBlock) {
    const desc = getTagValue(itemBlock, 'description');
    let url = extractImageUrlFromHtml(desc);
    if (url) return url;
    const mediaMatch = itemBlock.match(/<media:content[^>]+url="([^"]+)"/i);
    if (mediaMatch) return decodeXmlEntities(mediaMatch[1]);
    const encMatch = itemBlock.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="[^"]*image[^"]*"/i);
    if (encMatch) return decodeXmlEntities(encMatch[1]);
    const enc2 = itemBlock.match(/<enclosure[^>]+url="([^"]+)"/i);
    if (enc2) return decodeXmlEntities(enc2[1]);
    return '';
  }

  duziciKeywordRe() {
    return /duzici|yarbasi|ellek|atalan|duldul/;
  }

  isDuziciRelated(title, summary) {
    const text = normalizeForCompare(`${title || ''} ${summary || ''}`);
    return this.duziciKeywordRe().test(text);
  }

  inferNewsCategory(title = '', summary = '', sourceName = '', { scope = 'auto' } = {}) {
    if (scope === 'osmaniye') return 'Osmaniye';
    if (this.isDuziciRelated(title, summary)) return 'Düziçi';
    return 'Osmaniye';
  }

  async resolveArticleUrl(articleUrl) {
    const url = String(articleUrl || '').trim();
    if (!url || !url.startsWith('http')) return url;
    if (!/news\.google\.com|google\.com\/url/i.test(url)) return url;
    try {
      const response = await fetchWithTimeout(url, { headers: this.FETCH_OPTIONS.headers });
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
            'user-agent': this.FETCH_OPTIONS.headers['user-agent']
          },
          body: new URLSearchParams(payload).toString()
        }
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
        const pubDate = getTagValue(item, 'pubDate');
        const descriptionRaw = getTagValue(item, 'description');
        const source = getTagValue(item, 'source') || sourceName;
        const imageUrl = this.extractImageFromItem(item);
        const summary = stripHtml(descriptionRaw);
        
        const urlHash = crypto.createHash('md5').update(link || '').digest('hex');
        const resolvedSourceName = source || sourceName;
        return {
          id: `news-${urlHash}`,
          title,
          summary: summary || title,
          imageUrl: imageUrl || null,
          createdAt: new Date(pubDate || Date.now()).toISOString(),
          sourceUrl: link || null,
          sourceName: resolvedSourceName,
          category: this.inferNewsCategory(title, summary || title, resolvedSourceName, { scope }),
        };
      })
      .filter((x) => x.title && x.sourceUrl);
    if (filterDuzici || scope === 'duzici') {
      parsed = parsed.filter((x) => this.isDuziciRelated(x.title, x.summary));
    }
    return parsed.slice(0, max);
  }

  async fetchRss(url) {
    const res = await fetchWithTimeout(url, this.FETCH_OPTIONS);
    if (!res.ok) throw new Error(`RSS alinamadi: ${res.status}`);
    return res.text();
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

  async scrapeNews({ max = 30 } = {}) {
    const allItems = [];
    const sources = await this.resolveSources();
    for (const src of sources) {
      try {
        const xml = await this.fetchRss(src.url);
        const items = this.parseNewsRss(xml, {
          max: 25,
          sourceName: src.name,
          filterDuzici: src.filterDuzici === true,
          scope: src.scope || 'auto',
        });
        allItems.push(...items);
      } catch (err) {
        console.warn(`[news] ${src.name} atlandi:`, err.message);
      }
    }
    const merged = this.mergeAndDedupeNews(allItems, max);
    if (merged.length === 0) {
      throw new Error('Hicbir kaynaktan haber alinamadi.');
    }
    return merged;
  }

  mergeAndDedupeNews(allItems, max) {
    const seen = new Set();
    const merged = [];
    for (const item of allItems) {
      const key = (item.sourceUrl || '') + (item.title || '');
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({
        ...item,
        category: item.category || this.inferNewsCategory(item.title, item.summary, item.sourceName),
      });
    }
    const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAgeMs;
    const fresh = merged.filter(
      (item) => new Date(item.createdAt).getTime() >= cutoff,
    );
    fresh.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return fresh.slice(0, max);
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
          .select('source_url, image_url, full_text, category')
          .in('source_url', chunk);
        if (error) throw error;
        if (data) allData.push(...data);
      }

      const cacheByUrl = new Map((allData || []).map((row) => [row.source_url, row]));
      return items.map((item) => {
        const cached = cacheByUrl.get(item.sourceUrl);
        if (!cached) return item;
        return {
          ...item,
          imageUrl: item.imageUrl || cached.image_url || null,
          category: item.category || cached.category || this.inferNewsCategory(item.title, item.summary, item.sourceName),
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
    if (!forceRefresh && isFresh && this.cache.items.length > 0) {
      return this.cache.items.slice(0, max);
    }
    let items = await this.scrapeNews({ max: Math.max(max, 80) });
    items = await this.enrichItemsFromCache(items);
    this.cache = {
      fetchedAt: now,
      items,
    };

    // Supabase cache sync
    try {
      const supabase = require('../utils/supabaseClient');
      const rows = items.map(item => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        image_url: item.imageUrl,
        created_at: item.createdAt,
        source_url: item.sourceUrl,
        source_name: item.sourceName,
        category: item.category,
        fetched_at: new Date().toISOString(),
      }));
      await supabase.from('news_items').upsert(rows);
      console.log(`[news] ${rows.length} news items synced to Supabase.`);

      // Arka planda yeni eklenen veya tam metni bulunmayan haberleri pre-fetch et
      this.preFetchFullTexts(items).catch(err => {
        console.error('❌ Background news pre-fetch trigger error:', err.message);
      });
    } catch (err) {
      console.error('❌ Supabase news cache sync failed:', err.message);
    }

    return items.slice(0, max);
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
          .select('source_url, full_text, image_url')
          .in('source_url', chunk);
        if (error) throw error;
        if (data) allData.push(...data);
      }

      const cachedByUrl = new Map((allData || []).map((row) => [row.source_url, row]));
      const itemsToFetch = items.filter((item) => {
        if (!item.sourceUrl) return false;
        const cached = cachedByUrl.get(item.sourceUrl);
        const hasText = cached?.full_text && cached.full_text.trim().length > 300;
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
            const details = await this.fetchArticleDetails(item.sourceUrl);
            const update = {};
            if (details.fullText && details.fullText.trim().length > 0) {
              update.full_text = details.fullText;
            }
            if (details.imageUrl && details.imageUrl.trim().length > 0) {
              update.image_url = details.imageUrl;
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
    
    let openTags = 1;
    let pos = contentStartIdx;
    while (openTags > 0 && pos < html.length) {
      const nextOpen = html.toLowerCase().indexOf(openToken, pos);
      const nextClose = html.toLowerCase().indexOf(closeToken, pos);
      
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
    const res = await fetchWithTimeout(url, this.FETCH_OPTIONS);
    if (!res.ok) throw new Error(`Sayfa alinamadi: ${res.status}`);
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

  async fetchArticleDetails(articleUrl) {
    const { html } = await this.fetchArticleHtml(articleUrl);
    const imageUrl = extractOgImageFromHtml(html) || null;
    const fullText = this.parseArticleHtmlToText(html);
    return { fullText, imageUrl };
  }

  async fetchArticleFullText(articleUrl) {
    const { html } = await this.fetchArticleHtml(articleUrl);
    return this.parseArticleHtmlToText(html);
  }

  parseArticleHtmlToText(html) {
    // 1) Tum sayfada gurultu olabilecek blok tag'leri ic icerik ile birlikte sil.
    const noiseTags = [
      'script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside',
      'form', 'iframe', 'svg', 'button', 'figcaption',
    ];
    for (const tag of noiseTags) {
      html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
      html = html.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi'), ' ');
    }

    // 2) Class/id ismi tipik gurultu kelimelerini iceren kapsayicilari sil.
    const noiseAttrPattern = '(share|sosyal|social|related|ilgili|comment|yorum|sidebar|breadcrumb|tag-list|tags|author|byline|meta|footer|menu|popup|modal|advert|\\bads?\\b|banner|newsletter|subscribe|widget|toolbar|read-more|next-prev|pagination|cookie|post-info|post-meta|haber-info|haber-meta|stats|tools)';
    const noiseAttrRegex = new RegExp(
      `<(div|section|ul|ol|aside|p|span)[^>]*\\b(class|id)\\s*=\\s*"[^"]*${noiseAttrPattern}[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`,
      'gi',
    );
    for (let i = 0; i < 4; i++) {
      const next = html.replace(noiseAttrRegex, ' ');
      if (next === html) break;
      html = next;
    }

    // 2.5) Haber spotunu/özetini (Genellikle h2 itemprop="description") bulup temizle
    const spotCandidates = [
      /<h2[^>]*itemprop\s*=\s*"description"[^>]*>/i,
      /<div[^>]*class\s*=\s*"[^"]*(?:article-spot|haber-spot|spot-haber|post-spot|entry-summary)[^"]*">/i,
      /<h2[^>]*class\s*=\s*"[^"]*(?:spot|summary)[^"]*">/i,
    ];
    let spot = '';
    for (const re of spotCandidates) {
      const match = html.match(re);
      if (match) {
        const content = this.extractContainerContent(html, re);
        if (content) {
          spot = stripHtml(content).trim();
          if (spot.length > 10) break;
        }
      }
    }
    if (spot) {
      spot = decodeXmlEntities(spot);
    }

    // 3) Oncelikli secicilerle haber govdesini bul.
    const bodyCandidates = [
      /<div[^>]*itemprop\s*=\s*"articleBody"[^>]*>/i,
      /<div[^>]*property\s*=\s*"articleBody"[^>]*>/i,
      /<div[^>]*class\s*=\s*"[^"]*(?:article-body|entry-content|article-content|post-content|news-content|haber-icerik|haberDetay|haber-detay|content-body|article__body|article-text)[^"]*>/i,
      /<article[^>]*>/i,
      /<main[^>]*>/i,
    ];
    let main = '';
    for (const re of bodyCandidates) {
      const match = html.match(re);
      if (match) {
        const content = this.extractContainerContent(html, re);
        if (content && content.replace(/<[^>]+>/g, '').trim().length > 100) {
          main = content;
          break;
        }
      }
    }
    if (!main) {
      main = html
        .replace(/^[\s\S]*<body[^>]*>/i, '')
        .replace(/<\/body>[\s\S]*$/i, '');
    }

    // 4) Paragraf bazli ayrim: <p>, <h*>, <li>, <br><br> sinirlarinda kes.
    const blocks = main
      .replace(/<br\s*\/?\>(\s*<br\s*\/?\>)+/gi, '</p><p>')
      .split(/<\/(?:p|h[1-6]|li|blockquote|div)>/i)
      .map((part) => stripHtml(part))
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    // 5) Satir/paragraf seviyesinde gurultu temizligi.
    const noiseLineRe = /^(paylaş|paylas|tweet|linkedin|pinterest|telegram|whatsapp|yazdır|yazdir|kopyala|facebook|reddit|önceki|onceki|sonraki|paylaşım|paylasim|yorum( yap)?|haber merkezi|editör|editor|yayınlanma|yayinlanma|güncelleme|guncelleme|okunma süresi|okunma suresi|a\s*-\s*a\s*\+|a\s*\+\s*a\s*-|reklam|sponsor|abone ol|kategori|etiket|tarih|tüm hakları saklıdır|copyright|©.*|kaynak\s*:.*|muhabir\s*:.*|editörün seçtiği.*|editorun sectigi.*|içeriği görüntüle.*|icerigi goruntule.*|https?:\/\/\S+)$/i;
    const shareWordsRe = /\b(paylaş|paylas|tweet|linkedin|pinterest|telegram|whatsapp|yazdır|yazdir|kopyala|facebook|reddit|paylaşım|paylasim)\b/gi;
    const metaPrefixRe = /^(editör|editor|muhabir|yayınlanma|yayinlanma|güncelleme|guncelleme|paylaşım|paylasim|okunma|haber merkezi|kategori|etiket|tarih|tag(s)?|\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4})\b/i;
    const generalMetaRe = /\b(yayınlanma|yayinlanma|güncelleme|guncelleme|okunma süresi|okunma suresi|haber merkezi)\b/i;

    const cleaned = blocks.filter((line) => {
      if (line.length < 25) return false;
      if (noiseLineRe.test(line)) return false;
      if (metaPrefixRe.test(line) && line.length < 120) return false;
      if (generalMetaRe.test(line) && line.length < 120) return false;
      const words = line.split(/\s+/);
      const matches = line.match(shareWordsRe) || [];
      if (words.length > 0 && matches.length / words.length > 0.25) return false;
      // Sadece tarih/saat ve sayilardan olusan satirlar (meta).
      const lettersOnly = line.replace(/[^a-zçğıöşü]/gi, '');
      if (lettersOnly.length < 10) return false;
      return true;
    });

    let finalBlocks = [...cleaned];
    if (spot && spot.length > 15) {
      // Eğer spot metni temizlenmiş paragrafların ilkinde zaten geçmiyorsa en başa ekle
      const firstBlock = finalBlocks[0] || '';
      if (!firstBlock.toLowerCase().includes(spot.slice(0, 15).toLowerCase())) {
        finalBlocks.unshift(spot);
      }
    }

    let text = finalBlocks.join('\n\n');
    if (text.length < 200) {
      text = normalizeText(stripHtml(main));
    }

    // 6) Editor/meta satirlari ve onlara baglı kuyruk gurultusunu kes.
    //    "Editörün Seçtiği ..." baslayan kisim ve sonrasini at.
    const cutMarkers = [
      /Edit[oö]r[uü]n\s*Se[cç]ti[gğ]i/i,
      /Muhabir\s*:/i,
      /Haber Merkezi(?:\s|$)/i,
      /Edit[oö]r\s*Hakk[ıi]nda/i,
      /İlgili\s*Haberler/i,
      /Etiketler\s*:/i,
      /Yorumlar\s*\(/i,
      /Yorum\s*Yaz/i,
      /Bunlar\s+da\s+ilgini(?:zi)?\s+çekebilir/i,
      /Daha\s+fazla(?:\s+haber)?/i,
      /Son\s+Haberler(?:\s|$)/i,
    ];
    for (const re of cutMarkers) {
      const m = text.match(re);
      if (m && m.index > 200) {
        text = text.slice(0, m.index).trim();
        break;
      }
    }

    // 7) Sonek olarak yine kalmis "Paylas Linkedin..." kuyruklarini at.
    text = text.replace(/(?:\b(?:paylaş|paylas|tweet|linkedin|pinterest|telegram|whatsapp|yazdır|yazdir|kopyala|facebook|reddit)\b[\s,;\-•|]*){2,}/gi, ' ');
    // Editor 30.04.2026 - 14:05 Yayınlanma 1 ... gibi inline meta blogu.
    text = text.replace(/Edit[oö]r\s*\d{1,2}\.\d{1,2}\.\d{2,4}[\s\S]*?(?:Okunma\s*S[uü]resi|A\s*[-+]\s*A\s*[+-])/gi, ' ');
    // "A - A +" yazi boyutu kontrolu - kelime siniri olmadan.
    text = text.replace(/A\s*[-+]\s*A\s*[+-]/g, ' ');
    // "--> ... İçeriği Görüntüle" gibi "ilgili icerik" satirlarini at.
    text = text.replace(/-->[^\n]*?İçeriği\s*Görüntüle[^\n]*/gi, ' ');
    text = text.replace(/İçeriği\s*Görüntüle/gi, ' ');

    // 8) Paragraf bazli son temizlik:
    //    - Sonda kalmis "haber basligi" gorunumlu paragraflari kes
    //      (cumle gibi olmayan, ! ile biten ya da cok kisa olanlar).
    let paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const isLikelyTitle = (p) => {
      if (!p) return true;
      if (p.length < 40) return true;
      // Cumle bitirici (. ! ?) ile bitmiyorsa ve uzun degilse, baslik gibi.
      if (!/[.!?…]\s*$/.test(p) && p.length < 220) return true;
      // ! veya ? ile biten kisa metinler - clickbait basligi.
      if (/[!?]\s*$/.test(p) && p.length < 220) return true;
      // Tek cumle, virgulsuz ve kisa: yine baslik olabilir.
      const sentences = p.split(/[.!?]+\s+/).filter(Boolean);
      if (sentences.length === 1 && p.length < 200 && !/,/.test(p)) return true;
      return false;
    };
    while (paragraphs.length > 1 && isLikelyTitle(paragraphs[paragraphs.length - 1])) {
      paragraphs.pop();
    }
    text = paragraphs.join('\n\n');

    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return text.slice(0, 50000);
  }
}

module.exports = new NewsService();
