const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

const VALID_CATEGORIES = new Set(['problem', 'suggestion', 'tip', 'other']);
const VALID_STATUSES = new Set(['new', 'reviewing', 'resolved', 'dismissed']);

class CitizenReportService {
  async create({
    category,
    message,
    contactName,
    contactEmail,
    address,
    latitude,
    longitude,
    locationUrl,
    imageUrls = [],
    platform,
    appVersion,
    isPlus = false,
    isSupporter = false,
    userBadge = null,
    fcmToken = null,
  }) {
    if (!VALID_CATEGORIES.has(category)) {
      throw new Error('Geçersiz kategori.');
    }
    const trimmed = String(message || '').trim();
    if (trimmed.length < 10) {
      throw new Error('Mesaj en az 10 karakter olmalı.');
    }
    if (trimmed.length > 2000) {
      throw new Error('Mesaj en fazla 2000 karakter olabilir.');
    }

    const cleanLat = (typeof latitude === 'number' && Number.isFinite(latitude)) ? latitude : (latitude ? parseFloat(latitude) : null);
    const cleanLng = (typeof longitude === 'number' && Number.isFinite(longitude)) ? longitude : (longitude ? parseFloat(longitude) : null);
    const cleanLocUrl = locationUrl?.trim() || (cleanLat && cleanLng ? `https://www.google.com/maps/search/?api=1&query=${cleanLat},${cleanLng}` : null);

    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('citizen_reports')
      .insert({
        category,
        message: trimmed,
        contact_name: contactName?.trim() || null,
        contact_email: contactEmail?.trim() || null,
        address: address?.trim() || null,
        latitude: cleanLat,
        longitude: cleanLng,
        location_url: cleanLocUrl,
        image_urls: imageUrls.filter(Boolean),
        platform: platform || null,
        app_version: appVersion || null,
        status: 'new',
        is_plus: isPlus === true || isPlus === 'true',
        is_supporter: isSupporter === true || isSupporter === 'true',
        user_badge: userBadge?.trim() || null,
        fcm_token: fcmToken?.trim() || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async list({ limit = 50, status } = {}) {
    const capped = Math.min(limit, 200);
    const db = requireSupabaseAdmin();

    let query = db
      .from('citizen_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(capped);

    if (status === 'open') {
      query = query.in('status', ['new', 'reviewing']);
    } else if (status === 'closed') {
      query = query.in('status', ['resolved', 'dismissed']);
    } else if (status && VALID_STATUSES.has(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async updateStatus(id, status, resolutionMessage) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error('Geçersiz durum.');
    }

    const patch = { status };
    if (resolutionMessage !== undefined) {
      const trimmed = String(resolutionMessage || '').trim();
      if (trimmed.length > 2000) {
        throw new Error('Yanıt mesajı en fazla 2000 karakter olabilir.');
      }
      patch.resolution_message = trimmed || null;
    }

    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('citizen_reports')
      .update(patch)
      .eq('id', id)
      .select(
        'id, status, category, message, resolution_message, contact_name, contact_email, image_urls, platform, app_version, created_at, fcm_token',
      )
      .single();

    if (error) throw new Error(error.message);

    // Durum güncellendiğinde sadece ihbarı gönderen cihaza push bildirimi gönder
    if (data && data.fcm_token) {
      this._sendStatusNotification(data).catch((err) => {
        console.error('[citizen-reports] Push bildirim gönderim hatası:', err.message);
      });
    }

    return data;
  }

  async _sendStatusNotification(report) {
    if (!report?.fcm_token) return;
    try {
      const fcmService = require('./fcmService');
      const statusTitles = {
        reviewing: 'İhbarınız İnceleniyor 🔍',
        resolved: 'İhbarınız Çözüldü ✅',
        dismissed: 'İhbarınız Sonuçlandırıldı 📋',
        new: 'İhbarınız Alındı 📥',
      };

      const statusBodies = {
        reviewing: 'İlettiğiniz ihbar yetkililer tarafından incelemeye alındı.',
        resolved: 'İlettiğiniz konu başarıyla çözüme kavuşturuldu. Katkınız için teşekkür ederiz!',
        dismissed: 'İhbarınız incelendi ve süreç tamamlandı.',
        new: 'İhbarınız sisteme ulaştı.',
      };

      const title = statusTitles[report.status] || 'İhbar Durumu Güncellendi 📢';
      const resolutionNote = report.resolution_message?.trim();
      const baseBody = statusBodies[report.status] || 'İhbarınızın durumu güncellendi.';
      const body = resolutionNote
        ? `${baseBody}\nYanıt: ${resolutionNote}`
        : `${baseBody} Detaylar için dokunun.`;

      const result = await fcmService.sendToDevice(report.fcm_token, {
        title,
        body,
        data: {
          type: 'citizen_report',
          route: 'screen:citizen_report_tracking',
          target: 'screen:citizen_report_tracking',
          report_id: String(report.id || ''),
          status: String(report.status || ''),
        },
      });

      console.log(`[citizen-reports] Push notification sent for report ${report.id}:`, result);
    } catch (err) {
      console.error('[citizen-reports] Push notification error:', err.message);
    }
  }
}

module.exports = new CitizenReportService();
