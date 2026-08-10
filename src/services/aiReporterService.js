const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
const weatherService = require('./weatherService');
const outageService = require('./outageService');
const roadClosureService = require('./roadClosureSyncService');
const obituaryService = require('./obituaryService');
const newsService = require('./newsService');
const eventService = require('./eventService');
const pharmacyService = require('./pharmacyService');
const fuelService = require('./fuelService');
const aiClient = require('./aiClient');
const fileService = require('./fileService');
const crypto = require('crypto');

const TZ = 'Europe/Istanbul';

/** Temaya göre kapak havuzları — anlamlı + çeşitli Unsplash URL'leri */
const COVER_IMAGES = {
  rain: [
    'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1200&q=80',
    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=1200&q=80',
    'https://images.unsplash.com/photo-1501691223387-dd050040307b?w=1200&q=80',
  ],
  hot: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80',
    'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=1200&q=80',
    'https://images.unsplash.com/photo-1419833173245-82df1c7fd43d?w=1200&q=80',
  ],
  cold: [
    'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=1200&q=80',
    'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1200&q=80',
    'https://images.unsplash.com/photo-1457269449834-928af64c684d?w=1200&q=80',
  ],
  outage: [
    'https://images.unsplash.com/photo-1473346882829-8bf0c4e0e8e4?w=1200&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80',
  ],
  road: [
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80',
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1200&q=80',
    'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&q=80',
  ],
  event: [
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&q=80',
  ],
  pharmacy: [
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1200&q=80',
    'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=1200&q=80',
    'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=1200&q=80',
  ],
  memorial: [
    'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1200&q=80',
    'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200&q=80',
  ],
  calm: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80',
    'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200&q=80',
    'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200&q=80',
  ],
  city: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80',
    'https://images.unsplash.com/photo-1477959858617-67f85b6b1aa9?w=1200&q=80',
    'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200&q=80',
  ],
  news: [
    'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1200&q=80',
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80',
    'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=1200&q=80',
  ],
};

