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

function buildConsolidatedOutageAnnouncements(outages = []) {
  if (!Array.isArray(outages) || outages.length === 0) return [];

  const now = Date.now();
  // 1. Sadece aktif ve gelecekteki / devam eden kesintileri al (Geçmiş veya bitmişleri kesinlikle duyuruya atma!)
  const validOutages = outages.filter((o) => {
    if (!o || !o.title) return false;
    if (o.status === 'Tamamlandı' || o.isActive === false) return false;
    if (o.endAt && new Date(o.endAt).getTime() < now) return false;
    const target = o.endAt || o.startAt || o.date;
    if (target && new Date(target).getTime() < now - 60 * 60 * 1000) return false;
    return true;
  });

  if (validOutages.length === 0) return [];

  // 2. Türüne (ELEKTRİK / SU / DOĞALGAZ) ve Tarihine göre grupla (Aynı günkü 5 kesinti için 5 ayrı duyuru basma!)
  const groups = new Map();
  for (const o of validOutages) {
    const isGas = String(o.type || '').toUpperCase().includes('GAZ');
    const isWater = !isGas && String(o.type || '').toUpperCase() === 'SU';
    const typeKey = isGas ? 'DOGALGAZ' : (isWater ? 'SU' : 'ELEKTRIK');
    const dateStr = o.startAt ? o.startAt.split('T')[0] : 'genel';
    const groupKey = `${typeKey}_${dateStr}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(o);
  }

  const result = [];

  for (const [groupKey, items] of groups.entries()) {
    const isGas = groupKey.startsWith('DOGALGAZ');
    const isWater = groupKey.startsWith('SU');
    const badgeLabel = isGas
      ? '🔥 DOĞALGAZ KESİNTİSİ'
      : (isWater ? '💧 SU KESİNTİSİ' : '⚡ ELEKTRİK KESİNTİSİ');
    const defaultImage = isGas
      ? 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=1200&q=80'
      : (isWater
        ? 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&q=80'
        : 'https://images.unsplash.com/photo-1473346882829-8bf0c4e0e8e4?w=1200&q=80');

    if (items.length === 1) {
      // Tekil kesinti kartı
      const o = items[0];
      let timeStr = '';
      if (o.startAt) {
        try {
          const d = new Date(o.startAt);
          const day = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
          const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          let endStr = '';
          if (o.endAt) {
            const dEnd = new Date(o.endAt);
            endStr = ` - ${String(dEnd.getHours()).padStart(2, '0')}:${String(dEnd.getMinutes()).padStart(2, '0')}`;
          }
          timeStr = `${day} ${time}${endStr}`;
        } catch (_) {}
      }

      const title = o.title;
      const summary = o.subtitle || (timeStr ? `${timeStr} arasında şebeke çalışması.` : 'Planlı şebeke kesintisi');

      const bodyLines = [
        summary,
        '',
        o.area ? `📍 Etkilenen Bölgeler:\n${o.area}` : '',
        timeStr ? `⏰ Tarih ve Saat: ${timeStr}` : '',
        o.status ? `📌 Durum: ${o.status}` : '',
        o.source ? `🏢 Kurum: ${o.source}` : '',
        '',
        'Harita ve sokak bazlı canlı takip için uygulamanın "Kesintiler" bölümünü inceleyebilirsiniz.',
      ].filter(Boolean).join('\n');

      result.push({
        id: `outage_${o.id || groupKey}`,
        title,
        summary,
        body: bodyLines,
        imageUrl: defaultImage,
        isPinned: false,
        isActive: true,
        publishedAt: o.publishedAt || o.startAt || o.date || new Date().toISOString(),
        createdAt: o.publishedAt || o.startAt || o.date || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        badgeLabel,
        route: 'screen:outages',
      });
    } else {
      // Çoklu mahalle kesintisi — Tek bir temiz konsolide duyuruda birleştir
      const first = items[0];
      let dayStr = 'Yakın Tarihli';
      if (first.startAt) {
        try {
          dayStr = new Date(first.startAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        } catch (_) {}
      }

      const title = isGas
        ? `Düziçi'de ${dayStr} Doğalgaz Kesintisi (${items.length} Bölge)`
        : (isWater
          ? `Düziçi'de ${dayStr} Su Kesintisi (${items.length} Bölge)`
          : `Düziçi'de ${dayStr} Planlı Elektrik Kesintisi (${items.length} Bölge)`);

      const summary = `${dayStr} günü Düziçi genelinde ${items.length} farklı bölgede şebeke bakım ve iyileştirme çalışmaları yapılacaktır.`;

      const areaList = items.map((it, idx) => {
        let tStr = '';
        if (it.startAt) {
          try {
            const sH = new Date(it.startAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const eH = it.endAt ? new Date(it.endAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
            tStr = ` (${sH}${eH ? ` - ${eH}` : ''})`;
          } catch (_) {}
        }
        return `• ${it.area || it.title}${tStr}`;
      }).join('\n');

      const defaultSource = isGas ? 'Aksa Çukurova Doğal Gaz' : (isWater ? 'Düziçi Belediyesi' : 'Toroslar EDAŞ');
      const bodyLines = [
        summary,
        '',
        '📍 Etkilenen Bölgeler ve Saatler:',
        areaList,
        '',
        `🏢 Kurum: ${first.source || defaultSource}`,
        '',
        'Detaylı mahalle ve sokak listesi için "Kesintiler" ekranını ziyaret edebilirsiniz.',
      ].join('\n');

      result.push({
        id: `outage_group_${groupKey}`,
        title,
        summary,
        body: bodyLines,
        imageUrl: defaultImage,
        isPinned: false,
        isActive: true,
        publishedAt: first.publishedAt || first.startAt || new Date().toISOString(),
        createdAt: first.publishedAt || first.startAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        badgeLabel,
        route: 'screen:outages',
      });
    }
  }

  return result;
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

    // Yalnızca geçerli, güncel ve planlı kesintileri duyurular listesine dahil et (Geçmişleri ASLA ekleme!)
    let outageItems = [];
    try {
      const outageService = require('./outageService');
      const activeOutages = outageService.cache?.data?.length
        ? outageService.cache.data
        : await outageService.getOutages().catch(() => []);

      outageItems = buildConsolidatedOutageAnnouncements(activeOutages);
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
