const path = require('path');

const config = {
  PORT: Number(process.env.PORT || 5050),
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '123456',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/hepsiduzici',
  
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
      { url: 'https://www.sabirgazetesi.com/rss/duzici', name: 'Sabir Gazetesi', filterDuzici: false },
      { url: 'https://www.hasretgazetesi.com.tr/rss', name: 'Hasret Gazetesi', filterDuzici: false },
      {
        url: 'https://news.google.com/rss/search?q=D%C3%BCzi%C3%A7i%20when%3A30d&hl=tr&gl=TR&ceid=TR:tr',
        name: 'Google News',
        filterDuzici: false,
      },
      {
        url: 'https://news.google.com/rss/search?q=Osmaniye%20when%3A30d&hl=tr&gl=TR&ceid=TR:tr',
        name: 'Google News Osmaniye',
        filterDuzici: false,
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
