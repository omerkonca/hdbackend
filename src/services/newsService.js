const config = require('../config');
const fileService = require('./fileService');
const { getTagValue, stripHtml, extractImageUrlFromHtml, decodeXmlEntities, normalizeText } = require('../utils/helpers');

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

  isDuziciRelated(title, summary) {
    const text = `${title || ''} ${summary || ''}`.toLowerCase();
    return /d[uü]zi[cç]i|düzici|duzici/.test(text);
  }

  parseNewsRss(xml, { max = 50, sourceName = '', filterDuzici = false } = {}) {
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
        return {
          id: `news-${String(sourceName).replace(/\s/g, '-')}-${index}-${Date.parse(pubDate) || Date.now()}`,
          title,
          summary: summary || title,
          imageUrl: imageUrl || null,
          createdAt: new Date(pubDate || Date.now()).toISOString(),
          sourceUrl: link || null,
          sourceName: source || sourceName,
        };
      })
      .filter((x) => x.title && x.sourceUrl);
    if (filterDuzici) {
      parsed = parsed.filter((x) => this.isDuziciRelated(x.title, x.summary));
    }
    return parsed.slice(0, max);
  }

  async fetchRss(url) {
    const res = await fetch(url, this.FETCH_OPTIONS);
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
      merged.push(item);
    }
    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return merged.slice(0, max);
  }

  async getNews({ forceRefresh = false, max = 20 } = {}) {
    const now = Date.now();
    const isFresh = now - this.cache.fetchedAt < config.NEWS.CACHE_TTL_MS;
    if (!forceRefresh && isFresh && this.cache.items.length > 0) {
      return this.cache.items.slice(0, max);
    }
    const items = await this.scrapeNews({ max });
    this.cache = {
      fetchedAt: now,
      items,
    };
    return items;
  }

  async fetchArticleFullText(articleUrl) {
    const url = String(articleUrl || '').trim();
    if (!url || !url.startsWith('http')) {
      throw new Error('Gecersiz URL');
    }
    const res = await fetch(url, this.FETCH_OPTIONS);
    if (!res.ok) throw new Error(`Sayfa alinamadi: ${res.status}`);
    // Bazi site sunuculari Content-Type'da UTF-8 yazsa da govdeyi
    // Windows-1254 olarak gonderiyor. Once UTF-8 dene, bozulma cok ise
    // 1254 ile yeniden coz.
    const buf = Buffer.from(await res.arrayBuffer());
    let html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const replacementRatio = (html.match(/\uFFFD/g) || []).length / Math.max(html.length, 1);
    if (replacementRatio > 0.001) {
      try {
        html = new TextDecoder('windows-1254', { fatal: false }).decode(buf);
      } catch (_) {
        // fallback: Latin-1 her zaman desteklenir.
        html = buf.toString('latin1');
      }
    }

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

    // 3) Oncelikli secicilerle haber govdesini bul.
    const bodyCandidates = [
      /<div[^>]*itemprop\s*=\s*"articleBody"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class\s*=\s*"[^"]*(?:article-body|entry-content|article-content|post-content|news-content|haber-icerik|haberDetay|haber-detay|content-body|article__body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
    ];
    let main = '';
    for (const re of bodyCandidates) {
      const m = html.match(re);
      if (m && m[1] && m[1].replace(/<[^>]+>/g, '').trim().length > 200) {
        main = m[1];
        break;
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

    let text = cleaned.join('\n\n');
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
