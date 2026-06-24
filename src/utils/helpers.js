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

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

const WARMUP_HOSTS = new Set([
  'www.eczaneler.gen.tr',
  'eczaneler.gen.tr',
  'www.akdenizgazetesi.com',
  'akdenizgazetesi.com',
]);

function buildBrowserHeaders(targetUrl, overrides = {}) {
  const origin = (() => {
    try {
      return new URL(String(targetUrl)).origin;
    } catch (_) {
      return 'https://www.google.com';
    }
  })();

  const accept =
    overrides.accept ||
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';

  const dest = overrides.dest || (accept.includes('xml') ? 'document' : 'document');
  const mode = overrides.mode || 'navigate';
  const site = overrides.site || 'none';

  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: accept,
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: overrides.referer || `${origin}/`,
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': dest,
    'Sec-Fetch-Mode': mode,
    'Sec-Fetch-Site': site,
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    ...overrides.extra,
  };
}

function collectCookieHeader(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    const parts = response.headers.getSetCookie();
    if (parts?.length) {
      return parts.map((c) => c.split(';')[0]).join('; ');
    }
  }
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(/,(?=[^;]+?=)/).map((c) => c.split(';')[0]).join('; ') : '';
}

async function warmupOrigin(origin, timeoutMs) {
  const headers = buildBrowserHeaders(`${origin}/`, { site: 'none' });
  const res = await fetchWithTimeout(`${origin}/`, { headers, redirect: 'follow' }, timeoutMs);
  return collectCookieHeader(res);
}

function buildProxyUrl(targetUrl) {
  const template = String(process.env.SCRAPE_PROXY_URL || '').trim();
  if (!template) return null;
  if (template.includes('{{url}}')) {
    return template.replace('{{url}}', encodeURIComponent(targetUrl));
  }
  const joiner = template.includes('?') ? '&' : '?';
  return `${template}${joiner}url=${encodeURIComponent(targetUrl)}`;
}

/**
 * Tarayici benzeri istek: tam header, opsiyonel origin warmup, proxy ve retry.
 */
async function fetchPage(targetUrl, options = {}, timeoutMs = 20000) {
  const url = String(targetUrl || '').trim();
  if (!url) throw new Error('URL bos');

  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch (_) {
    throw new Error('Gecersiz URL');
  }

  const accept = options.accept;
  const maxAttempts = options.maxAttempts || 3;
  let cookieJar = options.cookie || '';
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!cookieJar && WARMUP_HOSTS.has(hostname) && attempt === 1) {
        try {
          const origin = new URL(url).origin;
          cookieJar = await warmupOrigin(origin, Math.min(timeoutMs, 12000));
        } catch (warmErr) {
          console.warn(`[fetch] warmup failed for ${hostname}:`, warmErr.message);
        }
      }

      const headers = buildBrowserHeaders(url, {
        accept,
        referer: options.referer,
        dest: options.dest,
        mode: options.mode,
        site: options.site || (cookieJar ? 'same-origin' : 'none'),
        extra: options.headers,
      });
      if (cookieJar) headers.Cookie = cookieJar;

      let fetchUrl = url;
      const proxyTemplate = buildProxyUrl(url);
      if (proxyTemplate && (attempt >= 2 || options.forceProxy)) {
        fetchUrl = proxyTemplate;
      }

      const res = await fetchWithTimeout(
        fetchUrl,
        { ...options, headers, redirect: 'follow' },
        timeoutMs,
      );

      if (res.ok) return res;

      lastError = new Error(`Sayfa alinamadi: ${res.status}`);
      if (res.status !== 403 && res.status !== 429 && res.status < 500) {
        throw lastError;
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }

  throw lastError || new Error('Sayfa alinamadi');
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
  fetchWithTimeout,
  buildBrowserHeaders,
  fetchPage,
};
