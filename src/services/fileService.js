const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const supabase = require('../utils/supabaseClient');

class FileService {
  async readCityContent() {
    try {
      // Önce veritabanına bak
      const { data, error } = await supabase
        .from('city_contents')
        .select('data')
        .eq('id', 1)
        .maybeSingle();
      
      if (error) {
        throw error;
      }

      let content = data?.data;
      
      if (!content) {
        console.log('📦 Veritabanı boş, yerel JSON dosyasından seed ediliyor...');
        const raw = await fs.readFile(config.PATHS.CITY_CONTENT, 'utf8');
        content = JSON.parse(raw);
        await this.writeCityContent(content);
      } else if (!this._isHealthyExplore(content)) {
        console.warn('⚠️ Supabase explore verisi yapısı standart dışı görünüyor! (Sıfırlama yapılmadı)');
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
      // 1. Get current content to backup
      try {
        const { data: current } = await supabase
          .from('city_contents')
          .select('data')
          .eq('id', 1)
          .maybeSingle();

        if (current?.data) {
          // Save backup
          await supabase
            .from('city_content_backups')
            .insert({
              data: current.data,
              description: `Backup before update on ${new Date().toISOString()}`
            });

          // Keep only last 15 backups
          const { data: list } = await supabase
            .from('city_content_backups')
            .select('id')
            .order('created_at', { ascending: false });

          if (list && list.length > 15) {
            const deleteIds = list.slice(15).map(x => x.id);
            await supabase
              .from('city_content_backups')
              .delete()
              .in('id', deleteIds);
          }
        }
      } catch (err) {
        console.error('⚠️ [fileService] Failed to create database backup:', err.message);
      }

      // 2. Veritabanına kaydet (Veya güncelle)
      const { error } = await supabase
        .from('city_contents')
        .upsert({ id: 1, data: content, updated_at: new Date().toISOString() });

      if (error) {
        throw error;
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

  _isHealthyExplore(content) {
    const explore = content?.explore;
    if (!explore || typeof explore !== 'object') return false;
    const categories = explore.categories;
    if (!Array.isArray(categories) || categories.length === 0) return false;
    const hasPlaces = categories.some(
      (c) => Array.isArray(c?.places) && c.places.length > 0,
    );
    if (!hasPlaces) return false;
    const services = explore.cityServices;
    if (!Array.isArray(services)) return false;
    const vet = services.find((s) => s?.id === 'veterinary');
    if (vet && typeof vet.directoryData === 'string') return false;
    return true;
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
    if (payload.customEvents !== undefined && !Array.isArray(payload.customEvents)) return false;
    return true;
  }
}

module.exports = new FileService();
