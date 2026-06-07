require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const supabase = require('./utils/supabaseClient');
const apiRoutes = require('./routes/api');
const pharmacyService = require('./services/pharmacyService');
const newsService = require('./services/newsService');
const eventService = require('./services/eventService');
const roadClosureService = require('./services/roadClosureService');
const obituaryService = require('./services/obituaryService');

const app = express();

// Database connection check
console.log('✅ Supabase initialized: URL =', config.SUPABASE_URL);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static(config.PATHS.PUBLIC_DIR));
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// Routes
app.use('/api', apiRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'hepsi-duzici-city-content-api', timestamp: new Date().toISOString() });
});

// Gizlilik politikasi (Google Play Store)
app.get(['/gizlilik-politikasi', '/gizlilik-politikasi.html', '/privacy-policy'], (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'gizlilik-politikasi.html'));
});

// Yayıncı iletisim (Google Play Store - Haber uygulamalari beyani)
app.get(['/iletisim', '/iletisim.html', '/contact'], (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'iletisim.html'));
});

// Admin Panel redirect
app.get('/admin', (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(err.status || 500).json({ ok: false, message: err.message || 'Sunucu hatası oluştu.' });
});

// Start Server
const server = app.listen(config.PORT, () => {
  console.log(`\n🚀 [city-content-api] running on http://localhost:${config.PORT}`);
  console.log(`🔑 [city-content-api] admin token: ${config.ADMIN_TOKEN}`);
  console.log(`🛠️  [city-content-api] admin panel: http://localhost:${config.PORT}/admin\n`);

  // Server timeout configuration (10 minutes) for large uploads
  server.timeout = 600000;
  server.headersTimeout = 605000;
  server.keepAliveTimeout = 600000;

  // Initial Cache Warmup
  pharmacyService.getDutyPharmacies({ forceRefresh: true })
    .then(items => console.log(`[pharmacy] cache ready (${items.length} items)`))
    .catch(err => console.warn('[pharmacy] initial fetch failed:', err.message));

  newsService.getNews({ forceRefresh: true, max: 150 })
    .then(items => console.log(`[news] cache ready (${items.length} items)`))
    .catch(err => console.warn('[news] initial fetch failed:', err.message));

  console.log('[server] warming up events cache...');
  eventService.getEvents({ forceRefresh: true })
    .then(items => console.log(`[events] cache ready (${items.length} items)`))
    .catch(err => console.warn('[events] initial fetch failed:', err.message));

  roadClosureService.sync({ force: true })
    .then(items => console.log(`[road-closures] otomatik sync hazır (${items.length} kayıt)`))
    .catch(err => console.warn('[road-closures] ilk sync başarısız:', err.message));

  obituaryService.getObituaries({ forceRefresh: true })
    .then(items => console.log(`[obituaries] cache ready (${items.length} items)`))
    .catch(err => console.warn('[obituaries] initial fetch failed:', err.message));

  // Periodic Refresh
  setInterval(() => {
    pharmacyService.getDutyPharmacies({ forceRefresh: true }).catch(() => {});
  }, config.PHARMACY.CACHE_TTL_MS);

  setInterval(() => {
    newsService.getNews({ forceRefresh: true, max: 150 }).catch(() => {});
  }, config.NEWS.CACHE_TTL_MS);

  setInterval(() => {
    eventService.getEvents({ forceRefresh: true }).catch(() => {});
  }, 60 * 60 * 1000); // 1 hour

  setInterval(() => {
    roadClosureService.sync({ force: true }).catch(() => {});
  }, 8 * 60 * 1000); // 8 dk — belediye + haber taraması

  setInterval(() => {
    obituaryService.getObituaries({ forceRefresh: true }).catch(() => {});
  }, 30 * 60 * 1000); // 30 dk
});
