const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
const { fetchMarketingTokens, logPush } = require('./pushTokenService');
const fcmService = require('./fcmService');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || '',
    body: row.body || '',
    imageUrl: row.image_url || null,
    isPinned: row.is_pinned === true,
    isActive: row.is_active !== false,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class PublisherAnnouncementService {
  async listPublic({ limit = 40 } = {}) {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('publisher_announcements')
      .select('*')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  }

  async listAdmin({ limit = 60 } = {}) {
    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('publisher_announcements')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  }

  async getById(id, { admin = false } = {}) {
    const db = requireSupabaseAdmin();
    let query = db.from('publisher_announcements').select('*').eq('id', id).maybeSingle();
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data) return null;
    if (!admin && data.is_active === false) return null;
    return mapRow(data);
  }

  async create(payload) {
    const db = requireSupabaseAdmin();
    const now = new Date().toISOString();
    const row = {
      title: String(payload.title || '').trim(),
      summary: String(payload.summary || payload.body || '').trim(),
      body: String(payload.body || '').trim(),
      image_url: payload.imageUrl ? String(payload.imageUrl).trim() : null,
      is_pinned: payload.isPinned === true,
      is_active: payload.isActive !== false,
      published_at: payload.publishedAt || now,
      updated_at: now,
    };

    if (!row.title) throw new Error('Başlık gerekli');
    if (!row.summary && !row.body) throw new Error('Özet veya metin gerekli');

    const { data, error } = await db
      .from('publisher_announcements')
      .insert(row)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async update(id, payload) {
    const db = requireSupabaseAdmin();
    const patch = { updated_at: new Date().toISOString() };
    if (payload.title != null) patch.title = String(payload.title).trim();
    if (payload.summary != null) patch.summary = String(payload.summary).trim();
    if (payload.body != null) patch.body = String(payload.body).trim();
    if (payload.imageUrl !== undefined) {
      patch.image_url = payload.imageUrl ? String(payload.imageUrl).trim() : null;
    }
    if (payload.isPinned != null) patch.is_pinned = payload.isPinned === true;
    if (payload.isActive != null) patch.is_active = payload.isActive !== false;
    if (payload.publishedAt) patch.published_at = payload.publishedAt;

    const { data, error } = await db
      .from('publisher_announcements')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data);
  }

  async deactivate(id) {
    return this.update(id, { isActive: false });
  }

  async sendPushForAnnouncement(announcement) {
    if (!fcmService.isFcmConfigured()) {
      throw new Error('FCM yapılandırılmamış');
    }

    const tokens = await fetchMarketingTokens();
    if (tokens.length === 0) {
      return { sent: 0, failed: 0, total: 0, message: 'Kayıtlı cihaz yok' };
    }

    const pushTitle = announcement.title;
    const pushBody = announcement.summary || announcement.body || announcement.title;
    const route = `screen:announcement:${announcement.id}`;

    const result = await fcmService.sendMulticast(tokens, {
      title: pushTitle,
      body: pushBody,
      data: { route },
    });

    await logPush({
      title: pushTitle,
      body: pushBody,
      target: `announcement:${announcement.id}`,
      sent: result.sent,
      failed: result.failed,
    });

    return {
      sent: result.sent,
      failed: result.failed,
      total: tokens.length,
      route,
    };
  }
}

module.exports = new PublisherAnnouncementService();
