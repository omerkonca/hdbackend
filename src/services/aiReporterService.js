const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
const { getDbPool } = require('../utils/dbPool');
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

/** ISO → TR saati "HH:MM" (veya boş). */
function formatTrClock(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch (_) {
    return '';
  }
}

/** Kesinti hedef güne (TR) ilgili mi? */
function outageTouchesTargetDate(item, targetDate) {
  const dayStart = new Date(`${targetDate}T00:00:00+03:00`).getTime();
  const dayEnd = new Date(`${targetDate}T23:59:59+03:00`).getTime();

  const toMs = (v) => {
    if (!v) return NaN;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : NaN;
  };

  const start = toMs(item.startAt || item.date);
  const end = toMs(item.endAt);
  const published = toMs(item.publishedAt || item.createdAt);

  // start–end (veya end yoksa ~14 saat varsayımı) günü kesiyorsa
  if (Number.isFinite(start)) {
    const effectiveEnd = Number.isFinite(end) ? end : start + 14 * 60 * 60 * 1000;
    if (start <= dayEnd && effectiveEnd >= dayStart) return true;
  }

  // Bugün yayınlandı / kayda düştü
  if (Number.isFinite(published) && published >= dayStart && published <= dayEnd + 3 * 60 * 60 * 1000) {
    return true;
  }

  // Metinde "26 Ağustos" / "26.08.2026" geçiyorsa
  const blob = normalizeTr(`${item.title || ''} ${item.subtitle || ''} ${item.area || ''}`);
  const [, mm, dd] = String(targetDate).split('-');
  const dayNum = String(parseInt(dd, 10));
  const monthNames = {
    '01': 'ocak',
    '02': 'subat',
    '03': 'mart',
    '04': 'nisan',
    '05': 'mayis',
    '06': 'haziran',
    '07': 'temmuz',
    '08': 'agustos',
    '09': 'eylul',
    '10': 'ekim',
    '11': 'kasim',
    '12': 'aralik',
  };
  const monthName = monthNames[mm];
  if (monthName && new RegExp(`\\b${dayNum}\\s+${monthName}\\b`).test(blob)) return true;
  if (new RegExp(`\\b${dayNum}[./]${mm}([./]\\d{2,4})?\\b`).test(blob)) return true;

  return false;
}

