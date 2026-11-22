/**
 * Çiftçi Paketi: Düziçi için tarımsal hava riski, ilaçlama uygunluğu, sulama ihtiyacı,
 * mevsimlik iş takvimi, tarım duyuruları ve piyasa haberleri.
 *
 * Kaynaklar (hepsi ücretsiz, anahtar gerektirmez):
 *  - Open-Meteo (https://open-meteo.com) saatlik/günlük tahmin
 *  - Sunucunun zaten topladığı haberler (newsService önbelleği)
 *
 * Fiyat tablosu bilerek yok: yer fıstığı/zeytinyağı için resmi, düzenli bir günlük
 * borsa fiyatı kaynağı bulunmuyor; çiftçiye yanlış fiyat göstermek zarar verir.
 */
const { fetchWithTimeout, normalizeForCompare } = require('../utils/helpers');
const fcmService = require('./fcmService');
const { getDbPool } = require('../utils/dbPool');

const LAT = 37.244;
const LNG = 36.451;
const CACHE_MS = 30 * 60 * 1000;
const TOPIC = 'farmer_alerts';

const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${LAT}&longitude=${LNG}&timezone=Europe%2FIstanbul&forecast_days=7` +
  '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code' +
  '&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,' +
  'wind_gusts_10m_max,weather_code,sunrise,sunset,et0_fao_evapotranspiration' +
  '&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,' +
  'weather_code,relative_humidity_2m,soil_temperature_6cm';

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** Ay bazlı genel iş takvimi (Çukurova iklimi; yerel koşullara göre birkaç hafta kayabilir). */
const CALENDAR = {
  1: [
    { crop: 'Zeytin', task: 'Hasat sonu bakım; yaralı dallara bakır içerikli ilaçlama değerlendirilebilir.' },
    { crop: 'Buğday', task: 'Kardeşlenme dönemi; yabancı ot kontrolü ve üst gübre planlaması.' },
    { crop: 'Genel', task: 'Don gecelerinde fide ve genç ağaçları örtün.' },
  ],
  2: [
    { crop: 'Zeytin', task: 'Budama dönemi başlıyor; kuru ve hastalıklı dalları temizleyin.' },
    { crop: 'Buğday', task: 'Azotlu üst gübreleme zamanı.' },
    { crop: 'Yer fıstığı', task: 'Tarla seçimi ve toprak analizi; ekim nöbetine dikkat.' },
  ],
  3: [
    { crop: 'Zeytin', task: 'Budamayı tamamlayın; çiçeklenme öncesi gübreleme.' },
    { crop: 'Yer fıstığı', task: 'Toprak hazırlığı: derin sürüm ve tesviye.' },
    { crop: 'Buğday', task: 'Hastalık (pas, septorya) kontrolü.' },
  ],
  4: [
    { crop: 'Yer fıstığı', task: 'Ekim dönemi: toprak sıcaklığı 16°C üzerine çıkınca ekin.' },
    { crop: 'Zeytin', task: 'Çiçeklenme; zeytin güvesine karşı gözlem.' },
    { crop: 'Buğday', task: 'Başaklanma; sulama ihtiyacını izleyin.' },
  ],
  5: [
    { crop: 'Yer fıstığı', task: 'Geç ekimler ve çıkış sonrası çapalama.' },
    { crop: 'Buğday', task: 'Hasat hazırlığı; Mayıs sonu–Haziran başı hasat.' },
    { crop: 'Zeytin', task: 'Meyve tutumu; düzenli sulama.' },
  ],
  6: [
    { crop: 'Buğday', task: 'Hasat dönemi.' },
    { crop: 'Yer fıstığı', task: 'Çiçeklenme ve kazık (pegging) dönemi; boğaz doldurma ve düzenli sulama.' },
    { crop: 'Zeytin', task: 'Zeytin sineğine karşı tuzak kontrolü.' },
  ],
  7: [
    { crop: 'Yer fıstığı', task: 'Kritik su ihtiyacı dönemi; sulamayı aksatmayın.' },
    { crop: 'Zeytin', task: 'Sıcak dalgalarında sulama; zeytin sineği takibi.' },
    { crop: 'Genel', task: 'Öğle sıcağında ilaçlama yapmayın.' },
  ],
  8: [
    { crop: 'Yer fıstığı', task: 'Kapsül dolumu; sulamayı sürdürün, yaprak hastalıklarını izleyin.' },
    { crop: 'Zeytin', task: 'Zeytin sineği ilaçlaması için uzman önerisine göre hareket edin.' },
  ],
  9: [
    { crop: 'Yer fıstığı', task: 'Hasat dönemi başlıyor; sökümü yağışsız günlere planlayın.' },
    { crop: 'Zeytin', task: 'Sofralık yeşil zeytin hasadı başlar.' },
  ],
  10: [
    { crop: 'Yer fıstığı', task: 'Hasat ve kurutma; nemli depolamadan kaçının (aflatoksin riski).' },
    { crop: 'Zeytin', task: 'Yağlık zeytin hasadı; fabrikadan randevu almayı unutmayın.' },
    { crop: 'Buğday', task: 'Ekim için toprak hazırlığı.' },
  ],
  11: [
    { crop: 'Zeytin', task: 'Hasat ve sıkım dönemi; zeytini bekletmeden fabrikaya götürün.' },
    { crop: 'Buğday', task: 'Ekim dönemi.' },
    { crop: 'Genel', task: 'ÇKS ve destek başvuru tarihlerini takip edin.' },
  ],
  12: [
    { crop: 'Zeytin', task: 'Hasadı tamamlayın; hasat sonu bakır ilaçlaması değerlendirilebilir.' },
    { crop: 'Buğday', task: 'Geç ekimleri tamamlayın.' },
    { crop: 'Genel', task: 'Don gecelerinde hassas bitkileri koruyun; ÇKS yenilemesi yıl sonu.' },
  ],
};

const ANNOUNCEMENT_RE =
  /(cks|ciftci kayit|ciftciye|ciftcilere|ciftciler|tarim ve orman|ilce tarim|tarim mudurlugu|zirai|tarimsal destek|tarimsal|hibe|destek odeme|tohum|gubre|sulama birligi|kooperatif|ziraat odasi|tkdk|hasat)/;
const MARKET_CROP_RE = /(yer fistig|yerfistig|fistik|zeytin|zeytinyag|bugday|hububat)/;
const MARKET_TOPIC_RE = /(fiyat|hasat|rekolte|borsa|alim|uretici|ihracat|kilogram|kilosu|tonaj|rekor|piyasa|tmo)/;
const MARKET_EXCLUDE_RE = /(israil|gazze|ukrayna|rusya|unocha|antep fistigi|ambalaj)/;

function trDayLabel(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Bugün';
  const t = new Date(`${todayStr}T12:00:00`);
  const d = new Date(`${dateStr}T12:00:00`);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return 'Yarın';
  return DAY_NAMES[d.getDay()];
}

function weatherText(code) {
  if (code === 0) return 'Açık';
  if (code <= 2) return 'Az bulutlu';
  if (code === 3) return 'Bulutlu';
  if (code === 45 || code === 48) return 'Sisli';
  if (code >= 51 && code <= 57) return 'Çisenti';
  if (code >= 61 && code <= 67) return 'Yağmurlu';
  if (code >= 71 && code <= 77) return 'Kar';
  if (code >= 80 && code <= 82) return 'Sağanak';
  if (code === 85 || code === 86) return 'Kar sağanağı';
  if (code === 95) return 'Gök gürültülü sağanak';
  if (code === 96 || code === 99) return 'Dolu riskli fırtına';
  return 'Değişken';
}

/** Europe/Istanbul saatine göre "YYYY-MM-DD" ve "YYYY-MM-DDTHH:00". */
function istanbulNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return { date, hourIso: `${date}T${hour}:00` };
}

/**
 * Kayıtlı tahmini bugünden başlatır: geçmiş günleri atar ve "şu an" değerlerini
 * saatlik tahminin bu saatine ait değerleriyle değiştirir.
 */
function shiftForecastToToday(raw) {
  const f = JSON.parse(JSON.stringify(raw));
  const { date, hourIso } = istanbulNow();
  const start = f.daily.time.indexOf(date);
  if (start > 0) {
    for (const key of Object.keys(f.daily)) {
      if (Array.isArray(f.daily[key])) f.daily[key] = f.daily[key].slice(start);
    }
  }
  const i = f.hourly.time.indexOf(hourIso);
  if (i >= 0) {
    f.current = {
      ...f.current,
      time: hourIso,
      temperature_2m: f.hourly.temperature_2m[i],
      relative_humidity_2m: f.hourly.relative_humidity_2m[i],
      wind_speed_10m: f.hourly.wind_speed_10m[i],
      weather_code: f.hourly.weather_code[i],
    };
  }
  return f;
}

class FarmerService {
  constructor() {
    this.cache = { fetchedAt: 0, data: null };
    this._inflight = null;
  }

  /**
   * Open-Meteo tahminini getirir. Render'ın paylaşılan IP'si yüzünden zaman zaman
   * 429 (çok fazla istek) dönebiliyor: kısa aralıklarla tekrar dener, yine olmazsa
   * veritabanında saklanan son başarılı tahmini (36 saate kadar) bugüne kaydırarak kullanır.
   */
  async _fetchForecast() {
    let lastErr;
    for (const waitMs of [0, 1500, 4000]) {
      if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
      try {
        const res = await fetchWithTimeout(FORECAST_URL, { headers: { Accept: 'application/json' } }, 15000);
        if (res.ok) {
          const raw = await res.json();
          this._saveForecast(raw).catch(() => {});
          return { raw, fetchedAt: new Date().toISOString(), stale: false };
        }
        lastErr = new Error(`Open-Meteo HTTP ${res.status}`);
        if (res.status !== 429 && res.status < 500) break;
      } catch (err) {
        lastErr = err;
      }
    }
    const saved = await this._loadForecast();
    if (saved) {
      console.warn(`[farmer] ${lastErr?.message}; kayıtlı tahmin kullanılıyor (${saved.fetchedAt}).`);
      return { raw: shiftForecastToToday(saved.raw), fetchedAt: saved.fetchedAt, stale: true };
    }
    throw lastErr || new Error('Open-Meteo erişilemedi');
  }

  async _ensureCacheTable(pool) {
    if (this._cacheTableReady) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.service_cache (
        key text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE public.service_cache ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON public.service_cache FROM anon, authenticated;
    `);
    this._cacheTableReady = true;
  }

  async _saveForecast(raw) {
    const pool = getDbPool();
    if (!pool) return;
    await this._ensureCacheTable(pool);
    await pool.query(
      `INSERT INTO public.service_cache (key, data, updated_at) VALUES ('farmer_forecast', $1, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [JSON.stringify(raw)],
    );
  }

  async _loadForecast() {
    try {
      const pool = getDbPool();
      if (!pool) return null;
      await this._ensureCacheTable(pool);
      const res = await pool.query(
        `SELECT data, updated_at FROM public.service_cache
          WHERE key = 'farmer_forecast' AND updated_at > now() - interval '36 hours'`,
      );
      if (!res.rows.length) return null;
      return { raw: res.rows[0].data, fetchedAt: new Date(res.rows[0].updated_at).toISOString() };
    } catch (_) {
      return null;
    }
  }

  /** Bir günün riskleri (şiddet: 'severe' | 'warning'). */
  _risksForDay(day, hours) {
    const risks = [];
    const min = day.min;
    if (min <= -2) {
      risks.push({
        type: 'frost', severity: 'severe', title: 'Zirai Don',
        message: `Gece sıcaklık ${min.toFixed(0)}°C'ye düşebilir. Fide ve genç ağaçları örtün, sulamayı akşama yapmayın.`,
      });
    } else if (min <= 0.5) {
      risks.push({
        type: 'frost', severity: 'warning', title: 'Don Riski',
        message: `Gece sıcaklık ${min.toFixed(0)}°C civarında. Hassas bitkileri koruyun.`,
      });
    }
    if (hours.some((h) => h.code === 96 || h.code === 99)) {
      risks.push({
        type: 'hail', severity: 'severe', title: 'Dolu Riski',
        message: 'Gök gürültülü sağanakla birlikte dolu görülebilir. Hasadı ve açıktaki ürünü koruyun.',
      });
    } else if (hours.some((h) => h.code === 95)) {
      risks.push({
        type: 'thunder', severity: 'warning', title: 'Gök Gürültülü Sağanak',
        message: 'Yer yer gök gürültülü sağanak bekleniyor. Tarlada çalışırken dikkatli olun.',
      });
    }
    if (day.gust >= 65) {
      risks.push({
        type: 'storm', severity: 'severe', title: 'Fırtına',
        message: `Rüzgar hamlelerde ${day.gust.toFixed(0)} km/s'ye ulaşabilir. Örtü ve seraları sabitleyin.`,
      });
    } else if (day.gust >= 50) {
      risks.push({
        type: 'storm', severity: 'warning', title: 'Kuvvetli Rüzgar',
        message: `Rüzgar hamlelerde ${day.gust.toFixed(0)} km/s. İlaçlama yapmayın, örtüleri kontrol edin.`,
      });
    }
    if (day.rain >= 30) {
      risks.push({
        type: 'rain', severity: 'severe', title: 'Kuvvetli Yağış',
        message: `${day.rain.toFixed(0)} mm yağış bekleniyor. Su baskınına ve hasat kayıplarına dikkat.`,
      });
    } else if (day.rain >= 15) {
      risks.push({
        type: 'rain', severity: 'warning', title: 'Yoğun Yağış',
        message: `${day.rain.toFixed(0)} mm yağış bekleniyor. Hasat ve ilaçlamayı ertelemek iyi olabilir.`,
      });
    }
    if (day.max >= 38) {
      risks.push({
        type: 'heat', severity: 'warning', title: 'Aşırı Sıcak',
        message: `Sıcaklık ${day.max.toFixed(0)}°C'ye çıkabilir. Sulamayı sabah erken ya da akşam yapın.`,
      });
    }
    return risks;
  }

  /** İlaçlamaya uygun saat aralıkları (önümüzdeki 48 saat, gündüz). */
  _sprayWindows(hourly, nowIso) {
    const ok = [];
    const n = hourly.time.length;
    for (let i = 0; i < n; i++) {
      const t = hourly.time[i];
      if (t < nowIso) continue;
      if (ok.length && t > ok[0].limit) break;
      const hour = Number(t.slice(11, 13));
      if (hour < 6 || hour > 19) continue;
      const nextRain = [0, 1, 2, 3].some((k) => (hourly.precipitation[i + k] || 0) > 0.1);
      const good =
        (hourly.wind_speed_10m[i] ?? 99) < 15 &&
        (hourly.wind_gusts_10m[i] ?? 99) < 28 &&
        (hourly.precipitation_probability[i] ?? 100) < 30 &&
        !nextRain &&
        hourly.temperature_2m[i] >= 8 &&
        hourly.temperature_2m[i] <= 28 &&
        (hourly.relative_humidity_2m[i] ?? 100) < 90;
      ok.push({ t, good, limit: ok.length ? ok[0].limit : addHours(t, 48) });
    }
    const windows = [];
    let start = null;
    let prev = null;
    for (const h of ok) {
      const contiguous = prev && addHours(prev.t, 1) === h.t;
      if (h.good && (start === null || !contiguous)) {
        if (start !== null) pushWindow(windows, start, prev.t);
        start = h.t;
      } else if (!h.good && start !== null) {
        pushWindow(windows, start, prev.t);
        start = null;
      }
      prev = h;
    }
    if (start !== null && prev) pushWindow(windows, start, prev.t);
    return windows.filter((w) => w.hours >= 2).slice(0, 4);
  }

  _newsBased(items = []) {
    const cutoff = Date.now() - 30 * 86400000;
    const recent = items.filter((i) => {
      const ts = i.createdAt ? new Date(i.createdAt).getTime() : 0;
      return ts >= cutoff;
    });
    const titleOf = (i) => normalizeForCompare(i.title || '');
    const pick = (i) => ({
      id: i.id,
      title: i.title,
      summary: i.summary || '',
      imageUrl: i.imageUrl || null,
      sourceName: i.sourceName || '',
      sourceUrl: i.sourceUrl || '',
      createdAt: i.createdAt,
      category: i.category,
    });
    const local = (i) => i.category === 'Düziçi' || i.category === 'Osmaniye';
    const announcements = recent
      .filter((i) => local(i) && ANNOUNCEMENT_RE.test(titleOf(i)) && !MARKET_EXCLUDE_RE.test(titleOf(i)))
      .slice(0, 8)
      .map(pick);
    const ids = new Set(announcements.map((a) => a.id));
    const market = recent
      .filter((i) => {
        const title = titleOf(i);
        return (
          !ids.has(i.id) &&
          MARKET_CROP_RE.test(title) &&
          MARKET_TOPIC_RE.test(title) &&
          !MARKET_EXCLUDE_RE.test(title)
        );
      })
      .sort((a, b) => Number(local(b)) - Number(local(a)))
      .slice(0, 6)
      .map(pick);
    return { announcements, market };
  }

  async _build() {
    const fc = await this._fetchForecast();
    const f = fc.raw;
    const d = f.daily;
    const h = f.hourly;
    const todayStr = d.time[0];
    const days = d.time.map((date, idx) => {
      const day = {
        date,
        label: trDayLabel(date, todayStr),
        min: d.temperature_2m_min[idx],
        max: d.temperature_2m_max[idx],
        rain: d.precipitation_sum[idx] || 0,
        rainProb: d.precipitation_probability_max[idx] || 0,
        gust: d.wind_gusts_10m_max[idx] || 0,
        code: d.weather_code[idx],
        condition: weatherText(d.weather_code[idx]),
        sunrise: d.sunrise[idx],
        sunset: d.sunset[idx],
        et0: d.et0_fao_evapotranspiration[idx] || 0,
      };
      const hours = [];
      for (let i = 0; i < h.time.length; i++) {
        if (h.time[i].startsWith(date)) hours.push({ code: h.weather_code[i] });
      }
      day.risks = this._risksForDay(day, hours);
      return day;
    });

    // Aynı tür risk birden çok günde varsa tek kartta birleştir (ör. "Bugün ve Yarın").
    const grouped = new Map();
    for (const day of days.slice(0, 3)) {
      for (const r of day.risks) {
        const g = grouped.get(r.type);
        if (!g) {
          grouped.set(r.type, { ...r, date: day.date, dayLabel: day.label, labels: [day.label], rains: [[day.label, day.rain]] });
          continue;
        }
        g.labels.push(day.label);
        g.rains.push([day.label, day.rain]);
        if (r.severity === 'severe' && g.severity !== 'severe') Object.assign(g, { severity: r.severity, title: r.title, message: r.message });
      }
    }
    const alerts = [...grouped.values()]
      .map(({ labels, rains, ...g }) => {
        if (labels.length > 1) {
          g.dayLabel = labels.length === 2 ? `${labels[0]} ve ${labels[1]}` : `${labels.length} gün`;
          if (g.type === 'rain') {
            g.message = `${rains.map(([l, mm]) => `${l} ${Math.round(mm)} mm`).join(', ')} yağış bekleniyor. Hasat ve ilaçlamayı ertelemek iyi olabilir.`;
          }
        }
        return g;
      })
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'severe' ? -1 : 1));

    const nowIso = f.current.time;
    const sprayWindows = this._sprayWindows(h, nowIso.slice(0, 13) + ':00');

    // Sulama: 7 günlük buharlaşma - yağış (mm)
    const et0Sum = days.reduce((s, x) => s + x.et0, 0);
    const rainSum = days.reduce((s, x) => s + x.rain, 0);
    const deficit = Math.max(0, et0Sum - rainSum);
    const irrigation = {
      et0: Math.round(et0Sum),
      rain: Math.round(rainSum),
      deficit: Math.round(deficit),
      advice:
        deficit < 5
          ? 'Yağışlar bitkinin su ihtiyacını karşılıyor; bu hafta sulamaya gerek görünmüyor.'
          : deficit < 20
            ? 'Hafif su açığı var; hassas ürünlerde hafta içinde bir sulama yeterli olabilir.'
            : 'Belirgin su açığı var; ürününüzün durumuna göre düzenli sulama planlayın.',
    };

    const idxNow = h.time.findIndex((t) => t >= nowIso.slice(0, 13) + ':00');
    const soilTemp = idxNow >= 0 ? h.soil_temperature_6cm[idxNow] : null;

    const month = Number(todayStr.slice(5, 7));
    let newsItems = [];
    try {
      const newsService = require('./newsService');
      newsItems = newsService.cache?.items || [];
      if (!newsItems.length) newsItems = await newsService.getNews({ max: 200 });
    } catch (_) {}
    const { announcements, market } = this._newsBased(newsItems);

    return {
      location: 'Düziçi',
      fetchedAt: fc.fetchedAt,
      stale: fc.stale,
      source: 'Open-Meteo',
      current: {
        temp: f.current.temperature_2m,
        humidity: f.current.relative_humidity_2m,
        wind: f.current.wind_speed_10m,
        code: f.current.weather_code,
        condition: weatherText(f.current.weather_code),
        soilTemp,
      },
      alerts,
      days,
      sprayWindows,
      irrigation,
      calendar: { month, tasks: CALENDAR[month] || [] },
      announcements,
      market,
    };
  }

  async getData({ forceRefresh = false } = {}) {
    const fresh = this.cache.data && Date.now() - this.cache.fetchedAt < CACHE_MS;
    if (fresh && !forceRefresh) return this.cache.data;
    if (this._inflight) return this._inflight;
    this._inflight = this._build()
      .then((data) => {
        // Haber önbelleği henüz dolmadıysa (sunucu yeni açıldı) kısa süre sonra yeniden dene.
        const newsEmpty = !data.announcements.length && !data.market.length;
        this.cache = { fetchedAt: newsEmpty ? Date.now() - CACHE_MS + 2 * 60 * 1000 : Date.now(), data };
        return data;
      })
      .catch((err) => {
        console.warn('[farmer] veri alınamadı:', err.message);
        if (this.cache.data) return this.cache.data;
        throw err;
      })
      .finally(() => {
        this._inflight = null;
      });
    return this._inflight;
  }

  // ── Bildirimler ───────────────────────────────────────────────

  async _wasPushed(key) {
    try {
      const pool = getDbPool();
      if (!pool) return false;
      const res = await pool.query('SELECT 1 FROM push_logs WHERE target = $1 LIMIT 1;', [`farmer:${key}`]);
      return Boolean(res?.rows?.length);
    } catch (_) {
      return false;
    }
  }

  async _markPushed(key, title, body) {
    try {
      const pool = getDbPool();
      if (!pool) return;
      await pool.query(
        "INSERT INTO push_logs (id, title, body, target, sent_count, failed_count, created_at) VALUES (gen_random_uuid(), $1, $2, $3, 1, 0, NOW()) ON CONFLICT DO NOTHING;",
        [title, body, `farmer:${key}`],
      );
    } catch (_) {}
  }

  /**
   * Bugün ve yarın için don, dolu, fırtına ve kuvvetli yağış uyarısı gönderir.
   * Aynı risk aynı gün için bir kez gider. Gece 22:00–07:00 arası gönderilmez.
   */
  async checkAndPushAlerts() {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' })
        .format(new Date()),
    );
    if (hour >= 22 || hour < 7) return { skipped: 'quiet-hours' };

    const data = await this.getData({ forceRefresh: true });
    // Kayıtlı (eski) tahminle uyarı gönderme; yalnızca taze veriyle bildirim at.
    if (data.stale) return { skipped: 'stale-forecast' };
    const pushable = new Set(['frost', 'hail', 'storm', 'rain']);
    const sent = [];
    for (const day of data.days.slice(0, 2)) {
      for (const risk of day.risks) {
        if (!pushable.has(risk.type)) continue;
        if (risk.type === 'rain' && risk.severity !== 'severe') continue;
        if (risk.type === 'storm' && risk.severity !== 'severe') continue;
        const key = `${risk.type}:${day.date}`;
        if (await this._wasPushed(key)) continue;
        const title = `Çiftçi Uyarısı: ${risk.title} (${day.label})`;
        const body = risk.message;
        const res = await fcmService.sendToTopic(TOPIC, {
          title,
          body,
          data: { route: 'screen:farmer', type: 'farmer_alert' },
          collapseKey: `farmer_${key}`,
        });
        if (res?.success !== false) {
          await this._markPushed(key, title, body);
          sent.push(key);
          console.info(`[farmer] uyarı gönderildi: ${key}`);
        }
      }
    }
    return { sent };
  }
}

function addHours(iso, n) {
  const d = new Date(`${iso}:00Z`);
  d.setUTCHours(d.getUTCHours() + n);
  return d.toISOString().slice(0, 16);
}

function pushWindow(list, startIso, endIso) {
  const endPlusOne = addHours(endIso, 1);
  const hours = Math.round((new Date(`${endPlusOne}:00Z`) - new Date(`${startIso}:00Z`)) / 3600000);
  list.push({ start: startIso, end: endPlusOne, hours });
}

module.exports = new FarmerService();
