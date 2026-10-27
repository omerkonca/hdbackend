require('dotenv').config();
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Beklenmeyen hata / asenkron çökme koruması
process.on('uncaughtException', (err) => {
  console.error('⚠️ [UncaughtException] Güvenli yakalandı (sunucu ayakta tutuldu):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ [UnhandledRejection] Güvenli yakalandı (sunucu ayakta tutuldu):', reason?.message || reason);
});
const express = require('express');
const cors = require('cors');
const compression = require('compression');
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
const aiReporterService = require('./services/aiReporterService');
const { ensureCitizenReportsTable, ensurePopupAnnouncementsTable, ensureRlsSecurityOnAllTables } = require('./utils/runMigrations');
const emailService = require('./services/emailService');

const app = express();

// Database connection check
console.log('✅ Supabase initialized: URL =', config.SUPABASE_URL);

// Middlewares - Gzip/Brotli sıkıştırmasıyla bant genişliği tüketimini %85-90 azalt
app.use(compression({
  threshold: 256,
  level: 6,
}));
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Yasal / admin sayfaları (static'ten önce — Play Store URL'leri korunur)
app.get(['/gizlilik-politikasi', '/gizlilik-politikasi.html', '/privacy-policy'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'gizlilik-politikasi.html'));
});
app.get(['/iletisim', '/iletisim.html', '/contact'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'iletisim.html'));
});
app.get(['/kullanim-kosullari', '/kullanim-kosullari.html', '/terms'], (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'kullanim-kosullari.html'));
});
app.get(['/admin', '/admin.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'admin.html'));
});
app.get(['/studio', '/studio.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(config.PATHS.PUBLIC_DIR, 'studio.html'));
});

// Statik Dosyalar (Bant Genişliği Koruma: Görseller ve Fontlar 30 Gün Önbelleklenir)
app.use(express.static(config.PATHS.PUBLIC_DIR, {
  maxAge: '14d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=600');
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|ttf|mp4|webm)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (filePath.match(/\.(css|js)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
}));

// Genel Bant Genişliği & API Önbellekleme Middleware'i
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') {
    const p = req.path;
    // Admin, Studio ve anlık canlı kontrol rotaları önbelleklenmez
    if (p.startsWith('/admin') || p.startsWith('/studio') || p.includes('felt')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else if (p.includes('prayers')) {
      res.setHeader('Cache-Control', 'public, max-age=21600, stale-while-revalidate=86400'); // 6 saat
    } else if (p.includes('pharmacies') || p.includes('finance') || p.includes('fuel')) {
      res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600'); // 30 dk
    } else if (p.includes('events') || p.includes('daily-briefing') || p.includes('obituaries')) {
      res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600'); // 30 dk
    } else if (p.includes('weather') || p.includes('outages') || p.includes('road-closures') || p.includes('instagram')) {
      res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=1800'); // 15 dk
    } else if (p.includes('news')) {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600'); // 5 dk
    } else if (p.includes('earthquakes')) {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120'); // 1 dk
    } else if (p.includes('app-version')) {
      res.setHeader('Cache-Control', 'public, max-age=43200, stale-while-revalidate=86400'); // 12 saat
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
  next();
});
// Akşam AI Muhabir & Gündem Yapay Zeka bülteni uyandırma kancası (Render uyku modu sonrasında ilk kullanıcı isteğinde tetikle)
let lastOnDemandReporterCheck = 0;
app.use('/api', (req, res, next) => {
  const now = Date.now();
  if (now - lastOnDemandReporterCheck > 5 * 60 * 1000) {
    lastOnDemandReporterCheck = now;
    setImmediate(() => {
      const aiReporterService = require('./services/aiReporterService');
      const dailyBriefingService = require('./services/dailyBriefingService');
      aiReporterService.generateIfDue().catch(() => {});
      dailyBriefingService.generateIfDue().catch(() => {});
    });
  }
  next();
});

