const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const CityContent = require('../models/CityContent');

class FileService {
  async readCityContent() {
    try {
      // Önce veritabanına bak
      let content = await CityContent.findOne().sort({ createdAt: -1 });
      
      if (!content) {
        console.log('📦 Veritabanı boş, yerel JSON dosyasından seed ediliyor...');
        const raw = await fs.readFile(config.PATHS.CITY_CONTENT, 'utf8');
        const jsonData = JSON.parse(raw);
        content = await CityContent.create(jsonData);
      }
      
      return content;
    } catch (error) {
      console.error('❌ Veri okuma hatası:', error.message);
      // Fallback: Yerel dosyayı oku
      const raw = await fs.readFile(config.PATHS.CITY_CONTENT, 'utf8');
      return JSON.parse(raw);
    }
  }

  async writeCityContent(content) {
    try {
      // Veritabanına kaydet (Veya güncelle)
      const existing = await CityContent.findOne();
      if (existing) {
        // Mongoose Mixed tiplerinde direct assignment bazen change tracking sorununa yol açar, 
        // bu yüzden yeni bir döküman gibi kaydediyoruz veya overwrite ediyoruz.
        Object.assign(existing, content);
        existing.markModified('services');
        existing.markModified('explore');
        existing.markModified('media');
        existing.markModified('branding');
        existing.markModified('home');
        existing.markModified('more');
        await existing.save();
      } else {
        await CityContent.create(content);
      }
      
      // Yedek olarak yerel dosyaya da yaz (Opsiyonel ama güvenli)
      const pretty = `${JSON.stringify(content, null, 2)}\n`;
      await fs.writeFile(config.PATHS.CITY_CONTENT, pretty, 'utf8');
    } catch (error) {
      console.error('❌ Veri yazma hatası:', error.message);
      throw error;
    }
  }

  async ensureBackupsDir() {
    await fs.mkdir(config.PATHS.BACKUPS_DIR, { recursive: true });
  }

  async createBackupBeforeWrite() {
    // Veritabanı olduğu için dosya yedeği artık kritik değil ama geriye dönük uyumluluk için tutuyoruz
    try {
      await this.ensureBackupsDir();
      const content = await this.readCityContent();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(config.PATHS.BACKUPS_DIR, `city_content.${stamp}.json`);
      await fs.writeFile(backupPath, JSON.stringify(content, null, 2), 'utf8');
      return backupPath;
    } catch (e) {
      return 'backup-failed';
    }
  }

  async listBackups() {
    await this.ensureBackupsDir();
    const files = await fs.readdir(config.PATHS.BACKUPS_DIR);
    return files
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
  }

  isValidCityContent(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.services || typeof payload.services !== 'object') return false;
    if (!payload.explore || typeof payload.explore !== 'object') return false;

    // Opsiyonel yeni bolumler: varsa basit sema kontrolu yap.
    if (payload.branding !== undefined) {
      if (typeof payload.branding !== 'object' || payload.branding === null) return false;
    }
    if (payload.home !== undefined) {
      if (typeof payload.home !== 'object' || payload.home === null) return false;
      if (payload.home.quickActions !== undefined && !Array.isArray(payload.home.quickActions)) return false;
    }
    if (payload.more !== undefined) {
      if (typeof payload.more !== 'object' || payload.more === null) return false;
      if (payload.more.sections !== undefined && !Array.isArray(payload.more.sections)) return false;
    }
    if (payload.news !== undefined) {
      if (typeof payload.news !== 'object' || payload.news === null) return false;
      if (payload.news.sources !== undefined && !Array.isArray(payload.news.sources)) return false;
    }
    if (payload.media !== undefined) {
      if (typeof payload.media !== 'object' || payload.media === null) return false;
    }
    return true;
  }
}

module.exports = new FileService();
