function normalizeText(input) {
  return String(input || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXmlEntities(input) {
  return String(input || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x22;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function slugify(text) {
  const trMap = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
    'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
  };
  let str = String(text || '').toLowerCase();
  for (const key in trMap) {
    str = str.replace(new RegExp(key, 'g'), trMap[key]);
  }
  return str.trim()
    .replace(/[^-a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeForCompare(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getTagValue(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  if (!match) return '';
  return decodeXmlEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim());
}

function stripHtml(input) {
  return decodeXmlEntities(String(input || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractImageUrlFromHtml(input) {
  const imgMatch = String(input || '').match(/<img[^>]+src="([^"]+)"/i);
  return imgMatch ? decodeXmlEntities(imgMatch[1]) : '';
}

function extractOgImageFromHtml(html) {
  const source = String(html || '');
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const match = source.match(re);
    if (match && match[1] && !/logo|icon|avatar|sprite|favicon/i.test(match[1])) {
      return decodeXmlEntities(match[1]);
    }
  }
  const fallback = extractImageUrlFromHtml(source);
  if (fallback && !/logo|icon|avatar|sprite|favicon/i.test(fallback)) {
    return fallback;
  }
  return '';
}

module.exports = {
  normalizeText,
  decodeXmlEntities,
  normalizeForCompare,
  slugify,
  getTagValue,
  stripHtml,
  extractImageUrlFromHtml,
  extractOgImageFromHtml,
};
