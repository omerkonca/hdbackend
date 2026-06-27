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
const weatherService = require('./services/weatherService');
const dailyBriefingService = require('./services/dailyBriefingService');
const outageService = require('./services/outageService');
const { ensureCitizenReportsTable } = require('./utils/runMigrations');
const emailService = require('./services/emailService');

const app = express();

// Database connection check
console.log('✅ Supabase initialized: URL =', config.SUPABASE_URL);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Yasal / admin sayfaları (static'ten önce — Play Store URL'leri korunur)
app.get(['/gizlilik-politikasi', '/gizlilik-politikasi.html', '/privacy-policy'], (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'gizlilik-politikasi.html'));
});
app.get(['/iletisim', '/iletisim.html', '/contact'], (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'iletisim.html'));
});
app.get(['/kullanim-kosullari', '/kullanim-kosullari.html', '/terms'], (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'kullanim-kosullari.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'admin.html'));
});

app.use(express.static(config.PATHS.PUBLIC_DIR));
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// Routes
app.use('/api', apiRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/push', require('./routes/push'));
app.use('/api/announcements', require('./routes/announcements'));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'hepsi-duzici-city-content-api', timestamp: new Date().toISOString() });
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

  ensureCitizenReportsTable().catch(() => {});

  const emailStatus = emailService.getEmailStatus();
  if (emailStatus.gmailWebhookConfigured) {
    console.log(`[email] Gmail Apps Script hazır → ${emailStatus.notifyEmail}`);
  } else if (emailStatus.brevoConfigured) {
    console.log(`[email] Brevo hazır → ${emailStatus.notifyEmail}`);
  } else if (emailStatus.resendConfigured) {
    console.log(`[email] Resend hazır → ${emailStatus.notifyEmail}`);
  } else if (emailStatus.smtpConfigured) {
    console.warn(`[email] SMTP ayarlı (Render ücretsizde çalışmayabilir)`);
  } else {
    console.warn('[email] E-posta yapılandırılmamış — GMAIL_WEBHOOK_URL ekleyin.');
  }

  // Server timeout configuration (10 minutes) for large uploads
  server.timeout = 600000;
  server.headersTimeout = 605000;
  server.keepAliveTimeout = 600000;

  // Initial Cache Warmup (Render ücretsizde atlanır — ilk istekte cache dolar, sunucu uyuyabilir)
  if (!config.RUNTIME.SKIP_STARTUP_WARMUP) {
    pharmacyService.getDutyPharmacies({ forceRefresh: true })
      .then(items => console.log(`[pharmacy] cache ready (${items.length} items)`))
      .catch(err => console.warn('[pharmacy] initial fetch failed:', err.message));

    newsService.getNews({ forceRefresh: true, max: 150 })
      .then((items) => console.log(`[news] cache ready (${items.length} items)`))
      .catch((err) => console.warn('[news] initial fetch failed:', err.message));

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

    console.log('[server] warming up weather cache...');
    weatherService.getWeather()
      .then(data => console.log(`[weather] cache ready (temp: ${data.current?.temp}°C)`))
      .catch(err => console.warn('[weather] initial fetch failed:', err.message));
  } else {
    console.log('[server] Render/light mod — başlangıç warmup atlandı (kota tasarrufu)');
  }

  const runDailyBriefingJob = () => {
    dailyBriefingService.generateIfDue().catch((err) => {
      console.warn('[daily-briefing] job failed:', err.message);
    });
  };

  const intervals = config.RUNTIME.LIGHT_BACKGROUND_JOBS
    ? config.INTERVALS
    : {
        pharmacyMs: config.PHARMACY.CACHE_TTL_MS,
        newsMs: config.NEWS.CACHE_TTL_MS,
        eventsMs: 60 * 60 * 1000,
        roadClosuresMs: 8 * 60 * 1000,
        obituariesMs: 30 * 60 * 1000,
        weatherMs: config.WEATHER.CACHE_TTL_MS,
        outagesMs: 30 * 60 * 1000,
        dailyBriefingMs: config.DAILY_BRIEFING.CHECK_INTERVAL_MS,
      };

  if (config.RUNTIME.LIGHT_BACKGROUND_JOBS) {
    console.log('[server] hafif arka plan modu — periyodik tarama yok, cache API isteğinde yenilenir');
    // Akşam özeti için saatte bir kontrol yeterli (günde tek AI çağrısı)
    setInterval(runDailyBriefingJob, 60 * 60 * 1000);
  } else {
    setInterval(() => {
      pharmacyService.getDutyPharmacies({ forceRefresh: true }).catch(() => {});
    }, intervals.pharmacyMs);

    setInterval(() => {
      newsService.getNews({ forceRefresh: true, max: 150 }).catch(() => {});
    }, intervals.newsMs);

    setInterval(() => {
      eventService.getEvents({ forceRefresh: true }).catch(() => {});
    }, intervals.eventsMs);

    setInterval(() => {
      roadClosureService.sync({ force: true }).catch(() => {});
    }, intervals.roadClosuresMs);

    setInterval(() => {
      obituaryService.getObituaries({ forceRefresh: true }).catch(() => {});
    }, intervals.obituariesMs);

    setInterval(() => {
      weatherService.getWeather().catch(() => {});
    }, intervals.weatherMs);

    setInterval(() => {
      outageService.getOutages({ forceRefresh: true }).catch(() => {});
    }, intervals.outagesMs);

    setInterval(runDailyBriefingJob, intervals.dailyBriefingMs);
  }
});