// Routes
app.use('/api', apiRoutes);
app.use('/api/studio', require('./routes/studioRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/push', require('./routes/push'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/popups', require('./routes/popupRoutes'));
app.use('/api/earthquakes', require('./routes/earthquakeRoutes'));
app.use('/api/radiation', require('./routes/radiationRoutes'));
app.use('/api/app-version', require('./routes/appVersionRoutes'));

// Health check & AI diagnostics
app.get('/health', async (req, res) => {
  let ai = null;
  try {
    const pkg = require('../package.json');
    const aiClient = require('./services/aiClient');
    ai = {
      geminiEnv: process.env.GEMINI_MODEL || null,
      geminiCandidates: aiClient.getGeminiModelCandidates(),
      isConfigured: aiClient.isConfigured(),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      lastGeminiError: aiClient.getLastError(),
    };

    // Light ping test if explicitly requested with admin token or dev
    if (req.query.testAi === '1') {
      try {
        const testRes = await aiClient.generateJson({
          systemPrompt: 'Yanıtın yalnızca geçerli bir JSON objesi olsun: {"status":"ok"}',
          userPrompt: 'Test ping',
        });
        ai.testResult = testRes;
      } catch (err) {
        ai.testError = err.message;
        ai.lastGeminiError = aiClient.getLastError();
      }
    }

    return res.json({
      ok: true,
      service: 'hepsi-duzici-city-content-api',
      version: pkg.version,
      ai,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.json({ ok: true, service: 'hepsi-duzici-city-content-api', error: err.message, timestamp: new Date().toISOString() });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(err.status || 500).json({ ok: false, message: err.message || 'Sunucu hatası oluştu.' });
});

// Start Server
const server = app.listen(config.PORT, '0.0.0.0', () => {
  const pkg = require('../package.json');
  console.log(`\n🚀 [city-content-api] v${pkg.version} running on http://localhost:${config.PORT}`);
  try {
    const aiClient = require('./services/aiClient');
    const geminiEnv = process.env.GEMINI_MODEL || '(unset)';
    console.log(`🤖 [ai] Gemini env=${geminiEnv} → candidates: ${aiClient.getGeminiModelCandidates().join(', ')}`);
  } catch (_) {}
  const tokenOk = config.ADMIN_TOKEN && config.ADMIN_TOKEN.length >= 24;
  console.log(`🔑 [city-content-api] admin token: ${tokenOk ? 'yapılandırıldı' : 'eksik/zayıf'}`);
  console.log(`🛠️  [city-content-api] admin panel: http://localhost:${config.PORT}/admin\n`);

  ensureCitizenReportsTable().catch(() => {});
  ensurePopupAnnouncementsTable().catch(() => {});
  ensureRlsSecurityOnAllTables().catch(() => {});

  try {
    const { startEarthquakeCron } = require('./services/earthquakeCronService');
    startEarthquakeCron();
  } catch (eqErr) {
    console.warn('[earthquakeCron] Cron başlatılamadı:', eqErr.message);
  }

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

  const runAiReporterJob = () => {
    aiReporterService.generateIfDue().catch((err) => {
      console.warn('[ai-reporter] job failed:', err.message);
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
    // Gün sonu özeti için saatte bir kontrol yeterli (günde tek AI çağrısı, 19:00 TR)
    setInterval(runDailyBriefingJob, 60 * 60 * 1000);
    // Şehir muhabiri: 20 dk'da bir kontrol (20:00 penceresini kaçırmamak için)
    setInterval(runAiReporterJob, 20 * 60 * 1000);
    // Sunucu uyanır uyanmaz bir kez dene
    setTimeout(runAiReporterJob, 45 * 1000);
    // Eski haber temizliği (14 günden eski haberler günde bir temizlenir)
    setTimeout(() => newsService.pruneOldNews({ retentionDays: 14 }).catch(() => {}), 60 * 1000);
    setInterval(() => newsService.pruneOldNews({ retentionDays: 14 }).catch(() => {}), 12 * 60 * 60 * 1000);
    // Kapalı yollar: bayat KGM/belediye kayıtları için seyrek sync (kota dostu)
    setInterval(() => {
      roadClosureService.sync({ force: true }).catch(() => {});
    }, 45 * 60 * 1000);
    setTimeout(() => {
      roadClosureService.sync({ force: true }).catch(() => {});
    }, 90 * 1000);
  } else {
    setTimeout(() => newsService.pruneOldNews({ retentionDays: 14 }).catch(() => {}), 60 * 1000);
    setInterval(() => newsService.pruneOldNews({ retentionDays: 14 }).catch(() => {}), 12 * 60 * 60 * 1000);

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
    setInterval(runAiReporterJob, 15 * 60 * 1000); // Check every 15 minutes, same as daily briefing check interval
  }
});
