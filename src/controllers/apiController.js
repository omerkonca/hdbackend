const crypto = require('crypto');
const fileService = require('../services/fileService');
const pharmacyService = require('../services/pharmacyService');
const newsService = require('../services/newsService');
const financeService = require('../services/financeService');
const fuelService = require('../services/fuelService');
const eventService = require('../services/eventService');
const outageService = require('../services/outageService');
const roadClosureService = require('../services/roadClosureService');
const weatherService = require('../services/weatherService');
const prayerService = require('../services/prayerService');
const obituaryService = require('../services/obituaryService');
const config = require('../config');

class ApiController {
  async getCityContent(req, res) {
    try {
      const data = await fileService.readCityContent();
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
      const items = await newsService.getNews({ max });
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
      
      // 1. Check if cached in Supabase news_items table
      const supabase = require('../utils/supabaseClient');
      try {
        const { data, error } = await supabase
          .from('news_items')
          .select('full_text, image_url')
          .eq('source_url', url)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (!error && data && data.length > 0) {
          const cached = data[0];
          const hasText = cached.full_text && cached.full_text.trim().length > 0;
          const hasImage = cached.image_url && cached.image_url.trim().length > 0;
          if (hasText) {
            return res.json({
              ok: true,
              fullText: cached.full_text,
              imageUrl: hasImage ? cached.image_url : null,
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
      
      // 3. Save/Update cache in Supabase background
      if ((fullText && fullText.trim().length > 0) || (imageUrl && imageUrl.trim().length > 0)) {
        const update = {};
        if (fullText && fullText.trim().length > 0) update.full_text = fullText;
        if (imageUrl && imageUrl.trim().length > 0) update.image_url = imageUrl;
        supabase
          .from('news_items')
          .update(update)
          .eq('source_url', url)
          .then(() => console.log(`[news] Full-text successfully cached in Supabase for: ${url}`))
          .catch(e => console.error('❌ Failed to cache full-text in Supabase:', e.message));
      }

      res.json({ ok: true, fullText, imageUrl: imageUrl || null });
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
      const backups = await fileService.listBackups();
      if (backups.length === 0) return res.status(404).json({ ok: false, message: 'Yedek bulunamadi.' });
      const lastBackup = backups[0];
      res.json({ ok: true, message: 'Geri yukleme simule edildi (son yedek: ' + lastBackup + ')' });
    } catch (error) {
      res.status(500).json({ ok: false, message: 'Geri yukleme hatasi.', detail: error.message });
    }
  }

  async getEvents(req, res) {
    try {
      const items = await eventService.getEvents();
      res.json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        items,
      });
    } catch (error) {
      console.error('❌ getEvents error:', error);
      res.status(500).json({ ok: false, message: 'Etkinlikler alinamadi.', detail: error.message });
    }
  }

  async getOutages(req, res) {
    try {
      const items = await outageService.getOutages();
      res.json({
        ok: true,
        fetchedAt: new Date(outageService.cache.fetchedAt).toISOString(),
        items,
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
      const data = await weatherService.getWeather();
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
}

module.exports = new ApiController();
