const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
const { fetchMarketingTokens, logPush } = require('./pushTokenService');
const fcmService = require('./fcmService');

function mapRow(row) {
  if (!row) return null;
  const badgeLabel = (row.badge_label || row.source_label || '').toString().trim();
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
    badgeLabel: badgeLabel || 'YAYINCI DUYURUSU',
  };
}

function outageToAnnouncementRow(outage) {
  if (!outage || !outage.title) return null;
  const isWater = String(outage.type || '').toUpperCase() === 'SU';
  const badgeLabel = isWater ? '💧 SU KESİNTİSİ' : '⚡ ELEKTRİK KESİNTİSİ';

  let timeStr = '';
  if (outage.startAt) {
    try {
      const d = new Date(outage.startAt);
      const day = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      let endStr = '';
      if (outage.endAt) {
        const dEnd = new Date(outage.endAt);
        endStr = ` - ${String(dEnd.getHours()).padStart(2, '0')}:${String(dEnd.getMinutes()).padStart(2, '0')}`;
      }
      timeStr = `${day} ${time}${endStr}`;
    } catch (_) {}
  }

  const title = outage.title;
  const summary = outage.subtitle || (timeStr ? `${timeStr} saatleri arasında kesinti.` : 'Planlı şebeke kesintisi');

  const bodyLines = [
    summary,
    '',
    outage.area ? `📍 Etkilenen Bölgeler:\n${outage.area}` : '',
    timeStr ? `⏰ Tarih ve Saat: ${timeStr}` : '',
    outage.status ? `📌 Durum: ${outage.status}` : '',
    outage.source ? `🏢 Kaynak: ${outage.source}` : '',
    '',
    'Harita ve canlı kesinti takibi için uygulamanın "Kesintiler" bölümünü inceleyebilirsiniz.',
  ].filter(Boolean).join('\n');

  return {
    id: `outage_${outage.id}`,
    title,
    summary,
    body: bodyLines,
    imageUrl: isWater
      ? 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80'
      : 'https://images.unsplash.com/photo-1473346882829-8bf0c4e0e8e4?w=1200&q=80',
    isPinned: outage.isActive !== false,
    isActive: true,
    publishedAt: outage.publishedAt || outage.startAt || outage.date || new Date().toISOString(),
    createdAt: outage.publishedAt || outage.startAt || outage.date || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    badgeLabel,
    route: 'screen:outages',
  };
}

class PublisherAnnouncementService {
  async listPublic({ limit = 40 } = {}) {
    let manualItems = [];
    try {
      const db = requireSupabaseAdmin();
      const { data, error } = await db
        .from('publisher_announcements')
        .select('*')
        .eq('is_active', true)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(Math.min(limit, 100));

      if (!error && Array.isArray(data)) {
        manualItems = data.map(mapRow);
      }
    } catch (err) {
      console.warn('[announcements] db fetch error:', err.message);
    }

    // Aktif ve planlı kesintileri duyurular listesine dahil et
    let outageItems = [];
    try {
      const outageService = require('./outageService');
      const activeOutages = outageService.cache?.data?.length
        ? outageService.cache.data
        : await outageService.getOutages().catch(() => []);
      
      const recentHistory = (outageService.getHistory() || []).slice(0, 5);
      const combined = [...(activeOutages || []), ...recentHistory];

      for (const o of combined) {
        const row = outageToAnnouncementRow(o);
        if (row) outageItems.push(row);
      }
    } catch (oErr) {
      console.warn('[announcements] outage merge error:', oErr.message);
    }

    // Manuel yayıncı duyuruları + Kesinti duyurularını birleştir
    const merged = [...manualItems, ...outageItems];

    // Pinned (sabitlenen) olanlar önde, sonra tarihe göre sırala
    merged.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const timeA = new Date(a.publishedAt || 0).getTime();
      const timeB = new Date(b.publishedAt || 0).getTime();
      return timeB - timeA;
    });

    return merged.slice(0, Math.min(limit, 100));
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
    if (String(id).startsWith('outage_')) {
      const rawId = String(id).replace(/^outage_/, '');
      try {
        const outageService = require('./outageService');
        const allOutages = [
          ...(outageService.cache?.data || []),
          ...(outageService.getHistory() || []),
        ];
        const match = allOutages.find((o) => o.id === rawId || `outage_${o.id}` === id);
        if (match) {
          return outageToAnnouncementRow(match);
        }
      } catch (_) {}
    }

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
