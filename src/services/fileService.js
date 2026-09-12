const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const { getDbPool } = require('../utils/dbPool');
const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

class FileService {
  constructor() {
    this._cachedContent = null;
    this._lastRead = 0;
    // 5 dakikalık RAM önbelleği (Supabase egress'i ve disk G/Ç'yi sıfıra indirmek için)
    this._cacheTtlMs = 5 * 60 * 1000;
  }

  /**
   * Bellek önbelleğini temizler (admin güncellemesi sonrasında çağrılır).
   */
  invalidateCache() {
    this._cachedContent = null;
    this._lastRead = 0;
  }

  /**
   * Şehir içeriğini okur.
   * 1. Öncelik: RAM önbelleği (0ms, sıfır network/egress)
   * 2. Öncelik: Yerel diskteki city_content.json (~1ms, yerel dosya)
   * 3. Yedek (Fallback): Supabase / Postgres (yalnızca yerel dosya okunamazsa)
   */
  async readCityContent(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    const now = Date.now();

    // 1. RAM Önbelleği Kontrolü
    if (!forceRefresh && this._cachedContent && (now - this._lastRead < this._cacheTtlMs)) {
      return this._cachedContent;
    }

    // 2. Birincil Kaynak: Yerel JSON Dosyası
    try {
      const raw = await fs.readFile(config.PATHS.CITY_CONTENT, 'utf8');
      if (raw && raw.trim().length > 10) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this._cachedContent = parsed;
          this._lastRead = now;
          return this._cachedContent;
        }
      }
    } catch (fsErr) {
      console.warn('⚠️ [fileService] Yerel city_content.json okunamadı, veritabanına bakılıyor:', fsErr.message);
    }

    // 3. Fallback: Direct PostgreSQL Pool
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query('SELECT data FROM city_contents WHERE id = 1 LIMIT 1');
        if (res.rows.length > 0 && res.rows[0].data) {
          this._cachedContent = res.rows[0].data;
          this._lastRead = now;
          return this._cachedContent;
        }
      } catch (pgErr) {
        console.error('❌ [fileService] PG readCityContent fallback hatası:', pgErr.message);
      }
    }

    // 4. Fallback: Supabase REST
    try {
      const { data, error } = await supabase
        .from('city_contents')
        .select('data')
        .eq('id', 1)
        .maybeSingle();
      
      if (!error && data?.data) {
        this._cachedContent = data.data;
        this._lastRead = now;
        return this._cachedContent;
      }
    } catch (error) {
      console.error('❌ [fileService] Supabase fallback okuma hatası:', error.message);
    }

    // 5. Son Çare: Bellekteki eski içerik veya boş obje
    return this._cachedContent || {};
  }

  /**
   * Şehir içeriğini yazar.
   * Birincil olarak yerel dosyaya yazar, RAM'i günceller ve yerel yedek alır.
   * Veritabanı (Supabase/Postgres) eşitlemesini arka planda (non-blocking) dener,
   * böylece Supabase kotası dolsa bile admin paneli ve uygulama ASLA kilitlenmez.
   */
  async writeCityContent(content) {
    if (!this.isValidCityContent(content)) {
      throw new Error('Geçersiz şehir içeriği verisi.');
    }

    // 1. Önce mevcut halini yerel yedek klasörüne kaydet
    await this.createBackupBeforeWrite().catch((e) => {
      console.warn('[fileService] Yerel yedek alınırken hata oluştu (yazmaya devam ediliyor):', e.message);
    });

    // 2. Birincil Kaynak: Yerel JSON dosyasına yaz
    const pretty = `${JSON.stringify(content, null, 2)}\n`;
    await fs.writeFile(config.PATHS.CITY_CONTENT, pretty, 'utf8');

    // 3. RAM Önbelleğini anında güncelle
    this._cachedContent = content;
    this._lastRead = Date.now();

    // 4. Arka planda Supabase/PostgreSQL senkronizasyonu (Asenkron & Hata durumunda ana işlemi durdurmaz)
    setImmediate(async () => {
      const pool = getDbPool();
      if (pool) {
        try {
          const sql = `
            INSERT INTO city_contents (id, data, updated_at)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE SET
              data = EXCLUDED.data,
              updated_at = NOW()
          `;
          await pool.query(sql, [content]);

          // DB yedeği (Son 25 adet)
          await pool.query(
            'INSERT INTO city_content_backups (data, description, created_at) VALUES ($1, $2, NOW())',
            [content, `Backup on ${new Date().toISOString()}`]
          ).catch(() => {});
          await pool.query(
            'DELETE FROM city_content_backups WHERE id NOT IN (SELECT id FROM city_content_backups ORDER BY created_at DESC LIMIT 25)'
          ).catch(() => {});
          return;
        } catch (pgErr) {
          console.warn('⚠️ [fileService] Arka plan PG senkronizasyonu başarısız (yerel dosya korundu):', pgErr.message);
        }
      }

      // Supabase REST fallback senkronizasyonu
      try {
        const db = requireSupabaseAdmin();
        if (db) {
          await db
            .from('city_contents')
            .upsert({ id: 1, data: content, updated_at: new Date().toISOString() });
        }
      } catch (supaErr) {
        console.warn('⚠️ [fileService] Arka plan Supabase senkronizasyonu başarısız (yerel dosya korundu):', supaErr.message);
      }
    });
  }

  async ensureBackupsDir() {
    await fs.mkdir(config.PATHS.BACKUPS_DIR, { recursive: true });
  }

  async createBackupBeforeWrite() {
    try {
      await this.ensureBackupsDir();
      const content = await this.readCityContent();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(config.PATHS.BACKUPS_DIR, `city_content.${stamp}.json`);
      await fs.writeFile(backupPath, JSON.stringify(content, null, 2), 'utf8');

      // Yerel yedek klasöründe yalnızca en son 25 yedeği sakla (disk şişmesini engelle)
      const files = await fs.readdir(config.PATHS.BACKUPS_DIR);
      const jsonBackups = files.filter((f) => f.startsWith('city_content.') && f.endsWith('.json')).sort();
      if (jsonBackups.length > 25) {
        const toDelete = jsonBackups.slice(0, jsonBackups.length - 25);
        for (const oldFile of toDelete) {
          await fs.unlink(path.join(config.PATHS.BACKUPS_DIR, oldFile)).catch(() => {});
        }
      }

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
