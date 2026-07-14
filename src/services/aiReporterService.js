const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
const weatherService = require('./weatherService');
const outageService = require('./outageService');
const roadClosureService = require('./roadClosureSyncService');
const obituaryService = require('./obituaryService');
const newsService = require('./newsService');
const aiClient = require('./aiClient');
const crypto = require('crypto');

const TZ = 'Europe/Istanbul';

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

class AiReporterService {
  constructor() {
    this._generating = false;
  }

  async generateDailyReport({ force = false } = {}) {
    const tr = turkeyDateParts();
    const targetDate = tr.date;

    const db = requireSupabaseAdmin();
    
    // Check if we already generated an AI Reporter article for today
    if (!force) {
      const todayHash = crypto.createHash('md5').update(`ai-reporter-${targetDate}`).digest('hex');
      const todayId = `news-ai-reporter-${todayHash}`;
      const { data: existing } = await db
        .from('news_items')
        .select('id')
        .eq('id', todayId)
        .maybeSingle();
      if (existing) {
        console.log(`[ai-reporter] Daily report for ${targetDate} already exists. Skipping.`);
        return null;
      }
    }

    if (!aiClient.isConfigured()) {
      throw new Error('AI client is not configured.');
    }

    console.log(`[ai-reporter] Collecting data for daily city report on ${targetDate}...`);

    // 1. Fetch weather
    let weatherText = '';
    try {
      const weather = await weatherService.getWeather();
      if (weather && weather.current) {
        weatherText = `Bugünün Sıcaklığı: ${weather.current.temp}°C, Hissedilen: ${weather.current.feelsLike}°C, Durum: ${weather.current.condition.text}. Nem: %${weather.current.humidity}.\n3 Günlük Tahmin:\n${(weather.forecast || []).map(f => `- ${f.date}: En yüksek ${f.maxTemp}°C, En düşük ${f.minTemp}°C, ${f.condition.text}`).join('\n')}`;
      }
    } catch (err) {
      console.warn('[ai-reporter] Weather fetch failed:', err.message);
    }

    // 2. Fetch outages
    let outagesText = '';
    try {
      const outages = await outageService.getOutages();
      const active = outages.filter(o => o.isActive !== false && o.status !== 'Tamamlandı').slice(0, 10);
      if (active.length > 0) {
        outagesText = active.map(o => `- [${o.type}] ${o.area ? `${o.area}: ` : ''}${o.title}`).join('\n');
      } else {
        outagesText = 'Bugün planlı bir elektrik veya su kesintisi bulunmuyor.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Outages fetch failed:', err.message);
    }

    // 3. Fetch road closures
    let closuresText = '';
    try {
      const closures = await roadClosureService.getRoadClosures();
      const active = closures.filter(c => (c.status || '').toLowerCase().includes('devam') || (c.status || '').toLowerCase().includes('aktif')).slice(0, 10);
      if (active.length > 0) {
        closuresText = active.map(c => `- ${c.title} (${c.subtitle || ''}) - Durum: ${c.status || 'Aktif'}`).join('\n');
      } else {
        closuresText = 'Aktif bir yol kapama veya yol çalışması kaydı bulunmuyor.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Closures fetch failed:', err.message);
    }

    // 4. Fetch obituaries (vefatlar)
    let obituariesText = '';
    try {
      const obituaries = await obituaryService.getObituaries();
      // Filter obituaries for today/yesterday (last 24-48 hours)
      const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const recent = obituaries.filter(o => new Date(o.deathDate).getTime() >= cutoff).slice(0, 10);
      if (recent.length > 0) {
        obituariesText = recent.map(o => `- ${o.fullName} (Vefat Tarihi: ${o.deathDate ? o.deathDate.slice(0, 10) : ''}) - Taziye Yeri: ${o.condolenceAddress || 'Belirtilmemiş'}`).join('\n');
      } else {
        obituariesText = 'Son günlerde kaydedilmiş yeni vefat ilanı bulunmuyor.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Obituaries fetch failed:', err.message);
    }

    // 5. Fetch municipal announcements/recent news from DB
    let announcementsText = '';
    try {
      const news = await newsService.getNews({ max: 50 });
      // Filter for Düziçi and from municipality sources
      const localNews = news.filter(n => n.category.toLowerCase().includes('düziçi') || n.category.toLowerCase().includes('duzici')).slice(0, 15);
      if (localNews.length > 0) {
        announcementsText = localNews.map(n => `- [${n.sourceName || 'Kaynak'}] ${n.title}: ${n.summary || ''}`).join('\n');
      } else {
        announcementsText = 'Son günlere ait önemli yerel haber kaydı bulunamadı.';
      }
    } catch (err) {
      console.warn('[ai-reporter] Announcements fetch failed:', err.message);
    }

    // AI client compilation
    const systemPrompt =
      'Sen Düziçi ve Osmaniye bölgesinde yayın yapan son derece profesyonel, objektif ve güvenilir bir Yapay Zeka Şehir Muhabirisin. ' +
      'Görevin; hava durumu, kesintiler, yol çalışmaları, vefatlar ve yerel gelişmelerden oluşan verileri harmanlayarak Düziçi halkı için bilgilendirici, samimi ve okunası bir günlük şehir bülteni/raporu yazmaktır. ' +
      'Metni çok resmi veya aşırı robotik yapma; yerel bir gazetecinin kaleminden çıkmış gibi doğal, akıcı ve bilgilendirici olsun. ' +
      'Yanıtını sadece belirtilen JSON formatında vermelisin.';

    const userPrompt =
      `Tarih: ${targetDate}\n` +
      `Konum: Düziçi, Osmaniye\n\n` +
      `HAVA DURUMU BİLGİLERİ:\n${weatherText || 'Veri yok'}\n\n` +
      `PLANLI ELEKTRİK / SU KESİNTİLERİ:\n${outagesText || 'Veri yok'}\n\n` +
      `YOL KAPAMA / ÇALIŞMALARI:\n${closuresText || 'Veri yok'}\n\n` +
      `VEFAT İLANLARI (SON 48 SAAT):\n${obituariesText || 'Veri yok'}\n\n` +
      `SON YEREL GELİŞMELER & DUYURULAR:\n${announcementsText || 'Veri yok'}\n\n` +
      `GÖREV TALİMATLARI:\n` +
      `1. title: Şehir raporunu temsil eden, tarih içeren ilgi çekici bir gazete haberi başlığı yaz (max 120 karakter) (Örn: "Düziçi'nde Bugün: Hava Durumu, Kesintiler ve Son Gelişmeler Raporu (${targetDate})").\n` +
      `2. summary: Günün önemli gelişmelerini, kesintileri ve vefatları çok kısa bir şekilde özetleyen 2-3 cümlelik bir giriş/spot yaz (max 250 karakter).\n` +
      `3. fullText: Yukarıdaki tüm başlıkları (Hava durumu, Altyapı/Kesintiler, Yol durumu, Şehir haberleri ve Taziyeler) içerecek şekilde, okunması keyifli 4-5 paragraflık kapsamlı bir haber yazısı yaz. Paragraflar arasında satır boşluğu olsun. Markdown veya HTML biçimlendirme öğeleri kullanma.\n\n` +
      `JSON FORMATI:\n` +
      `{\n` +
      `  "title": "...",\n` +
      `  "summary": "...",\n` +
      `  "fullText": "..."\n` +
      `}`;

    const { data, model } = await aiClient.generateJson({ systemPrompt, userPrompt });

    const hash = crypto.createHash('md5').update(`ai-reporter-${targetDate}`).digest('hex');
    const newsId = `news-ai-reporter-${hash}`;

    const newArticle = {
      id: newsId,
      title: String(data.title || `Düziçi Şehir Raporu - ${targetDate}`).slice(0, 120),
      summary: String(data.summary || '').trim(),
      full_text: String(data.fullText || '').trim(),
      image_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80', // Default local news image
      created_at: new Date().toISOString(),
      source_url: `https://forvibe.app/duzici-ai-reporter/${targetDate}`,
      source_name: 'Yapay Zeka Muhabiri',
      category: 'Düziçi',
      is_ai_generated: true,
      is_ai_optimized: false,
      fetched_at: new Date().toISOString()
    };

    // Save to news_items
    const { data: saved, error } = await db
      .from('news_items')
      .upsert(newArticle)
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    console.log(`[ai-reporter] Daily city news compiled & published successfully: "${newArticle.title}" (Model: ${model})`);

    // Trigger FCM notification
    try {
      const fcmService = require('./fcmService');
      if (fcmService.isFcmConfigured()) {
        const pushTitle = "Günlük Şehir Raporu Yayınlandı 📰";
        console.log(`[ai-reporter] Sending FCM notification for AI report to topic "news_duzici"...`);
        await fcmService.sendToTopic('news_duzici', {
          title: pushTitle,
          body: newArticle.title,
          data: {
            route: String(newArticle.id),
          },
        });
      }
    } catch (fcmErr) {
      console.error('[ai-reporter] FCM notification send failed:', fcmErr.message);
    }

    return saved;
  }

  async generateIfDue() {
    const config = require('../config');
    const fileService = require('./fileService');
    let reporterEnabled = config.AI_NEWS.REPORTER_ENABLED;
    try {
      const cityContent = await fileService.readCityContent();
      if (cityContent?.aiNewsSettings?.reporterEnabled !== undefined) {
        reporterEnabled = cityContent.aiNewsSettings.reporterEnabled === true;
      }
    } catch (_) {}

    if (!reporterEnabled) return null;

    const tr = turkeyDateParts();
    if (tr.hour < config.AI_NEWS.REPORTER_HOUR_TR) return null;

    if (this._generating) return null;
    this._generating = true;

    try {
      return await this.generateDailyReport();
    } catch (err) {
      console.error('[ai-reporter] Automatic report generation failed:', err.message);
      return null;
    } finally {
      this._generating = false;
    }
  }
}

module.exports = new AiReporterService();
