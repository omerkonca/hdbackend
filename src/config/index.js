const path = require('path');

const config = {
  PORT: Number(process.env.PORT || 5050),
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '123456',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://duehxbdlpwvbpqfjyjai.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'sb_publishable_k-EcjTqZe_4kmwWLIEJX3Q_3cHt_szO',
  
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET
  },

  PATHS: {
    CITY_CONTENT: path.resolve(__dirname, '../../data/city_content.json'),
    PUBLIC_DIR: path.resolve(__dirname, '../../public'),
    BACKUPS_DIR: path.resolve(__dirname, '../../backups'),
  },

  PHARMACY: {
    URL: 'https://www.eczaneler.gen.tr/nobetci-osmaniye-duzici',
    CACHE_TTL_MS: 1000 * 60 * 30, // 30 mins
  },

  NEWS: {
    CACHE_TTL_MS: 1000 * 60 * 10, // 10 mins
    SOURCES: [
      { url: 'https://www.sabirgazetesi.com/rss/duzici', name: 'Sabir Gazetesi Düziçi', scope: 'duzici', filterDuzici: true },
      { url: 'https://www.sabirgazetesi.com/rss', name: 'Sabir Gazetesi', scope: 'osmaniye' },
      { url: 'https://www.hasretgazetesi.com.tr/rss/duzici', name: 'Hasret Gazetesi Düziçi', scope: 'duzici', filterDuzici: true },
      { url: 'https://www.hasretgazetesi.com.tr/rss', name: 'Hasret Gazetesi', scope: 'osmaniye' },
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
    CACHE_TTL_MS: 1000 * 60 * 15, // 15 mins
  }
};

module.exports = config;