function hashSeed(text) {
  const s = String(text || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function turkeyDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function formatTrDateLabel(isoDate) {
  try {
    const d = new Date(`${isoDate}T12:00:00+03:00`);
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch (_) {
    return isoDate;
  }
}

function normalizeTr(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

class AiReporterService {
  constructor() {
    this._generating = false;
  }

  async saveReporterStatus(patch = {}) {
    try {
      const city = await fileService.readCityContent();
      city.aiNewsSettings = {
        ...(city.aiNewsSettings || {}),
        ...patch,
        lastReporterAt: new Date().toISOString(),
      };
      await fileService.writeCityContent(city);
    } catch (err) {
      console.warn('[ai-reporter] status save failed:', err.message);
    }
  }

  async collectCitySnapshot(targetDate) {
    const snapshot = {
      weatherText: '',
      weatherHints: [],
      outagesText: '',
      outageCount: 0,
      closuresText: '',
      closureCount: 0,
      obituariesText: '',
      obituaryCount: 0,
      newsText: '',
      newsCount: 0,
      eventsText: '',
      eventCount: 0,
      pharmacyText: '',
      pharmacyCount: 0,
      fuelText: '',
      signals: [],
    };

    // 1. Weather
    try {
      const weather = await weatherService.getWeather();
      if (weather?.current) {
        const cond = String(weather.current.condition?.text || '');
        const temp = Number(weather.current.temp);
        const forecast = weather.forecast || [];
        // Akşam raporu: yarın öncelikli
        const tomorrow = forecast[1] || forecast[0];
        const dayAfter = forecast[2];
        const tonightLine = `Şu an (akşam): ${temp}°C (hissedilen ${weather.current.feelsLike}°C), ${cond}. Nem %${weather.current.humidity}.`;
        const tomorrowLine = tomorrow
          ? `YARIN (${tomorrow.date}): En yüksek ${tomorrow.maxTemp}°C / en düşük ${tomorrow.minTemp}°C — ${tomorrow.condition?.text || ''}`
          : 'Yarın tahmini yok.';
        const dayAfterLine = dayAfter
          ? `Öbür gün (${dayAfter.date}): En yüksek ${dayAfter.maxTemp}°C / en düşük ${dayAfter.minTemp}°C — ${dayAfter.condition?.text || ''}`
          : '';
        snapshot.weatherText = [tonightLine, tomorrowLine, dayAfterLine].filter(Boolean).join('\n');

        const hintSource = normalizeTr(`${tomorrow?.condition?.text || ''} ${cond}`);
        const hintTemp = Number(tomorrow?.maxTemp ?? temp);
        if (/yagmur|saganak|firtina|yagis/.test(hintSource)) snapshot.weatherHints.push('rain');
        if (Number.isFinite(hintTemp) && hintTemp >= 32) snapshot.weatherHints.push('hot');
        if (Number.isFinite(hintTemp) && hintTemp <= 8) snapshot.weatherHints.push('cold');
        if (snapshot.weatherHints.length) snapshot.signals.push(...snapshot.weatherHints);
      }
    } catch (err) {
      console.warn('[ai-reporter] Weather fetch failed:', err.message);
    }

    // 2. Outages
    try {
      const outages = await outageService.getOutages();
      const active = (outages || [])
        .filter((o) => o.isActive !== false && o.status !== 'Tamamlandı')
        .slice(0, 10);
      snapshot.outageCount = active.length;
      if (active.length > 0) {
        snapshot.outagesText = active
          .map((o) => `- [${o.type || 'Kesinti'}] ${o.area ? `${o.area}: ` : ''}${o.title}`)
          .join('\n');
        snapshot.signals.push('outage');
      } else {
        snapshot.outagesText = 'Bugün planlı elektrik veya su kesintisi bulunmuyor.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Outages fetch failed:', err.message);
    }

    // 3. Road closures
    try {
      const closures = await roadClosureService.getRoadClosures();
      const active = (closures || [])
        .filter((c) => {
          const s = normalizeTr(c.status || '');
          return s.includes('devam') || s.includes('aktif') || !s;
        })
        .slice(0, 10);
      snapshot.closureCount = active.length;
      if (active.length > 0) {
        snapshot.closuresText = active
          .map((c) => `- ${c.title}${c.subtitle ? ` (${c.subtitle})` : ''} — ${c.status || 'Aktif'}`)
          .join('\n');
        snapshot.signals.push('road');
      } else {
        snapshot.closuresText = 'Aktif yol kapama / yol çalışması kaydı yok.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Closures fetch failed:', err.message);
    }

    // 4. Obituaries
    try {
      const obituaries = await obituaryService.getObituaries();
      const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const recent = (obituaries || [])
        .filter((o) => {
          const t = new Date(o.deathDate || o.createdAt || 0).getTime();
          return Number.isFinite(t) && t >= cutoff;
        })
        .slice(0, 8);
      snapshot.obituaryCount = recent.length;
      if (recent.length > 0) {
        snapshot.obituariesText = recent
          .map(
            (o) =>
              `- ${o.fullName}` +
              (o.deathDate ? ` (${String(o.deathDate).slice(0, 10)})` : '') +
              (o.condolenceAddress ? ` — ${o.condolenceAddress}` : ''),
          )
          .join('\n');
        snapshot.signals.push('memorial');
      } else {
        snapshot.obituariesText = 'Son 48 saatte yeni vefat ilanı yok.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Obituaries fetch failed:', err.message);
    }

    // 5. Local news
    try {
      const news = await newsService.getNews({ max: 40 });
          const localNews = (news || [])
        .filter((n) => {
          const cat = normalizeTr(n.category || '');
          const id = String(n.id || '');
          if (id.startsWith('news-ai-reporter-')) return false;
          return cat.includes('duzici') || newsService.isDuziciRelated(n.title, n.summary);
        })
        .slice(0, 12);
      snapshot.newsCount = localNews.length;
      if (localNews.length > 0) {
        snapshot.newsText = localNews
          .map((n) => `- [${n.sourceName || 'Kaynak'}] ${n.title}${n.summary ? `: ${n.summary}` : ''}`)
          .join('\n');
        snapshot.signals.push('news');
      } else {
        snapshot.newsText = 'Öne çıkan yeni yerel haber kaydı sınırlı.';
      }
    } catch (err) {
      console.warn('[ai-reporter] News fetch failed:', err.message);
    }

    // 6. Events (today / next 3 days)
    try {
      const events = await eventService.getEvents();
      const start = new Date(`${targetDate}T00:00:00+03:00`).getTime();
      const end = start + 3 * 24 * 60 * 60 * 1000;
      const upcoming = (events || [])
        .filter((e) => {
          const t = new Date(e.date || e.startDate || 0).getTime();
          return Number.isFinite(t) && t >= start && t <= end;
        })
        .slice(0, 8);
      snapshot.eventCount = upcoming.length;
      if (upcoming.length > 0) {
        snapshot.eventsText = upcoming
          .map((e) => {
            const when = e.date ? String(e.date).slice(0, 16).replace('T', ' ') : '';
            return `- ${e.title}${when ? ` (${when})` : ''}${e.venue || e.location ? ` — ${e.venue || e.location}` : ''}`;
          })
          .join('\n');
        snapshot.signals.push('event');
      } else {
        snapshot.eventsText = 'Önümüzdeki 3 günde öne çıkan etkinlik kaydı yok.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Events fetch failed:', err.message);
    }

    // 7. Duty pharmacy
    try {
      const pharmacies = await pharmacyService.getDutyPharmacies();
      const list = Array.isArray(pharmacies) ? pharmacies : [];
      const todayList = list
        .filter((p) => {
          const label = normalizeTr(p.dateLabel || p.day || '');
          return !label || label.includes('bugun') || label.includes('today');
        })
        .slice(0, 6);
      const pick = todayList.length > 0 ? todayList : list.slice(0, 6);
      snapshot.pharmacyCount = pick.length;
      if (pick.length > 0) {
        snapshot.pharmacyText = pick
          .map((p) => `- ${p.name || p.title}${p.address ? ` — ${p.address}` : ''}${p.phone ? ` (${p.phone})` : ''}`)
          .join('\n');
        snapshot.signals.push('pharmacy');
      } else {
        snapshot.pharmacyText = 'Nöbetçi eczane listesi alınamadı veya boş.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Pharmacy fetch failed:', err.message);
    }

    // 8. Fuel
    try {
      const prices = await fuelService.getPrices();
      const items = (prices || []).slice(0, 6);
      if (items.length > 0) {
        snapshot.fuelText = items
          .map((p) => `- ${p.name || p.code}: ${p.price} ${p.unit || 'TL/L'}`)
          .join('\n');
      } else {
        snapshot.fuelText = 'Akaryakıt fiyatı verisi yok.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Fuel fetch failed:', err.message);
    }

    return snapshot;
  }

  scoreSnapshot(snapshot) {
    return (
      (snapshot.outageCount > 0 ? 2 : 0) +
      (snapshot.closureCount > 0 ? 2 : 0) +
      (snapshot.obituaryCount > 0 ? 1 : 0) +
      (snapshot.newsCount > 0 ? 2 : 0) +
      (snapshot.eventCount > 0 ? 1 : 0) +
      (snapshot.pharmacyCount > 0 ? 1 : 0) +
      (snapshot.weatherText ? 1 : 0) +
      (snapshot.fuelText && !snapshot.fuelText.includes('yok') ? 1 : 0)
    );
  }

  pickDominantTheme(snapshot, title = '', summary = '') {
    const blob = normalizeTr(`${title} ${summary} ${snapshot.signals.join(' ')}`);
    if (/yagmur|saganak|firtina|yagis/.test(blob) || snapshot.signals.includes('rain')) return 'rain';
    if (/sicak|kavurucu|sicaktan/.test(blob) || snapshot.signals.includes('hot')) return 'hot';
    if (/soguk|don|kar/.test(blob) || snapshot.signals.includes('cold')) return 'cold';
    if (/kesinti|elektrik|su kes/.test(blob) || snapshot.outageCount > 0) return 'outage';
    if (/yol|asfalt|kapali|calisma/.test(blob) || snapshot.closureCount > 0) return 'road';
    if (/etkinlik|konser|tiyatro|festival/.test(blob) || snapshot.eventCount > 0) return 'event';
    if (/eczane|nobetci/.test(blob) || snapshot.pharmacyCount > 0) return 'pharmacy';
    if (/vefat|taziye|rahmet/.test(blob) || snapshot.obituaryCount > 0) return 'memorial';
    if (this.scoreSnapshot(snapshot) <= 2) return 'calm';
    if (snapshot.newsCount > 0) return 'news';
    return 'city';
  }

  pickCoverImage(theme, seed = '') {
    const pool = COVER_IMAGES[theme] || COVER_IMAGES.city;
    if (!Array.isArray(pool) || pool.length === 0) {
      return COVER_IMAGES.city[0];
    }
    if (pool.length === 1) return pool[0];
    const idx = hashSeed(`${theme}|${seed}`) % pool.length;
    return pool[idx];
  }

  buildPrompts({ targetDate, dateLabel, snapshot, quietDay }) {
    const systemPrompt =
      'Sen Düziçi (Osmaniye) için akşam bülteni yazan deneyimli bir yerel muhabirsin. ' +
      'Dil doğal, samimi ve bilgilendirici olsun; robotik veya aşırı resmi olma. ' +
      'Abartı ve uydurma bilgi yok — yalnızca verilen verilere dayan. ' +
      'Başlık, haberin asıl vurgusuyla entegre olsun (hava, kesinti, yol, etkinlik vb.). ' +
      'Yanıtını yalnızca geçerli JSON olarak ver.';

    const modeHint = quietDay
      ? 'Bugün veri seyrek. Kısa ama sıcak bir "sakin gün" bülteni yaz; boş başlıkları uzatma.'
      : 'Veriler zengin. Okuyucuyu bilgilendiren, bölümleri net bir akşam raporu yaz.';

    const userPrompt =
      `Tarih: ${dateLabel} (${targetDate})\n` +
      `Konum: Düziçi, Osmaniye\n` +
      `Mod: ${quietDay ? 'sakin-gun' : 'tam-rapor'}\n` +
      `${modeHint}\n\n` +
      `=== HAVA DURUMU (AKŞAM BÜLTENİ — YARINA ODAKLI) ===\n${snapshot.weatherText || 'Veri yok'}\n\n` +
      `=== ELEKTRİK / SU KESİNTİLERİ ===\n${snapshot.outagesText || 'Veri yok'}\n\n` +
      `=== YOL KAPAMA / ÇALIŞMALAR ===\n${snapshot.closuresText || 'Veri yok'}\n\n` +
      `=== NÖBETÇİ ECZANE ===\n${snapshot.pharmacyText || 'Veri yok'}\n\n` +
      `=== ETKİNLİKLER (3 GÜN) ===\n${snapshot.eventsText || 'Veri yok'}\n\n` +
      `=== AKARYAKIT ===\n${snapshot.fuelText || 'Veri yok'}\n\n` +
      `=== VEFAT İLANLARI (48 SAAT) ===\n${snapshot.obituariesText || 'Veri yok'}\n\n` +
      `=== YEREL HABERLER ===\n${snapshot.newsText || 'Veri yok'}\n\n` +
      `GÖREV:\n` +
      `1. title: Habere özel, clickbait olmayan, merak uyandıran başlık (max 110 karakter).\n` +
      `   - Günün asıl konusunu yansıt (ör. yağmur + kesinti varsa ikisini bağla).\n` +
      `   - "Şehir Raporu - tarih" gibi düz kalıptan kaçın.\n` +
      `   - İyi örnekler: "Düziçi'de yağışlı akşam: Yol çalışmaları sürüyor", "Kesintisiz bir gün: Etkinlikler ve nöbetçi eczaneler".\n` +
      `2. summary: 2-3 cümle spot (max 240 karakter), başlıkla uyumlu.\n` +
      `3. fullText: Bölümlü haber metni. Paragraflar arasında boş satır bırak. Markdown/HTML yok.\n` +
      `   Şu sırayı takip et (veri yoksa o bölümü 1 cümleyle geç):\n` +
      `   - Açılış (günün özeti)\n` +
      `   - Hava durumu: "bugün" deme; yarınki tahmini anlat + kısa pratik tavsiye\n` +
      `   - Altyapı ve kesintiler\n` +
      `   - Yol durumu\n` +
      `   - Nöbetçi eczane / pratik bilgiler\n` +
      `   - Etkinlikler (varsa)\n` +
      `   - Yerel gelişmeler\n` +
      `   - Taziyeler (varsa, saygılı ve kısa)\n` +
      `   - Kapanış cümlesi\n` +
      `4. themeHint: Tek kelime — rain|hot|cold|outage|road|event|pharmacy|memorial|calm|news|city\n\n` +
      `JSON:\n` +
      `{"title":"...","summary":"...","fullText":"...","themeHint":"city"}`;

    return { systemPrompt, userPrompt };
  }

  async generateWithRetry(prompts, attempts = 2) {
    let lastError = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        return await aiClient.generateJson(prompts);
      } catch (err) {
        lastError = err;
        console.warn(`[ai-reporter] AI attempt ${i}/${attempts} failed: ${err.message}`);
        if (i < attempts) {
          await new Promise((r) => setTimeout(r, 1500 * i));
        }
      }
    }
    throw lastError || new Error('AI üretimi başarısız');
  }

  async generateDailyReport({ force = false, publish = true } = {}) {
    const tr = turkeyDateParts();
    const targetDate = tr.date;
    const dateLabel = formatTrDateLabel(targetDate);
    const db = requireSupabaseAdmin();

    const todayHash = crypto.createHash('md5').update(`ai-reporter-${targetDate}`).digest('hex');
    const todayId = `news-ai-reporter-${todayHash}`;

    if (!force) {
      const { data: existing } = await db.from('news_items').select('id').eq('id', todayId).maybeSingle();
      if (existing) {
        console.log(`[ai-reporter] Daily report for ${targetDate} already exists. Skipping.`);
        await this.saveReporterStatus({
          lastReporterOk: true,
          lastReporterError: null,
          lastReporterTitle: 'Bugünün raporu zaten yayınlı',
          lastReporterSkipped: true,
        });
        return null;
      }
    }

    if (!aiClient.isConfigured()) {
      await this.saveReporterStatus({
        lastReporterOk: false,
        lastReporterError: 'AI anahtarı yapılandırılmamış',
        lastReporterSkipped: false,
      });
      throw new Error('AI client is not configured.');
    }

    console.log(`[ai-reporter] Collecting enriched city snapshot for ${targetDate}...`);
    const snapshot = await this.collectCitySnapshot(targetDate);
    const score = this.scoreSnapshot(snapshot);
    const quietDay = score <= 2;

    if (score === 0 && !force) {
      await this.saveReporterStatus({
        lastReporterOk: false,
        lastReporterError: 'Yetersiz veri — rapor atlandı',
        lastReporterScore: score,
        lastReporterSkipped: true,
      });
      console.warn('[ai-reporter] No usable city data; skipping publish.');
      return null;
    }

    const prompts = this.buildPrompts({ targetDate, dateLabel, snapshot, quietDay });
    const { data, model } = await this.generateWithRetry(prompts, 2);

    const title = String(data.title || `Düziçi akşam bülteni — ${dateLabel}`).trim().slice(0, 110);
    const summary = String(data.summary || '').trim().slice(0, 250);
    const fullText = String(data.fullText || '').trim();
    if (!fullText || fullText.length < 80) {
      throw new Error('AI metni çok kısa veya boş');
    }

    const theme =
      String(data.themeHint || '').trim().toLowerCase() ||
      this.pickDominantTheme(snapshot, title, summary);
    const imageUrl = this.pickCoverImage(theme, `${title}|${targetDate}`);

    const newArticle = {
      id: force ? `news-ai-reporter-${todayHash}-${Date.now().toString(36)}` : todayId,
      title,
      summary,
      full_text: fullText,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      source_url: `https://forvibe.app/duzici-ai-reporter/${targetDate}`,
      source_name: 'Hepsi Düziçi',
      category: 'Düziçi',
      is_ai_generated: true,
      is_ai_optimized: false,
      verified: true,
      images: [imageUrl],
      fetched_at: new Date().toISOString(),
    };

    if (!publish) {
      await this.saveReporterStatus({
        lastReporterOk: true,
        lastReporterError: null,
        lastReporterTitle: title,
        lastReporterScore: score,
        lastReporterTheme: theme,
        lastReporterModel: model,
        lastReporterSkipped: false,
        lastReporterDraftOnly: true,
        lastReporterDraft: {
          title,
          summary,
          fullText,
          imageUrl,
          theme,
          model,
          score,
          date: targetDate,
        },
      });
      return {
        draft: true,
        title,
        summary,
        fullText,
        imageUrl,
        theme,
        model,
        score,
        item: newArticle,
      };
    }

    // force + aynı gün: önceki id'yi upsert et (tek rapor/gün)
    if (force) {
      newArticle.id = todayId;
    }

    const { data: saved, error } = await db.from('news_items').upsert(newArticle).select('*').single();
    if (error) throw new Error(error.message);

    try {
      newsService.prependToCache(newsService.mapDbRowToItem(saved));
    } catch (_) {}

    console.log(`[ai-reporter] Published: "${title}" theme=${theme} score=${score} model=${model}`);

    try {
      const fcmService = require('./fcmService');
      if (fcmService.isFcmConfigured()) {
        await fcmService.sendToTopic('news_duzici', {
          title: 'Düziçi akşam bülteni hazır 📰',
          body: title,
          data: { route: String(newArticle.id) },
        });
      }
    } catch (fcmErr) {
      console.error('[ai-reporter] FCM failed:', fcmErr.message);
    }

    await this.saveReporterStatus({
      lastReporterOk: true,
      lastReporterError: null,
      lastReporterTitle: title,
      lastReporterScore: score,
      lastReporterTheme: theme,
      lastReporterModel: model,
      lastReporterSkipped: false,
      lastReporterDraftOnly: false,
      lastReporterDraft: {
        title,
        summary,
        fullText,
        imageUrl,
        theme,
        model,
        score,
        date: targetDate,
        published: true,
        newsId: newArticle.id,
      },
    });

    return saved;
  }

  async generateIfDue() {
    const config = require('../config');
    let reporterEnabled = config.AI_NEWS.REPORTER_ENABLED;
    let requireApproval = false;
    try {
      const cityContent = await fileService.readCityContent();
      if (cityContent?.aiNewsSettings?.reporterEnabled !== undefined) {
        reporterEnabled = cityContent.aiNewsSettings.reporterEnabled === true;
      }
      requireApproval = cityContent?.aiNewsSettings?.reporterRequireApproval === true;
    } catch (_) {}

    if (!reporterEnabled) return null;

    const tr = turkeyDateParts();
    if (tr.hour < config.AI_NEWS.REPORTER_HOUR_TR) return null;

    if (this._generating) return null;
    this._generating = true;

    try {
      return await this.generateDailyReport({
        force: false,
        publish: !requireApproval,
      });
    } catch (err) {
      console.error('[ai-reporter] Automatic report generation failed:', err.message);
      await this.saveReporterStatus({
        lastReporterOk: false,
        lastReporterError: String(err.message || 'Bilinmeyen hata').slice(0, 240),
        lastReporterSkipped: false,
      });
      return null;
    } finally {
      this._generating = false;
    }
  }
}

module.exports = new AiReporterService();
