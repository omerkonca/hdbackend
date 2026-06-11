const supabase = require('../utils/supabaseClient');

const VALID_CATEGORIES = new Set(['problem', 'suggestion', 'tip', 'other']);
const VALID_STATUSES = new Set(['new', 'reviewing', 'resolved', 'dismissed']);

class CitizenReportService {
  async create({
    category,
    message,
    contactName,
    contactEmail,
    imageUrls = [],
    platform,
    appVersion,
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

    const { data, error } = await supabase
      .from('citizen_reports')
      .insert({
        category,
        message: trimmed,
        contact_name: contactName?.trim() || null,
        contact_email: contactEmail?.trim() || null,
        image_urls: imageUrls.filter(Boolean),
        platform: platform || null,
        app_version: appVersion || null,
        status: 'new',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async list({ limit = 50, status } = {}) {
    let query = supabase
      .from('citizen_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (status && VALID_STATUSES.has(status)) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async updateStatus(id, status) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error('Geçersiz durum.');
    }
    const { data, error } = await supabase
      .from('citizen_reports')
      .update({ status })
      .eq('id', id)
      .select('id, status')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new CitizenReportService();
