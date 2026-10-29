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

    // Yalnızca bu ihbarı gönderen cihaza gider; konu/genel push yok.
    if (data?.fcm_token) {
      this._sendStatusNotification(data).catch((err) => {
        console.error('[citizen-reports] Push bildirim gönderim hatası:', err.message);
      });
    } else if (data) {
      console.warn(`[citizen-reports] Push atlandı, fcm_token yok: ${data.id}`);
    }

    return data;
  }

  async delete(id) {
    if (!id) throw new Error('Geçersiz bildirim kimliği.');
    const db = requireSupabaseAdmin();

    const { data: existing, error: fetchError } = await db
      .from('citizen_reports')
      .select('id, image_urls')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error('Kayıt bulunamadı.');

    // 5846 FSEK / 5651 kapsamında yüklenen görselleri depolama alanından da kalıcı olarak kaldır
    const urls = Array.isArray(existing.image_urls) ? existing.image_urls : [];
    const storagePaths = urls
      .map((u) => {
        if (typeof u !== 'string') return null;
        const marker = '/city-assets/';
        const idx = u.indexOf(marker);
        if (idx === -1) return null;
        return decodeURIComponent(u.slice(idx + marker.length).split('?')[0]);
      })
      .filter(Boolean);

    if (storagePaths.length > 0) {
      try {
        await db.storage.from('city-assets').remove(storagePaths);
      } catch (storageErr) {
        console.warn('[citizen-reports] Storage file removal warning:', storageErr.message);
      }
    }

    const { error: deleteError } = await db
      .from('citizen_reports')
      .delete()
      .eq('id', id);

    if (deleteError) throw new Error(deleteError.message);
    return { deleted: true, id, removedFiles: storagePaths.length };
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

      const statusLabel = {
        reviewing: 'İnceleniyor',
        resolved: 'Çözüldü',
        dismissed: 'Kapatıldı',
        new: 'Alındı',
      }[report.status] || 'Güncellendi';
      const resolutionNote = report.resolution_message?.trim() || '';
      const shortReply = resolutionNote.length > 140
        ? `${resolutionNote.slice(0, 137)}…`
        : resolutionNote;

      const title = shortReply
        ? 'İhbarınıza yanıt geldi'
        : (statusTitles[report.status] || 'İhbarınızın durumu güncellendi');
      const body = shortReply
        ? `${statusLabel}: ${shortReply}`
        : (statusBodies[report.status] || 'İhbarınızın durumu güncellendi. Takip için dokunun.');

      const reportId = String(report.id || '');
      const route = `screen:citizen_report_tracking?id=${encodeURIComponent(reportId)}`;
      const result = await fcmService.sendToDevice(report.fcm_token, {
        title,
        body,
        collapseKey: `citizen-report-${reportId}`,
        data: {
          type: 'citizen_report',
          route,
          target: route,
          report_id: reportId,
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
