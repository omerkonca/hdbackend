const { Client } = require('pg');
const supabase = require('../utils/supabaseClient');

const VALID_CATEGORIES = new Set(['problem', 'suggestion', 'tip', 'other']);
const VALID_STATUSES = new Set(['new', 'reviewing', 'resolved', 'dismissed']);

function pgConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
  };
}

async function withPg(fn) {
  const config = pgConfig();
  if (!config) return null;
  const client = new Client(config);
  try {
    await client.connect();
    return await fn(client);
  } catch (err) {
    console.warn('[citizen-reports] PostgreSQL bağlantısı başarısız, Supabase kullanılacak:', err.message);
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

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

    const payload = {
      category,
      message: trimmed,
      contact_name: contactName?.trim() || null,
      contact_email: contactEmail?.trim() || null,
      image_urls: imageUrls.filter(Boolean),
      platform: platform || null,
      app_version: appVersion || null,
      status: 'new',
    };

    const pgRow = await withPg(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO public.citizen_reports
          (category, message, contact_name, contact_email, image_urls, platform, app_version, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          payload.category,
          payload.message,
          payload.contact_name,
          payload.contact_email,
          payload.image_urls,
          payload.platform,
          payload.app_version,
          payload.status,
        ],
      );
      return rows[0] ?? null;
    });
    if (pgRow) return pgRow;

    const { data, error } = await supabase
      .from('citizen_reports')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async list({ limit = 50, status } = {}) {
    const capped = Math.min(limit, 100);

    const pgRows = await withPg(async (client) => {
      const params = [];
      let sql = 'SELECT * FROM public.citizen_reports';
      if (status && VALID_STATUSES.has(status)) {
        params.push(status);
        sql += ` WHERE status = $${params.length}`;
      }
      params.push(capped);
      sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
      const { rows } = await client.query(sql, params);
      return rows;
    });
    if (pgRows) return pgRows;

    let query = supabase
      .from('citizen_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(capped);

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

    const pgRow = await withPg(async (client) => {
      const { rows } = await client.query(
        `UPDATE public.citizen_reports
         SET status = $1
         WHERE id = $2
         RETURNING id, status`,
        [status, id],
      );
      return rows[0] ?? null;
    });
    if (pgRow) return pgRow;

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
