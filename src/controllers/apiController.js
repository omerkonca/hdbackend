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
const config = require('../config');

class ApiController {
  async getCityContent(req, res) {
    try {
      const data = await fileService.readCityContent();
      const body = JSON.stringify(data);
      const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, max-age=30');
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

  async getDutyPharmacies(req, res) {
    try {
      const pharmacies = await pharmacyService.getDutyPharmacies();
      res.json({
        ok: true,
        sourceUrl: config.PHARMACY.URL,
        fetchedAt: new Date(pharmacyService.cache.fetchedAt).toISOString(),
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
      const fullText = await newsService.fetchArticleFullText(url);
      res.json({ ok: true, fullText });
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
}

module.exports = new ApiController();
