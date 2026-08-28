const { getDbPool } = require('../utils/dbPool');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    message: row.message || '',
    imageUrl: row.image_url || null,
    actionText: row.action_text || '',
    actionUrl: row.action_url || '',
    isActive: row.is_active !== false,
    priority: Number(row.priority || 0),
    showFrequency: row.show_frequency || 'once_per_day',
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class PopupAnnouncementService {
  /**
   * Mobil uygulama için şu an aktif olan en öncelikli pop-up'ı döner.
   */
  async getActivePopup() {
    const pool = getDbPool();
    if (pool) {
      const sql = `
        SELECT * FROM popup_announcements
        WHERE is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY priority DESC, created_at DESC
        LIMIT 1
      `;
      const res = await pool.query(sql);
      if (res.rows.length === 0) return null;
      return mapRow(res.rows[0]);
    }

    // Fallback: Supabase client
    const db = requireSupabaseAdmin();
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('popup_announcements')
      .select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return null;
    return mapRow(data[0]);
  }

  /**
   * Admin paneli için tüm pop-up duyuruları listeler.
   */
  async listAdmin({ limit = 50 } = {}) {
    const pool = getDbPool();
    if (pool) {
      const sql = `
        SELECT * FROM popup_announcements
        ORDER BY created_at DESC
        LIMIT $1
      `;
      const res = await pool.query(sql, [Math.min(limit, 100)]);
      return res.rows.map(mapRow);
    }

    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('popup_announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  }

  /**
   * Tek pop-up getir
   */
  async getById(id) {
    const pool = getDbPool();
    if (pool) {
      const sql = `SELECT * FROM popup_announcements WHERE id = $1 LIMIT 1`;
      const res = await pool.query(sql, [id]);
      if (res.rows.length === 0) return null;
      return mapRow(res.rows[0]);
    }

    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('popup_announcements')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  /**
   * Yeni pop-up oluştur
   */
  async create(payload) {
    const {
      title,
      message = '',
      imageUrl = null,
      actionText = '',
      actionUrl = '',
      isActive = true,
      priority = 0,
      showFrequency = 'once_per_day',
      startsAt = new Date().toISOString(),
      expiresAt = null,
    } = payload || {};

    const cleanTitle = (title || '').trim();
    if (!cleanTitle) {
      throw new Error('Duyuru başlığı boş olamaz');
    }

    const pool = getDbPool();
    if (pool) {
      const sql = `
        INSERT INTO popup_announcements (
          title, message, image_url, action_text, action_url, is_active,
          priority, show_frequency, starts_at, expires_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `;
      const values = [
        cleanTitle,
        (message || '').trim(),
        imageUrl ? imageUrl.trim() : null,
        (actionText || '').trim(),
        (actionUrl || '').trim(),
        isActive === true,
        Number(priority) || 0,
        showFrequency || 'once_per_day',
        startsAt || new Date().toISOString(),
        expiresAt ? new Date(expiresAt).toISOString() : null,
      ];
      const res = await pool.query(sql, values);
      return mapRow(res.rows[0]);
    }

    const db = requireSupabaseAdmin();
    const row = {
      title: cleanTitle,
      message: (message || '').trim(),
      image_url: imageUrl ? imageUrl.trim() : null,
      action_text: (actionText || '').trim(),
      action_url: (actionUrl || '').trim(),
      is_active: isActive === true,
      priority: Number(priority) || 0,
      show_frequency: showFrequency || 'once_per_day',
      starts_at: startsAt || new Date().toISOString(),
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from('popup_announcements')
      .insert(row)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  /**
   * Güncelle
   */
  async update(id, payload) {
    if (!id) throw new Error('ID gerekli');

    const pool = getDbPool();
    if (pool) {
      const current = await this.getById(id);
      if (!current) throw new Error('Pop-up bulunamadı');

      const title = payload.title !== undefined ? (payload.title || '').trim() : current.title;
      const message = payload.message !== undefined ? (payload.message || '').trim() : current.message;
      const imageUrl = payload.imageUrl !== undefined ? (payload.imageUrl ? payload.imageUrl.trim() : null) : current.imageUrl;
      const actionText = payload.actionText !== undefined ? (payload.actionText || '').trim() : current.actionText;
      const actionUrl = payload.actionUrl !== undefined ? (payload.actionUrl || '').trim() : current.actionUrl;
      const isActive = payload.isActive !== undefined ? payload.isActive === true : current.isActive;
      const priority = payload.priority !== undefined ? Number(payload.priority) || 0 : current.priority;
      const showFrequency = payload.showFrequency !== undefined ? payload.showFrequency : current.showFrequency;
      const expiresAt = payload.expiresAt !== undefined ? (payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null) : current.expiresAt;

      const sql = `
        UPDATE popup_announcements SET
          title = $1, message = $2, image_url = $3, action_text = $4,
          action_url = $5, is_active = $6, priority = $7, show_frequency = $8,
          expires_at = $9, updated_at = NOW()
        WHERE id = $10
        RETURNING *
      `;
      const values = [title, message, imageUrl, actionText, actionUrl, isActive, priority, showFrequency, expiresAt, id];
      const res = await pool.query(sql, values);
      return mapRow(res.rows[0]);
    }

    const db = requireSupabaseAdmin();
    const patch = { updated_at: new Date().toISOString() };
    if (payload.title !== undefined) patch.title = (payload.title || '').trim();
    if (payload.message !== undefined) patch.message = (payload.message || '').trim();
    if (payload.imageUrl !== undefined) patch.image_url = payload.imageUrl ? payload.imageUrl.trim() : null;
    if (payload.actionText !== undefined) patch.action_text = (payload.actionText || '').trim();
    if (payload.actionUrl !== undefined) patch.action_url = (payload.actionUrl || '').trim();
    if (payload.isActive !== undefined) patch.is_active = payload.isActive === true;
    if (payload.priority !== undefined) patch.priority = Number(payload.priority) || 0;
    if (payload.showFrequency !== undefined) patch.show_frequency = payload.showFrequency;
    if (payload.expiresAt !== undefined) patch.expires_at = payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null;

    const { data, error } = await db
      .from('popup_announcements')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  /**
   * Aktif/Pasif durumunu tersine çevir
   */
  async toggleActive(id) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Duyuru bulunamadı');
    return this.update(id, { isActive: !existing.isActive });
  }

  /**
   * Sil
   */
  async delete(id) {
    if (!id) throw new Error('ID gerekli');
    const pool = getDbPool();
    if (pool) {
      await pool.query('DELETE FROM popup_announcements WHERE id = $1', [id]);
      return true;
    }

    const db = requireSupabaseAdmin();
    const { error } = await db.from('popup_announcements').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
}

module.exports = new PopupAnnouncementService();
