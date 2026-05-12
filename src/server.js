require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const config = require('./config');
const apiRoutes = require('./routes/api');
const pharmacyService = require('./services/pharmacyService');
const newsService = require('./services/newsService');
const eventService = require('./services/eventService');

const app = express();

// Database Connection
mongoose.connect(config.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Middlewares
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.static(config.PATHS.PUBLIC_DIR));

// Routes
app.use('/api', apiRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'hepsi-duzici-city-content-api', timestamp: new Date().toISOString() });
});

// Admin Panel redirect
app.get('/admin', (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'index.html'));
});

// Start Server
app.listen(config.PORT, () => {
  console.log(`\n🚀 [city-content-api] running on http://localhost:${config.PORT}`);
  console.log(`🔑 [city-content-api] admin token: ${config.ADMIN_TOKEN}`);
  console.log(`🛠️  [city-content-api] admin panel: http://localhost:${config.PORT}/admin\n`);

  // Initial Cache Warmup
  pharmacyService.getDutyPharmacies({ forceRefresh: true })
    .then(items => console.log(`[pharmacy] cache ready (${items.length} items)`))
    .catch(err => console.warn('[pharmacy] initial fetch failed:', err.message));

  newsService.getNews({ forceRefresh: true, max: 20 })
    .then(items => console.log(`[news] cache ready (${items.length} items)`))
    .catch(err => console.warn('[news] initial fetch failed:', err.message));

  console.log('[server] warming up events cache...');
  eventService.getEvents({ forceRefresh: true })
    .then(items => console.log(`[events] cache ready (${items.length} items)`))
    .catch(err => console.warn('[events] initial fetch failed:', err.message));

  // Periodic Refresh
  setInterval(() => {
    pharmacyService.getDutyPharmacies({ forceRefresh: true }).catch(() => {});
  }, config.PHARMACY.CACHE_TTL_MS);

  setInterval(() => {
    newsService.getNews({ forceRefresh: true, max: 20 }).catch(() => {});
  }, config.NEWS.CACHE_TTL_MS);

  setInterval(() => {
    eventService.getEvents({ forceRefresh: true }).catch(() => {});
  }, 60 * 60 * 1000); // 1 hour
});
