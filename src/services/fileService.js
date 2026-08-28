const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const { getDbPool } = require('../utils/dbPool');
const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

class FileService {
  async readCityContent() {
    // 1. Önce Direct PostgreSQL Pool Dene
    const pool = getDbPool();
    if (pool) {
      try {
        const res = await pool.query('SELECT data FROM city_contents WHERE id = 1 LIMIT 1');
        if (res.rows.length > 0 && res.rows[0].data) {
          return res.rows[0].data;
        }
      } catch (pgErr) {
        console.error('❌ PG readCityContent error:', pgErr.message);
      }
    }

    // 2. Supabase Fallback
    try {
      const { data, error } = await supabase
        .from('city_contents')
        .select('data')
        .eq('id', 1)
        .maybeSingle();
      
      if (error) throw error;
      if (data?.data) return data.data;
    } catch (error) {
      console.error('❌ Veri okuma hatası:', error.message);
    }

    // 3. Yerel Dosya Fallback
    try {
      const raw = await fs.readFile(config.PATHS.CITY_CONTENT, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  async writeCityContent(content) {
    const pool = getDbPool();
    if (pool) {
      try {
        // 1. Get current content to backup
        const curRes = await pool.query('SELECT data FROM city_contents WHERE id = 1 LIMIT 1');
        if (curRes.rows.length > 0 && curRes.rows[0].data) {
          await pool.query(
            'INSERT INTO city_content_backups (data, description, created_at) VALUES ($1, $2, NOW())',
            [curRes.rows[0].data, `Backup before update on ${new Date().toISOString()}`],
          );
        }

        // 2. Upsert city_contents
        const sql = `
          INSERT INTO city_contents (id, data, updated_at)
          VALUES (1, $1, NOW())
          ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = NOW()
        `;
        await pool.query(sql, [content]);

        // 3. Yerel dosyaya da yaz
        const pretty = `${JSON.stringify(content, null, 2)}\n`;
        await fs.writeFile(config.PATHS.CITY_CONTENT, pretty, 'utf8');
        return;
      } catch (pgErr) {
        console.error('❌ PG writeCityContent error:', pgErr.message);
      }
    }

    // Fallback: Supabase Admin
    try {
      const db = requireSupabaseAdmin();
      const { error } = await db
        .from('city_contents')
        .upsert({ id: 1, data: content, updated_at: new Date().toISOString() });

      if (error) throw error;

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
