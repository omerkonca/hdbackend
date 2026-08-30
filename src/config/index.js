const crypto = require('crypto');
const path = require('path');

function resolveAdminToken() {
  const token = (process.env.ADMIN_TOKEN || '').trim();
  if (token.length >= 24) {
    return token;
  }

  const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  if (isProd && token) {
    console.warn('[config] ADMIN_TOKEN zayıf (en az 24 karakter önerilir).');
  }
  if (token) {
    return token;
  }

  if (isProd) {
    console.error('[config] ADMIN_TOKEN tanımlı değil — admin girişi çalışmaz.');
    return '';
  }

  const devToken = `dev_${crypto.randomBytes(16).toString('hex')}`;
  console.warn('[config] Geliştirme modu: geçici ADMIN_TOKEN üretildi (yeniden başlatınca değişir).');
  return devToken;
}

const config = {
  PORT: Number(process.env.PORT || 5050),
  ADMIN_TOKEN: resolveAdminToken(),
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://duehxbdlpwvbpqfjyjai.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'sb_publishable_k-EcjTqZe_4kmwWLIEJX3Q_3cHt_szO',
  
  // Cloudinary yalnızca USE_CLOUDINARY=true iken kullanılır; aksi halde Supabase Storage.
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET
  },

  PATHS: {
    CITY_CONTENT: path.resolve(__dirname, '../../data/city_content.json'),
    APP_VERSION: path.resolve(__dirname, '../../data/app_version.json'),
    PUBLIC_DIR: path.resolve(__dirname, '../../public'),
    BACKUPS_DIR: path.resolve(__dirname, '../../backups'),
  },

  PHARMACY: {
    URL: 'https://www.eczaneler.gen.tr/nobetci-osmaniye-duzici',
    CACHE_TTL_MS: 1000 * 60 * 30, // 30 mins
  },

  NEWS: {
    CACHE_TTL_MS: 1000 * 60 * 10, // 10 mins
    // Bildirim yalnızca bu süre içinde yayınlanmış haberler için gönderilir.
    PUSH_MAX_AGE_HOURS: Number(process.env.NEWS_PUSH_MAX_AGE_HOURS || 36),
    SOURCES: [
      { url: 'https://www.sabirgazetesi.com/rss/duzici', name: 'Sabır Gazetesi Düziçi', scope: 'duzici', filterDuzici: false },
      { url: 'https://www.sabirgazetesi.com/rss', name: 'Sabır Gazetesi', scope: 'osmaniye' },
      { url: 'https://www.akdenizgazetesi.com/rss/duzici', name: 'Akdeniz Gazetesi Düziçi', scope: 'duzici', filterDuzici: false },
      { url: 'https://www.akdenizgazetesi.com/rss', name: 'Akdeniz Gazetesi', scope: 'osmaniye' },
      {
        url: 'https://news.google.com/rss/search?q=D%C3%BCzi%C3%A7i%20when%3A30d&hl=tr&gl=TR&ceid=TR:tr',
        name: 'Google News Düziçi',
        scope: 'duzici',
        filterDuzici: true,
      },
      {
        url: 'https://news.google.com/rss/search?q=Osmaniye%20when%3A30d&hl=tr&gl=TR&ceid=TR:tr',
        name: 'Google News Osmaniye',
        scope: 'osmaniye',
      },
    ],
  },

  TR_MONTHS: [
    'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
    'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'
  ],

  WEATHER: {
    API_URL: 'https://api.open-meteo.com/v1/forecast',
    LAT: 37.24,
    LON: 36.45,
    // Canlı sıcaklık takibi için en fazla 30 dakikada bir yenilenir
    CACHE_TTL_MS: 1000 * 60 * 30, // 30 mins
  },

  DAILY_BRIEFING: {
    SCHEDULE_HOUR_TR: Number(process.env.DAILY_BRIEFING_HOUR_TR || 19),
    CHECK_INTERVAL_MS: 15 * 60 * 1000,
  },

  AI_NEWS: {
    BEAUTIFY_SCRAPED: process.env.AI_BEAUTIFY_SCRAPED_NEWS === 'true',
    REPORTER_ENABLED: process.env.AI_REPORTER_ENABLED !== 'false',
    REPORTER_HOUR_TR: Number(process.env.AI_REPORTER_HOUR_TR || 20), // Runs at 20:00 TR
  },

  // Render ücretsiz planda instance saati = sunucunun ayakta kalma süresi (kullanıcı sayısından bağımsız).
  // Sık arka plan taraması sunucuyu uyutmaz → kota hızla biter.
  RUNTIME: {
    IS_RENDER: process.env.RENDER === 'true',
    LIGHT_BACKGROUND_JOBS:
      process.env.BACKGROUND_JOBS === 'light' ||
      process.env.BACKGROUND_JOBS === 'off' ||
      process.env.RENDER === 'true',
    SKIP_STARTUP_WARMUP:
      process.env.SKIP_STARTUP_WARMUP === '1' || process.env.RENDER === 'true',
  },

  INTERVALS: {
    pharmacyMs: 6 * 60 * 60 * 1000,
    newsMs: 30 * 60 * 1000,
    eventsMs: 30 * 60 * 1000,
    roadClosuresMs: 60 * 60 * 1000,
    obituariesMs: 2 * 60 * 60 * 1000,
    weatherMs: 60 * 60 * 1000, // saatte bir kontrol; asıl yenileme sabah 08:00'de bir kez
    outagesMs: 60 * 60 * 1000,
    dailyBriefingMs: 15 * 60 * 1000,
  },
};

module.exports = config;
