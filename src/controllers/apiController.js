const crypto = require('crypto');
const fileService = require('../services/fileService');
const pharmacyService = require('../services/pharmacyService');
const newsService = require('../services/newsService');
const { truncateNewsExcerpt } = require('../utils/helpers');
const financeService = require('../services/financeService');
const fuelService = require('../services/fuelService');
const eventService = require('../services/eventService');
const outageService = require('../services/outageService');
const roadClosureService = require('../services/roadClosureService');
const weatherService = require('../services/weatherService');
const prayerService = require('../services/prayerService');
const obituaryService = require('../services/obituaryService');
const dailyBriefingService = require('../services/dailyBriefingService');
const config = require('../config');
const { enrichExploreWithCorrections } = require('../utils/mapCorrections');

class ApiController {
  async getCityContent(req, res) {
    try {
      let data = await fileService.readCityContent();
      try {
        data = enrichExploreWithCorrections(data);
      } catch (err) {
        console.error('[city-content] Failed to enrich explore places with corrections:', err.message);
      }

      const body = JSON.stringify(data);
      const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(body);
    } catch (error) {
      res.status(500).json({ ok: false, message: 'City content okunamadi.', detail: error.message });
    }
  }

  async updateCityContent(req, res) {
    try {
      const payload = req.body;
      if (!fileService.isValidCityContent(payload)) {
        return res.status(400).json({ ok: false, message: 'Gecersiz city content formati.' });
      }
      const backupPath = await fileService.createBackupBeforeWrite();
      await fileService.writeCityContent(payload);
      res.json({ ok: true, message: 'City content guncellendi.', backupPath });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'City content yazilamadi.', detail: error.message });
    }
  }

  async updateBrandingFields(req, res) {
    try {
      const { heroCardBg, exploreHeaderBg } = req.body;
      const content = await fileService.readCityContent();
      if (!content.branding) {
        content.branding = {};
      }
      if (heroCardBg !== undefined) content.branding.heroCardBg = heroCardBg;
      if (exploreHeaderBg !== undefined) content.branding.exploreHeaderBg = exploreHeaderBg;
      
      await fileService.createBackupBeforeWrite();
      await fileService.writeCityContent(content);
      
      return res.json({ ok: true, message: 'Branding guncellendi.', branding: content.branding });
    } catch (error) {
      console.error('❌ Branding guncelleme hatası:', error.message);
      res.status(500).json({ ok: false, message: 'Branding guncellenemedi.', detail: error.message });
    }
  }

  async getDutyPharmacies(req, res) {
    try {
      const forceRefresh =
        req.query.refresh === '1' ||
        req.query.refresh === 'true' ||
        req.query.force === '1';
      const pharmacies = await pharmacyService.getDutyPharmacies({ forceRefresh });
      res.json({
        ok: true,
        sourceUrl: config.PHARMACY.URL,
        fetchedAt: new Date(pharmacyService.cache.fetchedAt || Date.now()).toISOString(),
        pharmacies,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Nobetci eczane verisi alinamadi.', detail: error.message });
    }
  }

  async refreshPharmacies(req, res) {
    try {
      const pharmacies = await pharmacyService.getDutyPharmacies({ forceRefresh: true });
      res.json({ ok: true, message: 'Nobetci eczane verisi yenilendi.', pharmacies });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Nobetci eczane verisi yenilenemedi.', detail: error.message });
    }
  }

  async getNews(req, res) {
    try {
      const max = Math.min(Number(req.query.max || 20), 150);
      const forceRefresh =
        req.query.refresh === '1' ||
        req.query.refresh === 'true' ||
        req.query.force === '1';
      const items = await newsService.getNews({ max, forceRefresh });
      res.json({
        ok: true,
        fetchedAt: new Date(newsService.cache.fetchedAt).toISOString(),
        items,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Haberler alinamadi.', detail: error.message });
    }
  }

  async getNewsFullText(req, res) {
    try {
      const url = req.query.url;
      if (!url) return res.status(400).json({ ok: false, message: 'url parametresi gerekli.' });
      const skipLiveImages =
        req.query.images === '0' ||
        req.query.images === 'false' ||
        req.query.skipImages === '1';
      
      // 1. Check if cached in Supabase news_items table
      const supabase = require('../utils/supabaseClient');
      try {
        const { data, error } = await supabase
          .from('news_items')
          .select('full_text, image_url, images, video_url, verified, is_ai_generated, is_ai_optimized, source_name')
          .eq('source_url', url)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (!error && data && data.length > 0) {
          const cached = data[0];
          const hasText = cached.full_text && cached.full_text.trim().length > 0;
          const cachedImages = Array.isArray(cached.images)
            ? cached.images.filter(Boolean)
            : (cached.image_url ? [cached.image_url] : []);
          if (hasText) {
            const isOwnPublisher =
              cached.verified === true ||
              cached.source_name === 'Hepsi Düziçi' ||
              String(url || '').includes('forvibe.app');
            const body = isOwnPublisher
              ? cached.full_text
              : truncateNewsExcerpt(cached.full_text);
            if (skipLiveImages || cachedImages.length > 0 || isOwnPublisher) {
              return res.json({
                ok: true,
                fullText: body,
                imageUrl: cached.image_url || cachedImages[0] || null,
                images: cachedImages,
                videoUrl: cached.video_url || null,
                verified: cached.verified === true,
                isAiGenerated: cached.is_ai_generated === true,
                isAiOptimized: cached.is_ai_optimized === true,
                sourceName: cached.source_name || null,
              });
            }

            // Gorsel cache bos: metni hemen don, gorselleri arka planda yenile
            newsService.fetchArticleImages(url)
              .then((imageDetails) => {
                const images = imageDetails.images || [];
                const imageUrl = imageDetails.imageUrl || cached.image_url || null;
                if (images.length === 0) return;
                return supabase
                  .from('news_items')
                  .update({ images, image_url: imageUrl })
                  .eq('source_url', url);
              })
              .then(() => console.log(`[news] Images refreshed in background for: ${url}`))
              .catch((err) => console.error('[news] Background image refresh failed:', err.message));

            return res.json({
              ok: true,
              fullText: body,
              imageUrl: cached.image_url || null,
              images: cachedImages,
              videoUrl: cached.video_url || null,
              verified: cached.verified === true,
              isAiGenerated: cached.is_ai_generated === true,
              isAiOptimized: cached.is_ai_optimized === true,
              sourceName: cached.source_name || null,
            });
          }
        }
      } catch (err) {
        console.error('❌ Supabase news read failed:', err.message);
      }

      // 2. Fetch and parse on-the-fly from the source website
      const details = await newsService.fetchArticleDetails(url);
      const fullText = details.fullText;
      const imageUrl = details.imageUrl;
      const images = details.images || (imageUrl ? [imageUrl] : []);
      
      // 3. Save/Update cache in Supabase background
      if ((fullText && fullText.trim().length > 0) || (imageUrl && imageUrl.trim().length > 0)) {
        const update = {};
        if (fullText && fullText.trim().length > 0) update.full_text = fullText;
        if (imageUrl && imageUrl.trim().length > 0) update.image_url = imageUrl;
        if (images && images.length > 0) update.images = images;
        supabase
          .from('news_items')
          .update(update)
          .eq('source_url', url)
          .then(() => console.log(`[news] Full-text successfully cached in Supabase for: ${url}`))
          .catch(e => console.error('❌ Failed to cache full-text in Supabase:', e.message));
      }

      res.json({ ok: true, fullText, imageUrl: imageUrl || null, images });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Haber metni alinamadi.', detail: error.message });
    }
  }

  async refreshNews(req, res) {
    try {
      const items = await newsService.getNews({ forceRefresh: true, max: 150 });
      res.json({ ok: true, message: 'Haber cache yenilendi.', count: items.length });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Haber cache yenilenemedi.', detail: error.message });
    }
  }

  async getFinance(req, res) {
    try {
      const items = await financeService.getQuotes();
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({
        ok: true,
        fetchedAt: new Date(financeService.cache.fetchedAt).toISOString(),
        items,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Finans verisi alinamadi.', detail: error.message });
    }
  }

  async refreshFinance(req, res) {
    try {
      const items = await financeService.getQuotes({ forceRefresh: true });
      res.json({ ok: true, message: 'Finans cache yenilendi.', count: items.length });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Finans cache yenilenemedi.', detail: error.message });
    }
  }

  async getFuel(req, res) {
    try {
      const force = req.query.refresh === '1';
      const items = await fuelService.getPrices({ forceRefresh: force });
      let region = 'Osmaniye / Düziçi';
      try {
        const data = await require('../services/fileService').readCityContent();
        if (data?.fuel?.region) region = data.fuel.region;
      } catch (_) {}
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.json({
        ok: true,
        fetchedAt: new Date(fuelService.cache.fetchedAt).toISOString(),
        source: fuelService.cache.source || 'unknown',
        region,
        items,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Akaryakit verisi alinamadi.', detail: error.message });
    }
  }

  async refreshFuel(req, res) {
    try {
      const items = await fuelService.getPrices({ forceRefresh: true });
      res.json({ ok: true, message: 'Akaryakit cache yenilendi.', count: items.length });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Akaryakit cache yenilenemedi.', detail: error.message });
    }
  }

  async getBackups(req, res) {
    try {
      const backups = await fileService.listBackups();
      res.json({ ok: true, backups });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Yedek listesi okunamadi.', detail: error.message });
    }
  }

  async restoreLastBackup(req, res) {
    try {
      const supabase = require('../utils/supabaseClient');
      const { data: lastBackup, error: fetchErr } = await supabase
        .from('city_content_backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!lastBackup) {
        return res.status(404).json({ ok: false, message: 'Veritabanında geri yüklenecek yedek bulunamadı.' });
      }

      // Geri yükle (writeCityContent çağrısı öncesinde otomatik olarak mevcudun yedeğini alır)
      await fileService.writeCityContent(lastBackup.data);

      res.json({
        ok: true,
        message: `Yedek başarıyla geri yüklendi (Yedek ID: ${lastBackup.id}, Tarih: ${lastBackup.created_at})`
      });
    } catch (error) {
      console.error('❌ Geri yükleme hatası:', error.message);
      res.status(500).json({ ok: false, message: 'Geri yukleme hatasi.', detail: error.message });
    }
  }

  async getEvents(req, res) {
    try {
      const forceRefresh =
        req.query.refresh === '1' ||
        req.query.refresh === 'true' ||
        req.query.force === '1';
      const items = await eventService.getEvents({ forceRefresh });
      res.json({
        ok: true,
        fetchedAt: new Date(eventService.cache.fetchedAt || Date.now()).toISOString(),
        items,
      });
    } catch (error) {
      console.error('❌ getEvents error:', error);
      res.status(500).json({ ok: false, message: 'Etkinlikler alinamadi.', detail: error.message });
    }
  }

  async refreshEvents(req, res) {
    try {
      const items = await eventService.getEvents({ forceRefresh: true });
      res.json({
        ok: true,
        message: 'Etkinlik cache yenilendi.',
        count: items.length,
        fetchedAt: new Date(eventService.cache.fetchedAt || Date.now()).toISOString(),
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Etkinlikler yenilenemedi.', detail: error.message });
    }
  }

  async getCustomEvents(req, res) {
    try {
      const content = await fileService.readCityContent();
      const events = eventService.normalizeCustomEvents(content?.customEvents || []);
      res.json({ ok: true, events });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Etkinlikler okunamadi.', detail: error.message });
    }
  }

  async updateCustomEvents(req, res) {
    try {
      const { events } = req.body ?? {};
      if (!Array.isArray(events)) {
        return res.status(400).json({ ok: false, message: 'events dizisi gerekli.' });
      }
      const content = await fileService.readCityContent();
      content.customEvents = eventService.normalizeCustomEvents(events);
      await fileService.createBackupBeforeWrite();
      await fileService.writeCityContent(content);
      eventService.invalidateCache();
      await eventService.getEvents({ forceRefresh: true });
      res.json({
        ok: true,
        message: 'Özel etkinlikler kaydedildi.',
        count: content.customEvents.length,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Etkinlikler kaydedilemedi.', detail: error.message });
    }
  }

  async getOutages(req, res) {
    try {
      const items = await outageService.getOutages();
      const history = outageService.getHistory();
      res.json({
        ok: true,
        fetchedAt: new Date(outageService.cache.fetchedAt).toISOString(),
        items,
        history,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Kesinti verileri alinamadi.', detail: error.message });
    }
  }

  async refreshOutages(req, res) {
    try {
      const items = await outageService.getOutages({ forceRefresh: true });
      res.json({ ok: true, message: 'Kesinti cache yenilendi.', count: items.length });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Kesinti cache yenilenemedi.', detail: error.message });
    }
  }

  async getRoadClosures(req, res) {
    try {
      const force = req.query.refresh === '1';
      const items = await roadClosureService.getRoadClosures({ forceRefresh: force });
      res.json({
        ok: true,
        fetchedAt: new Date(roadClosureService.cache.fetchedAt || Date.now()).toISOString(),
        items,
        autoSync: true,
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Kapalı yol verileri alinamadi.', detail: error.message });
    }
  }

  async refreshRoadClosures(req, res) {
    try {
      const items = await roadClosureService.getRoadClosures({ forceRefresh: true });
      res.json({ ok: true, message: 'Kapalı yol cache yenilendi.', count: items.length });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Kapalı yol cache yenilenemedi.', detail: error.message });
    }
  }

  async getWeather(req, res) {
    try {
      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const data = await weatherService.getWeather({ forceRefresh });
      res.json({ ok: true, ...data });
    } catch (error) {
      console.error('❌ getWeather error:', error);
      res.status(500).json({ ok: false, message: 'Hava durumu alinamadi.', detail: error.message });
    }
  }

  async getPrayerTimes(req, res) {
    try {
      const data = await prayerService.getPrayerTimes();
      res.json({ ok: true, data });
    } catch (error) {
      console.error('❌ getPrayerTimes error:', error);
      res.status(500).json({ ok: false, message: 'Namaz vakitleri alinamadi.', detail: error.message });
    }
  }

  async getObituaries(req, res) {
    try {
      const force = req.query.refresh === '1';
      const items = await obituaryService.getObituaries({ forceRefresh: force });
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({
        ok: true,
        fetchedAt: new Date(obituaryService.cache.fetchedAt || Date.now()).toISOString(),
        count: items.length,
        items,
      });
    } catch (error) {
      console.error('❌ getObituaries error:', error);
      res.status(500).json({ ok: false, message: 'Vefat listesi alinamadi.', detail: error.message });
    }
  }

  async refreshObituaries(req, res) {
    try {
      const items = await obituaryService.getObituaries({ forceRefresh: true });
      res.json({ ok: true, message: 'Vefat listesi yenilendi.', count: items.length });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Vefat listesi yenilenemedi.', detail: error.message });
    }
  }

  async getDailyBriefing(req, res) {
    try {
      const date = req.query.date;
      if (!date) {
        await dailyBriefingService.generateIfDue().catch(() => {});
      }
      let briefing = date
        ? await dailyBriefingService.getBriefingByDate(date)
        : await dailyBriefingService.getLatestBriefing();

      if (!briefing) {
        return res.json({
          ok: true,
          briefing: null,
          message: 'Akşam saatlerinde günlük özet hazırlanır.',
        });
      }

      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
      return res.json({
        ok: true,
        briefing: {
          briefingDate: briefing.briefing_date,
          todayTitle: briefing.today_title,
          todaySummary: briefing.today_summary,
          weekSummary: briefing.week_summary,
          highlights: briefing.highlights || [],
          sourceNewsCount: briefing.source_news_count,
          model: briefing.model,
          generatedAt: briefing.generated_at,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Günlük özet alınamadı.', detail: error.message });
    }
  }

  async refreshDailyBriefing(req, res) {
    try {
      const briefing = await dailyBriefingService.generateBriefing({ force: true });
      res.json({
        ok: true,
        message: 'Günlük AI özeti üretildi.',
        briefing: {
          briefingDate: briefing.briefing_date,
          todayTitle: briefing.today_title,
          generatedAt: briefing.generated_at,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Günlük özet üretilemedi.', detail: error.message });
    }
  }

  async generateNewsDraft(req, res) {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ ok: false, message: 'prompt parametresi gerekli.' });
      }

      const aiClient = require('../services/aiClient');
      if (!aiClient.isConfigured()) {
        return res.status(500).json({ ok: false, message: 'Yapay Zeka anahtarı yapılandırılmamış.' });
      }

      const systemPrompt =
        'Sen Düziçi ve Osmaniye bölgesi için haber yazan profesyonel bir gazetecisin. ' +
        'Sana verilen ham notlardan yola çıkarak akıcı, imlası düzgün, yerel gazetecilik diline uygun bir haber taslağı hazırlamalısın. ' +
        'Gereksiz dolgu cümlelerden kaçın. Doğrudan olaya odaklan. ' +
        'Yanıtını sadece belirtilen JSON formatında vermelisin.';

      const userPrompt =
        `Haber Notları:\n${prompt}\n\n` +
        `GÖREV TALİMATLARI:\n` +
        `1. title: Haber için ilgi çekici, clickbait olmayan, imlası düzgün yeni bir başlık yaz (max 100 karakter).\n` +
        `2. summary: Haberden yola çıkarak 2 veya 3 cümlelik, merak uyandıran ve bilgilendirici samimi bir özet yaz (max 250 karakter).\n` +
        `3. fullText: Haberin tamamını okunaklı paragraflar halinde yaz. Markdown veya HTML kullanma.\n\n` +
        `JSON FORMATI:\n` +
        `{\n` +
        `  "title": "...",\n` +
        `  "summary": "...",\n` +
        `  "fullText": "..."\n` +
        `}`;

      const { data, model } = await aiClient.generateJson({ systemPrompt, userPrompt });
      return res.json({
        ok: true,
        model,
        draft: {
          title: data.title || '',
          summary: data.summary || '',
          fullText: data.fullText || '',
        }
      });
    } catch (error) {
      console.error('❌ Draft generation failed:', error.message);
      const detail = String(error.message || 'Bilinmeyen hata');
      return res.status(500).json({
        ok: false,
        message: `Taslak haber üretilemedi: ${detail.slice(0, 180)}`,
        detail,
      });
    }
  }

  async publishNewsDraft(req, res) {
    try {
      const {
        title,
        summary,
        fullText,
        category,
        imageUrl,
        images,
        videoUrl,
        sendPush,
      } = req.body;
      if (!title || !fullText) {
        return res.status(400).json({ ok: false, message: 'Başlık ve Haber Metni alanları zorunludur.' });
      }

      const cover =
        (typeof imageUrl === 'string' && imageUrl.trim()) ||
        (Array.isArray(images) && images.find(Boolean)) ||
        null;
      if (!cover) {
        return res.status(400).json({
          ok: false,
          message: 'Haber görseli zorunludur. Kapak görseli yükleyin veya URL girin.',
        });
      }

      const crypto = require('crypto');
      const supabase = require('../utils/supabaseClient');
      const fcmService = require('../services/fcmService');
      const newsService = require('../services/newsService');
      const fileService = require('../services/fileService');

      const urlHash = crypto.createHash('md5').update(`custom-news-${title}-${Date.now()}`).digest('hex');
      const newsId = `news-custom-${urlHash}`;
      const imageList = Array.isArray(images) && images.length > 0
        ? images.filter(Boolean)
        : [cover];
      const video = typeof videoUrl === 'string' && videoUrl.trim() ? videoUrl.trim() : null;

      const newArticle = {
        id: newsId,
        title: String(title).slice(0, 120),
        summary: String(summary || '').trim(),
        full_text: String(fullText).trim(),
        image_url: cover,
        video_url: video,
        created_at: new Date().toISOString(),
        source_url: `https://forvibe.app/duzici-news/${newsId}`,
        source_name: 'Hepsi Düziçi',
        category: category || 'Düziçi',
        is_ai_generated: true,
        is_ai_optimized: false,
        verified: true,
        images: imageList,
        fetched_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('news_items')
        .insert(newArticle)
        .select('*')
        .single();

      if (error) throw error;

      newsService.prependToCache(newsService.mapDbRowToItem(data));

      let pushResult = null;
      if (sendPush === true && fcmService.isFcmConfigured()) {
        const isDuzici = String(category || '').toLowerCase().includes('düziçi') ||
                         String(category || '').toLowerCase().includes('duzici');
        const topic = isDuzici ? 'news_duzici' : 'news_osmaniye';
        const pushTitle = isDuzici ? "Düziçi'nde Yeni Gelişme 📰" : "Osmaniye'de Yeni Gelişme 📰";

        pushResult = await fcmService.sendToTopic(topic, {
          title: pushTitle,
          body: newArticle.title,
          data: {
            route: String(newArticle.id),
          },
        }).catch(e => {
          console.error('[push] FCM push failed:', e.message);
          return { ok: false, detail: e.message };
        });
      }

      try {
        const city = await fileService.readCityContent();
        city.aiNewsSettings = {
          ...(city.aiNewsSettings || {}),
          lastDraftPublishAt: new Date().toISOString(),
          lastDraftPublishOk: true,
          lastDraftTitle: newArticle.title,
        };
        await fileService.writeCityContent(city);
      } catch (_) {}

      return res.json({
        ok: true,
        message: 'Haber başarıyla yayınlandı (Hepsi Düziçi ✓).',
        item: data,
        push: pushResult,
      });
    } catch (error) {
      console.error('❌ Custom news publish failed:', error.message);
      return res.status(500).json({ ok: false, message: 'Haber yayınlanamadı.', detail: error.message });
    }
  }

  async triggerAiReporter(req, res) {
    try {
      const aiReporterService = require('../services/aiReporterService');
      const draftOnly = req.body?.draftOnly === true || req.query?.draftOnly === '1';
      const result = await aiReporterService.generateDailyReport({
        force: true,
        publish: !draftOnly,
      });

      if (!result) {
        return res.status(500).json({ ok: false, message: 'Günlük şehir raporu üretilemedi.' });
      }

      if (result.draft) {
        return res.json({
          ok: true,
          draft: true,
          message: 'Şehir raporu taslak olarak hazırlandı (henüz yayınlanmadı).',
          draftPayload: {
            title: result.title,
            summary: result.summary,
            fullText: result.fullText,
            imageUrl: result.imageUrl,
            theme: result.theme,
            model: result.model,
            score: result.score,
          },
        });
      }

      return res.json({
        ok: true,
        message: 'Günlük şehir raporu üretildi ve yayınlandı.',
        item: result,
      });
    } catch (error) {
      console.error('❌ AI Reporter trigger failed:', error.message);
      return res.status(500).json({
        ok: false,
        message: 'Yapay Zeka Muhabiri çalıştırılamadı.',
        detail: error.message,
      });
    }
  }

  async getAiNewsSettings(req, res) {
    try {
      const fileService = require('../services/fileService');
      const dailyBriefingService = require('../services/dailyBriefingService');
      const data = await fileService.readCityContent();
      const settings = data?.aiNewsSettings || {};
      const defaults = {
        beautifyScraped: false,
        reporterEnabled: false,
        reporterRequireApproval: false,
        beautifyDailyLimit: 25,
        beautifyCountToday: 0,
        beautifyCountDate: null,
        lastBeautifyAt: null,
        lastBeautifyOk: null,
        lastReporterAt: null,
        lastReporterOk: null,
        lastReporterTitle: null,
        lastReporterError: null,
        lastReporterScore: null,
        lastReporterTheme: null,
        lastReporterModel: null,
        lastReporterSkipped: null,
        lastReporterDraftOnly: null,
        lastReporterDraft: null,
        lastDraftPublishAt: null,
        lastDraftPublishOk: null,
        lastDraftTitle: null,
      };
      let briefing = null;
      try {
        const latest = await dailyBriefingService.getLatestBriefing();
        if (latest) {
          briefing = {
            briefingDate: latest.briefing_date,
            todayTitle: latest.today_title,
            todaySummary: latest.today_summary,
            generatedAt: latest.generated_at,
            model: latest.model,
          };
        }
      } catch (_) {}

      let latestReporter = settings.lastReporterDraft || null;
      if (!latestReporter?.fullText) {
        try {
          const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
          const db = requireSupabaseAdmin();
          const { data: rows } = await db
            .from('news_items')
            .select('id, title, summary, full_text, image_url, created_at, is_ai_generated')
            .like('id', 'news-ai-reporter-%')
            .order('created_at', { ascending: false })
            .limit(1);
          const row = rows?.[0];
          if (row) {
            latestReporter = {
              title: row.title,
              summary: row.summary,
              fullText: row.full_text,
              imageUrl: row.image_url,
              date: String(row.created_at || '').slice(0, 10),
              published: true,
              newsId: row.id,
            };
          }
        } catch (_) {}
      }

      return res.json({
        ok: true,
        settings: { ...defaults, ...settings },
        briefing,
        latestReporter,
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Ayarlar okunamadı.', detail: error.message });
    }
  }

  async saveAiNewsSettings(req, res) {
    try {
      const { beautifyScraped, reporterEnabled, reporterRequireApproval, beautifyDailyLimit } = req.body;
      const fileService = require('../services/fileService');
      const data = await fileService.readCityContent();

      const prev = data.aiNewsSettings || {};
      const limit = Number(beautifyDailyLimit);
      data.aiNewsSettings = {
        ...prev,
        beautifyScraped: beautifyScraped === true,
        reporterEnabled: reporterEnabled === true,
        reporterRequireApproval: reporterRequireApproval === true,
        beautifyDailyLimit: Number.isFinite(limit) ? Math.max(0, Math.min(200, Math.round(limit))) : (prev.beautifyDailyLimit ?? 25),
      };

      await fileService.createBackupBeforeWrite();
      await fileService.writeCityContent(data);

      return res.json({ ok: true, message: 'Yapay Zeka haber ayarları kaydedildi.', settings: data.aiNewsSettings });
    } catch (error) {
      return res.status(500).json({ ok: false, message: 'Ayarlar kaydedilemedi.', detail: error.message });
    }
  }
}

module.exports = new ApiController();
