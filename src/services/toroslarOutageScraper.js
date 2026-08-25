const { fetchWithTimeout, normalizeText, slugify } = require('../utils/helpers');
const fs = require('fs');
let puppeteer = null;
try {
  puppeteer = require('puppeteer-core');
} catch (_) {
  try {
    puppeteer = require('puppeteer');
  } catch (__) {}
}

const BASE = 'https://online.toroslaredas.com.tr';
const OUTAGE_PAGE = `${BASE}/elektrik-kesintisi-sorgulama`;
const OSMANIYE_PLATE = 80;
const DUZICI_KEYS = ['duzici', 'düziçi', 'yarbasi', 'yarbaşı', 'atalan', 'ellek', 'duldul', 'düldül'];

function isDuziciRelated(text) {
  const t = normalizeText(text).toLowerCase();
  return DUZICI_KEYS.some((k) => t.includes(k)) || /osmaniye/.test(t);
}

function findChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseDateTime(text) {
  if (!text) return null;
  const s = String(text).trim();

  // Format 1: 24.08.2026 09:00 veya 24/08/2026 09:00
  const dateMatch = s.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
  if (dateMatch) {
    const [, d, mo, y] = dateMatch;
    const timeMatch = s.match(/\b(\d{1,2}:\d{2})\b/);
    const time = timeMatch ? timeMatch[1].padStart(5, '0') : '00:00';
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${time}:00+03:00`;
  }

  // Format 2: 2026-08-24T09:00:00 veya 2026-08-24 09:00
  const isoMatch = s.match(/^(20\d{2})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, y, mo, d, h, m] = isoMatch;
    return `${y}-${mo}-${d}T${h}:${m}:00+03:00`;
  }

  const t = Date.parse(s);
  if (!isNaN(t)) {
    return new Date(t).toISOString();
  }
  return null;
}

function inferStatus(text) {
  const t = text.toLowerCase();
  if (/tamamland|sona erdi|giderildi|açıld|acildi/.test(t)) return 'Tamamlandı';
  if (/planl/.test(t)) return 'Planlandı';
  return 'Devam Ediyor';
}

function mapApiRow(row) {
  const district = row.districtName || row.ilceAdi || row.countyName || row.ilce || 'Düziçi';
  const neighborhood = row.neighborhoodName || row.mahalleAdi || row.mahalle || '';
  const streets = row.streetName || row.sokakAdi || row.sokak || row.etkilenenCaddeSokak || '';
  const reason = row.reason || row.cause || row.kesintiNedeni || row.description || row.aciklama || 'Şebeke Arızası';
  const start = row.startDate || row.baslangicTarihi || row.kesintiBaslangicTarihi || row.startTime || '';
  const end = row.endDate || row.bitisTarihi || row.kesintiBitisTarihi || row.endTime || row.kesintiTahminiBitisTarihi || '';
  
  const areaParts = [neighborhood, streets].filter(Boolean);
  const area = areaParts.length > 0 ? areaParts.join(', ') : district;
  
  const titleParts = [neighborhood || district, 'Elektrik Kesintisi'].filter(Boolean);
  const title = normalizeText(titleParts.join(' · ')) || 'Düziçi Elektrik Kesintisi';
  
  const subtitle = normalizeText(
    `${reason}${start ? ` · Başlangıç: ${start}` : ''}${end ? ` · Bitiş: ${end}` : ''}`,
  );

  const publishedAt = parseDateTime(`${start} ${end}`) || new Date().toISOString();
  const isPlanned = row.kesintiTipi === 2 || /planl/i.test(reason) || !!row.isPlanned;
  const status = isPlanned ? 'Planlandı' : inferStatus(`${reason} ${subtitle}`);
  const id = `toroslar_${slugify(`${district}_${neighborhood}_${streets}_${start}_${reason}`)}`;

  return {
    id,
    title: title.length > 88 ? `${title.slice(0, 85)}...` : title,
    subtitle: subtitle.length > 220 ? `${subtitle.slice(0, 217)}...` : subtitle,
    type: 'ELEKTRİK',
    status,
    source: 'Toroslar EDAŞ',
    sourceKind: 'toroslar',
    url: OUTAGE_PAGE,
    area: area || 'Düziçi',
    lat: 37.244,
    lng: 36.451,
    date: publishedAt,
    publishedAt,
    startAt: parseDateTime(String(start)) || null,
    endAt: parseDateTime(String(end)) || null,
    isActive: status !== 'Tamamlandı',
  };
}

class ToroslarOutageScraper {
  constructor() {
    this._browserScraping = false;
    this._lastScrapeTime = 0;
    this._cachedRows = [];
  }

  async scrapeViaBrowser() {
    if (!puppeteer) {
      console.warn('[toroslar-scraper] puppeteer bulunamadı.');
      return [];
    }

    const executablePath = findChromePath();
    if (!executablePath) {
      console.warn('[toroslar-scraper] Chrome/Edge yolu bulunamadı.');
      return [];
    }

    if (this._browserScraping) {
      console.log('[toroslar-scraper] Tarayıcı kazıma işlemi zaten çalışıyor...');
      return this._cachedRows;
    }

    this._browserScraping = true;
    let browser = null;

    try {
      console.info('[toroslar-scraper] Başsız tarayıcı başlatılıyor...');
      browser = await puppeteer.launch({
        executablePath,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,900'
        ],
        defaultViewport: { width: 1280, height: 900 }
      });

      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      );

      let capturedPayload = null;
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/wkt-sorgulama') || url.includes('/elektrik-kesintisi-sorgulama')) {
          try {
            const json = await response.json();
            if (json && (json.state === 1 || json.result)) {
              capturedPayload = json.result || json;
            }
          } catch (_) {}
        }
      });

      await page.goto(OUTAGE_PAGE, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Farklı bir adres seç
      await page.evaluate(() => {
        const radio = document.querySelector('#radio-farkli-bir-adres');
        if (radio) {
          radio.click();
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      await new Promise(r => setTimeout(r, 600));

      // İl seç: 80 (Osmaniye)
      await page.evaluate(() => {
        const $il = window.jQuery && window.jQuery('#IlKodu');
        if ($il && $il.length) {
          $il.val('80').change();
          $il.selectpicker('refresh');
        }
      });

      // İlçe bekle
      await page.waitForFunction(() => {
        const select = document.querySelector('#IlceKodu');
        return select && select.options && select.options.length > 1;
      }, { timeout: 10000 });

      // İlçe seç: Düziçi
      await page.evaluate(() => {
        const select = document.querySelector('#IlceKodu');
        let val = '00001743';
        for (const opt of select.options) {
          if (/düziçi|duzici/i.test(opt.text)) {
            val = opt.value;
            break;
          }
        }
        const $ilce = window.jQuery && window.jQuery('#IlceKodu');
        if ($ilce && $ilce.length) {
          $ilce.val(val).change();
          $ilce.selectpicker('refresh');
        }
      });

      await new Promise(r => setTimeout(r, 600));

      // reCAPTCHA checkbox'ı tıkla
      try {
        const iframeElement = await page.$('iframe[src*="recaptcha/api2/anchor"]');
        if (iframeElement) {
          const frame = await iframeElement.contentFrame();
          if (frame) {
            const checkbox = await frame.$('#recaptcha-anchor');
            if (checkbox) {
              await checkbox.click();
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }
      } catch (_) {}

      // Sorgula butonuna bas
      await page.evaluate(() => {
        const btn = document.querySelector('#elektrikKesintiSorgulaBtn');
        if (btn) btn.click();
      });

      // Yanıtların gelmesini bekle
      await new Promise(r => setTimeout(r, 6000));

      // DOM ve sayfa durumunu kontrol et
      const pageData = await page.evaluate(() => {
        const rawMevcut = window.mapMevcutPolygonList || [];
        const rawPlanli = window.mapPlanlananPolygonList || [];
        
        // DOM card'larından da veri topla
        const cards = [];
        document.querySelectorAll('.item-elektrik-kesintisi-sorgulama').forEach(c => {
          cards.push(c.innerText.trim());
        });

        return { rawMevcut, rawPlanli, cards };
      });

      const outages = [];

      // 1. API yanıtından topla
      if (capturedPayload) {
        const mevcut = capturedPayload.mevcutKesintiListe || [];
        const planli = capturedPayload.planlananKesintiListe || [];
        for (const r of [...mevcut, ...planli]) {
          const mapped = mapApiRow(r);
          if (mapped) outages.push(mapped);
        }
      }

      // 2. Sayfa window listesinden topla
      if (pageData.rawMevcut && pageData.rawMevcut.length > 0) {
        for (const r of pageData.rawMevcut) {
          const mapped = mapApiRow(r);
          if (mapped) outages.push(mapped);
        }
      }
      if (pageData.rawPlanli && pageData.rawPlanli.length > 0) {
        for (const r of pageData.rawPlanli) {
          const mapped = mapApiRow({ ...r, isPlanned: true });
          if (mapped) outages.push(mapped);
        }
      }

      // 3. Eğer DOM card'ları varsa ve liste boşsa metinden ayıkla
      if (outages.length === 0 && pageData.cards && pageData.cards.length > 0) {
        for (const cardText of pageData.cards) {
          const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);
          const reasonMatch = cardText.match(/Kesinti Nedeni:\s*([^\n]+)/i);
          const reason = reasonMatch ? reasonMatch[1].trim() : 'Şebeke Arızası';
          const areaMatch = cardText.match(/([A-ZÇĞİÖŞÜa-zçğıöşü]+,\s*[^bölgesinde]+)\s*bölgesinde/i);
          const area = areaMatch ? areaMatch[1].trim() : 'Düziçi';
          const isPlanned = /planl/i.test(cardText);
          const status = isPlanned ? 'Planlandı' : 'Devam Ediyor';
          const title = `${area} Elektrik Kesintisi`;
          const id = `toroslar_${slugify(`${title}_${reason}_${Date.now()}`)}`;
          outages.push({
            id,
            title,
            subtitle: `${reason} · Çalışmalar Devam Ediyor`,
            type: 'ELEKTRİK',
            status,
            source: 'Toroslar EDAŞ',
            sourceKind: 'toroslar',
            url: OUTAGE_PAGE,
            area,
            lat: 37.244,
            lng: 36.451,
            date: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            startAt: null,
            endAt: null,
            isActive: true,
          });
        }
      }

      if (outages.length > 0) {
        console.info(`[toroslar-scraper] Tarayıcı ile ${outages.length} Düziçi kesintisi başarıyla çekildi.`);
        this._cachedRows = outages;
        this._lastScrapeTime = Date.now();
        return outages;
      }
    } catch (err) {
      console.warn('[toroslar-scraper] Tarayıcı çalıştırma hatası:', err.message);
    } finally {
      this._browserScraping = false;
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }

    return this._cachedRows;
  }

  async fetchDuziciOutages() {
    // 1. Tarayıcı ile çek
    try {
      const browserOutages = await this.scrapeViaBrowser();
      if (browserOutages.length > 0) return browserOutages;
    } catch (err) {
      console.warn('[toroslar-kesinti] Tarayıcı başarısız:', err.message);
    }

    // 2. Cache'de kayıt varsa dön
    if (this._cachedRows && this._cachedRows.length > 0) {
      return this._cachedRows;
    }

    return [];
  }
}

module.exports = new ToroslarOutageScraper();