/** AI'nın "kesinti yok" yalanını, elimde kayıt varken temizle. */
function scrubFalseNoOutageClaims(text, hasOutages) {
  if (!hasOutages || !text) return text;
  let out = String(text);
  const patterns = [
    /planlı\s+(elektrik|su)(\s+veya\s+(elektrik|su))?\s+kesintisi\s+(bulunmuyor|yok|rapor\s+edilmedi)[^.!\n]*/gi,
    /gün\s+boyunca\s+planlı\s+[^.!\n]*kesinti[^.!\n]*(bulunmuyor|yok|rapor\s+edilmedi)[^.!\n]*/gi,
    /kesinti\s+(kaydı\s+)?(bulunmuyor|yok|rapor\s+edilmedi)[^.!\n]*/gi,
    /elektrik\s+veya\s+su\s+kesintisi\s+(bulunmuyor|yaşanmıyor|rapor\s+edilmedi)[^.!\n]*/gi,
  ];
  for (const re of patterns) {
    out = out.replace(re, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return out;
}

function formatOutageLine(o, { finished = false } = {}) {
  const type = o.type || (normalizeTr(o.title || '').includes('su') ? 'Su' : 'Elektrik');
  const area = String(o.area || '').trim();
  const title = String(o.title || 'Kesinti').trim();
  const start = formatTrClock(o.startAt);
  const end = formatTrClock(o.endAt);
  const when =
    start && end ? `${start}–${end}` : start ? `${start}'den itibaren` : end ? `${end}'e kadar` : '';
  const status = finished
    ? 'TAMAMLANDI (bugün yaşandı)'
    : o.status
      ? String(o.status)
      : 'Aktif/Planlı';
  const detail = String(o.subtitle || o.description || '').trim().slice(0, 160);
  const source = String(o.source || o.sourceName || '').trim();
  const parts = [
    `[${type}]`,
    area ? `${area}:` : null,
    title,
    when ? `(${when})` : null,
    `— ${status}`,
    detail ? `| ${detail}` : null,
    source ? `| Kaynak: ${source}` : null,
  ].filter(Boolean);
  return `- ${parts.join(' ')}`;
}

class AiReporterService {
  constructor() {
    this._generating = false;
    this._lastCompletedDate = null;
  }

  async checkAlreadyReportedToday(targetDate, todayId) {
    // 1. Direct PG Pool check
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query('SELECT id FROM news_items WHERE id = $1 LIMIT 1', [todayId]);
        if (res.rows && res.rows.length > 0) return true;
      } catch (e) {
        console.warn('[ai-reporter] pg check existing error:', e.message);
      }
    }

    // 2. Supabase Admin check
    try {
      const db = requireSupabaseAdmin();
      if (db) {
        const { data: existing, error } = await db.from('news_items').select('id').eq('id', todayId).maybeSingle();
        if (!error && existing) return true;
      }
    } catch (e) {
      console.warn('[ai-reporter] supabase check existing error:', e.message);
    }

    // 3. News service cache / memory check
    try {
      const cached = (newsService.cache?.items || []).some(
        (x) => x.id === todayId || (x.id && x.id.startsWith('news-ai-reporter-') && x.createdAt && x.createdAt.startsWith(targetDate))
      );
      if (cached) return true;
    } catch (_) {}

    // 4. City content settings check
    try {
      const city = await fileService.readCityContent();
      if (city?.aiNewsSettings?.lastReporterDate === targetDate && city?.aiNewsSettings?.lastReporterOk === true) {
        return true;
      }
    } catch (_) {}

    return false;
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

    // 2. Outages — tüm aktifler + bugünle ilgili history (tarih kayması / biten kayıtlar dahil)
    try {
      await outageService.getOutages({ forceRefresh: true });
      const activeRaw = (await outageService.getOutages()) || [];
      const historyRaw = outageService.getHistory() || [];

      // Aktif kesintiler her zaman bugünkü bültene girer (tarih filtresi yok)
      const active = activeRaw.filter(
        (o) => o && o.isActive !== false && normalizeTr(o.status || '') !== 'tamamlandi',
      );

      const finishedToday = historyRaw.filter((o) => o && outageTouchesTargetDate(o, targetDate));

      const seen = new Set();
      const uniquePush = (list, item) => {
        const key = String(item.id || `${item.title}|${item.area}|${item.startAt || ''}`);
        if (seen.has(key)) return;
        seen.add(key);
        list.push(item);
      };

      const mergedActive = [];
      const mergedFinished = [];
      for (const o of active) uniquePush(mergedActive, o);
      for (const o of finishedToday) uniquePush(mergedFinished, o);

      snapshot.outageCount = mergedActive.length + mergedFinished.length;
      snapshot.activeOutageCount = mergedActive.length;
      snapshot.finishedOutageCount = mergedFinished.length;

      console.log(
        `[ai-reporter] outages: active=${mergedActive.length} finishedToday=${mergedFinished.length} historyRaw=${historyRaw.length}`,
      );

      if (snapshot.outageCount > 0) {
        const lines = [];
        if (mergedActive.length) {
          lines.push('ŞU AN AKTİF / PLANLI:');
          lines.push(...mergedActive.slice(0, 12).map((o) => formatOutageLine(o)));
        }
        if (mergedFinished.length) {
          lines.push('BUGÜN YAŞANIP SONA EREN (veya bugünle ilgili tamamlanan):');
          lines.push(
            ...mergedFinished.slice(0, 12).map((o) => formatOutageLine(o, { finished: true })),
          );
        }
        snapshot.outagesText = lines.join('\n');
        snapshot.signals.push('outage');
      } else {
        snapshot.outagesText =
          'Bugün için aktif veya tamamlanmış elektrik/su kesintisi kaydı YOK (kaynaklar tarandı).';
      }
    } catch (err) {
      console.warn('[ai-reporter] Outages fetch failed:', err.message);
      snapshot.outagesText =
        'Kesinti verisi alınamadı — "kesinti yok" yazma; veri eksik olduğunu belirt.';
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

    // 5. Local news — Düziçi öncelikli; Osmaniye çevresi ikincil
    try {
      const news = await newsService.getNews({ max: 150 });
      const targetTime = targetDate ? new Date(`${targetDate}T23:59:59+03:00`).getTime() : Date.now();
      const maxAgeMs = 24 * 60 * 60 * 1000;

      const scored = [];
      for (const n of news || []) {
        const id = String(n.id || '');
        if (id.startsWith('news-ai-reporter-')) continue;

        const pubTime = n.createdAt ? new Date(n.createdAt).getTime() : 0;
        if (Number.isFinite(pubTime) && pubTime > 0) {
          if (targetTime - pubTime > maxAgeMs || pubTime > targetTime + 2 * 60 * 60 * 1000) {
            continue;
          }
        }

        if (newsService.isNationalNoise?.(n.title, n.summary)) continue;
        if (newsService.isNonDuziciRegionalFocus?.(n.title, `${n.summary || ''} ${n.fullText || ''}`)) {
          continue;
        }

        const cat = normalizeTr(n.category || '');
        const src = normalizeTr(n.sourceName || '');
        const isOwn = id.startsWith('news-custom-') || src.includes('hepsi');
        const isDuziciSource = src.includes('duzici') || src.includes('sabir') || src.includes('hasret');
        const isDuziciCat = cat.includes('duzici');
        const isDuzici =
          isDuziciCat ||
          isDuziciSource ||
          isOwn ||
          newsService.isDuziciRelated(n.title, `${n.summary || ''} ${n.fullText || ''}`);
        const isOsmaniye =
          !isDuzici &&
          (cat.includes('osmaniye') ||
            newsService.isOsmaniyeRelated?.(n.title, `${n.summary || ''} ${n.fullText || ''}`));

        if (!isDuzici && !isOsmaniye) continue;

        scored.push({
          n,
          rank: isDuzici ? 0 : 1,
          text: `- [${isDuzici ? 'DÜZİÇİ' : 'OSMANİYE'} | ${n.sourceName || 'Kaynak'}] ${n.title}${
            n.summary ? `: ${String(n.summary).slice(0, 220)}` : ''
          }`,
        });
      }

      scored.sort((a, b) => a.rank - b.rank);
      const pick = scored.slice(0, 18);
      snapshot.newsCount = pick.filter((x) => x.rank === 0).length;
      snapshot.osmaniyeNewsCount = pick.filter((x) => x.rank === 1).length;
      if (pick.length > 0) {
        snapshot.newsText = pick.map((x) => x.text).join('\n');
        if (snapshot.newsCount > 0) snapshot.signals.push('news');
      } else {
        snapshot.newsText = 'Son 24 saatte öne çıkan Düziçi yerel haberi sınırlı.';
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
    return 'assets/images/ai_reporter_cover.jpg';
  }

  buildPrompts({ targetDate, dateLabel, snapshot, quietDay }) {
    const hasOutages = (snapshot.outageCount || 0) > 0;
    const systemPrompt =
      'Sen Düziçi (Osmaniye) ilçesinin deneyimli yerel muhabiri ve akşam bülteni editörüsün. ' +
      'Görevin: Son 24 saatte DÜZİÇİ\'de yaşananları profesyonel, net ve güvenilir gazeteci diliyle anlatmak. ' +
      'Öncelik her zaman Düziçi ilçesidir; Osmaniye geneli haberler yalnızca kısa bağlam olarak geçebilir. ' +
      'Verilmeyen bilgiyi uydurma. Özellikle kesinti, yol, eczane ve hava için yalnızca verilen veri bloğunu kullan. ' +
      'Yanıtını yalnızca geçerli JSON olarak ver.';

    const outageRule = hasOutages
      ? `KRİTİK KESİNTİ KURALI: Aşağıda ${snapshot.outageCount} kesinti kaydı VAR (aktif: ${snapshot.activeOutageCount || 0}, bugün biten: ${snapshot.finishedOutageCount || 0}). ` +
        `"Kesinti yok / rapor edilmedi / planlı kesinti bulunmuyor" YAZMAN KESİNLİKLE YASAK. ` +
        `Her kesintiyi mahalle/alan, saat aralığı ve (varsa) kaynakla anlat. Bugün bitenleri de "bugün yaşandı" diye belirt.`
      : `Kesinti bloğunda kayıt yoksa yalnızca o zaman "bugün için kayıtlı planlı kesinti bulunmuyor" diyebilirsin. Veri alınamadıysa bunu açıkça söyle; yokmuş gibi yazma.`;

    const quietNote = quietDay
      ? `\nNot: Bugün veri skoru düşük (sakin gün). Abartma; kısa ama profesyonel bir bülten yaz. Boşluğu uydurma haberle doldurma.\n`
      : '';

    const userPrompt =
      `Tarih: ${dateLabel} (${targetDate})\n` +
      `Konum odağı: Düziçi, Osmaniye (önce ilçe, sonra gerekirse il)\n` +
      quietNote +
      `\n=== DÜZİÇİ / YEREL HABERLER (son 24 saat) ===\n${snapshot.newsText || 'Sınırlı'}\n\n` +
      `=== ELEKTRİK & SU KESİNTİLERİ (aktif + bugün tamamlanan) ===\n${snapshot.outagesText || 'Veri yok'}\n\n` +
      `=== YOL VE TRAFİK ===\n${snapshot.closuresText || 'Veri yok'}\n\n` +
      `=== HAVA (yarın odaklı) ===\n${snapshot.weatherText || 'Veri yok'}\n\n` +
      `=== NÖBETÇİ ECZANE ===\n${snapshot.pharmacyText || 'Veri yok'}\n\n` +
      `=== ETKİNLİKLER ===\n${snapshot.eventsText || 'Veri yok'}\n\n` +
      `=== VEFAT İLANLARI ===\n${snapshot.obituariesText || 'Veri yok'}\n\n` +
      `=== AKARYAKIT ===\n${snapshot.fuelText || 'Veri yok'}\n\n` +
      `${outageRule}\n\n` +
      `YAZIM KURALLARI:\n` +
      `1. title: Profesyonel yerel gazete manşeti (max 90 karakter).\n` +
      `   - Günün asıl Düziçi gelişmesini veya "Düziçi akşam bülteni" çerçevesini yansıt.\n` +
      `   - Zorunlu klişe kalıplara mahkum olma; ama tek bir uzak Osmaniye haberini manşet yapma.\n` +
      `   - Kesinti varsa başlıkta veya spotta mutlaka geçsin.\n\n` +
      `2. summary: 2-3 cümle, max 220 karakter. Düziçi odaklı; kesinti varsa belirt.\n\n` +
      `3. fullText: Paragraflar arasında boş satır. Markdown/HTML yok. Akış:\n` +
      `   - Giriş: Kısa selamlama + günün Düziçi atmosferi (abartısız).\n` +
      `   - Yerel gelişmeler: [DÜZİÇİ] etiketli haberleri önce, ayrıntılı ve tarafsız anlat.\n` +
      `     [OSMANİYE] etiketlileri en fazla 1 kısa paragrafta özetle; ilçe bültenini ele geçirmesin.\n` +
      `   - Altyapı: Kesintileri saat/mahalle ile yaz. Yol çalışmalarını net söyle.\n` +
      `   - Hava: Yarın için sıcaklık + kısa pratik uyarı.\n` +
      `   - Nöbetçi eczane: Ad, adres, telefon.\n` +
      `   - Vefat (varsa saygıyla; yoksa atla).\n` +
      `   - Kısa kapanış.\n\n` +
      `4. themeHint: news|city|outage|rain|hot|cold|event|pharmacy|memorial|calm\n\n` +
      `JSON:\n` +
      `{"title":"...","summary":"...","fullText":"...","themeHint":"news"}`;

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

    const todayHash = crypto.createHash('md5').update(`ai-reporter-${targetDate}`).digest('hex');
    const todayId = `news-ai-reporter-${todayHash}`;

    if (!force) {
      const alreadyReported = await this.checkAlreadyReportedToday(targetDate, todayId);
      if (alreadyReported) {
        console.log(`[ai-reporter] Daily report for ${targetDate} already exists. Skipping.`);
        this._lastCompletedDate = targetDate;
        await this.saveReporterStatus({
          lastReporterOk: true,
          lastReporterDate: targetDate,
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
    await this.saveReporterStatus({ lastReporterError: null, lastReporterSkipped: false });
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
    let summary = String(data.summary || '').trim().slice(0, 250);
    let fullText = String(data.fullText || '').trim();
    if (!fullText || fullText.length < 80) {
      throw new Error('AI metni çok kısa veya boş');
    }

    // Kesinti kaydı varken model "kesinti yok" yazarsa temizle
    const hasOutages = (snapshot.outageCount || 0) > 0;
    summary = scrubFalseNoOutageClaims(summary, hasOutages).slice(0, 250);
    fullText = scrubFalseNoOutageClaims(fullText, hasOutages);
    if (hasOutages && !/kesinti/i.test(fullText)) {
      fullText = `${fullText}\n\nAltyapı: ${snapshot.outagesText}`.trim();
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
      this._lastCompletedDate = targetDate;
      await this.saveReporterStatus({
        lastReporterOk: true,
        lastReporterDate: targetDate,
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

    const pool = getDbPool();
    let saved = newArticle;
    if (pool) {
      try {
        const sql = `
          INSERT INTO news_items (
            id, title, summary, full_text, image_url, images, created_at,
            source_url, source_name, category, verified, is_ai_generated, is_ai_optimized, fetched_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            full_text = EXCLUDED.full_text,
            image_url = EXCLUDED.image_url,
            images = EXCLUDED.images,
            category = EXCLUDED.category,
            verified = EXCLUDED.verified,
            is_ai_generated = EXCLUDED.is_ai_generated,
            is_ai_optimized = EXCLUDED.is_ai_optimized,
            fetched_at = NOW()
          RETURNING *
        `;
        const res = await pool.query(sql, [
          newArticle.id,
          newArticle.title,
          newArticle.summary,
          newArticle.full_text || newArticle.fullText || null,
          newArticle.image_url || newArticle.imageUrl,
          Array.isArray(newArticle.images) ? newArticle.images : (newArticle.image_url ? [newArticle.image_url] : []),
          newArticle.created_at || new Date().toISOString(),
          newArticle.source_url || newArticle.sourceUrl,
          newArticle.source_name || newArticle.sourceName || 'Şehir Muhabiri (AI)',
          newArticle.category || 'Düziçi',
          newArticle.verified === true,
          newArticle.is_ai_generated === true,
          newArticle.is_ai_optimized === true,
        ]);
        if (res.rows.length > 0) {
          saved = res.rows[0];
        }
      } catch (pgErr) {
        console.error('[ai-reporter] PG upsert error:', pgErr.message);
      }
    } else {
      const { data: dbSaved, error } = await db.from('news_items').upsert(newArticle).select('*').single();
      if (error) throw new Error(error.message);
      if (dbSaved) saved = dbSaved;
    }

    try {
      newsService.prependToCache(newsService.mapDbRowToItem(saved));
    } catch (_) {}

    console.log(`[ai-reporter] Published: "${title}" theme=${theme} score=${score} model=${model}`);

    // Push notification gönderimi: Günde en fazla 1 kez bildirim gitmesi garanti edilir
    let pushSent = false;
    try {
      const cityCheck = await fileService.readCityContent();
      const pushAlreadySentToday = cityCheck?.aiNewsSettings?.lastReporterPushDate === targetDate;
      if (pushAlreadySentToday) {
        console.log(`[ai-reporter] Push notification for ${targetDate} already sent today. Skipping FCM push.`);
      } else {
        const fcmService = require('./fcmService');
        if (fcmService.isFcmConfigured()) {
          await fcmService.sendToTopic('news_duzici', {
            title: 'Düziçi akşam bülteni hazır 📰',
            body: title,
            data: { route: String(newArticle.id) },
          });
          pushSent = true;
          console.log(`[ai-reporter] FCM push sent successfully for ${targetDate}`);
        }
      }
    } catch (fcmErr) {
      console.error('[ai-reporter] FCM failed:', fcmErr.message);
    }

    this._lastCompletedDate = targetDate;
    await this.saveReporterStatus({
      lastReporterOk: true,
      lastReporterDate: targetDate,
      ...(pushSent ? { lastReporterPushDate: targetDate } : {}),
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
    let reporterEnabled = config.AI_NEWS.REPORTER_ENABLED !== false;
    let requireApproval = false;
    let cityContent = null;
    try {
      cityContent = await fileService.readCityContent();
      if (cityContent?.aiNewsSettings?.reporterEnabled !== undefined) {
        reporterEnabled = cityContent.aiNewsSettings.reporterEnabled === true;
      }
      requireApproval = cityContent?.aiNewsSettings?.reporterRequireApproval === true;
    } catch (_) {}

    if (!reporterEnabled) return null;

    const tr = turkeyDateParts();
    if (tr.hour < config.AI_NEWS.REPORTER_HOUR_TR) return null;

    // Eğer bugün zaten başarıyla tamamlandıysa doğrudan atla
    if (
      this._lastCompletedDate === tr.date ||
      (cityContent?.aiNewsSettings?.lastReporterDate === tr.date && cityContent?.aiNewsSettings?.lastReporterOk === true)
    ) {
      return null;
    }

    const todayHash = crypto.createHash('md5').update(`ai-reporter-${tr.date}`).digest('hex');
    const todayId = `news-ai-reporter-${todayHash}`;
    const alreadyExists = await this.checkAlreadyReportedToday(tr.date, todayId);
    if (alreadyExists) {
      this._lastCompletedDate = tr.date;
      return null;
    }

    if (this._generating) return null;
    this._generating = true;

    try {
      const result = await this.generateDailyReport({
        force: false,
        publish: !requireApproval,
      });
      if (result) {
        this._lastCompletedDate = tr.date;
      }
      return result;
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
