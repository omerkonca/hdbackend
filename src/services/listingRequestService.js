const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');

const TABLE = 'listing_requests';
const VALID_TYPES = new Set(['real_estate', 'auto', 'handyman', 'job', 'other']);
const VALID_STATUSES = new Set(['new', 'contacted', 'published', 'dismissed']);

function cleanText(value, max) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}

/** Türkiye cep/sabit numarası: 10 haneli (5xx / 3xx...) ya da başında 0 / 90 ile. */
function normalizePhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}

class ListingRequestService {
  async create({ listingType, profession, contactName, phone, note, platform, appVersion }) {
    const type = cleanText(listingType, 20);
    if (!VALID_TYPES.has(type)) throw new Error('Geçersiz ilan türü.');

    const name = cleanText(contactName, 80);
    if (name.length < 2) throw new Error('Lütfen adınızı yazın.');

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new Error('Lütfen geçerli bir telefon numarası yazın.');

    const prof = cleanText(profession, 60);
    if (type === 'handyman' && !prof) throw new Error('Lütfen mesleğinizi seçin.');

    const db = requireSupabaseAdmin();

    // Mükerrer gönderim koruması: aynı numara + tür son 10 dakikada geldiyse yeni satır açma.
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await db
      .from(TABLE)
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('listing_type', type)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) return { row: recent, duplicate: true };

    const { data, error } = await db
      .from(TABLE)
      .insert({
        listing_type: type,
        profession: prof || null,
        contact_name: name,
        phone: normalizedPhone,
        note: cleanText(note, 500) || null,
        platform: cleanText(platform, 20) || null,
        app_version: cleanText(appVersion, 20) || null,
        status: 'new',
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { row: data, duplicate: false };
  }

  async list({ status } = {}) {
    const db = requireSupabaseAdmin();
    let q = db.from(TABLE).select('*').order('created_at', { ascending: false }).limit(300);
    if (status && VALID_STATUSES.has(status)) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async update(id, { status, adminNote }) {
    const patch = { updated_at: new Date().toISOString() };
    if (status !== undefined) {
      if (!VALID_STATUSES.has(status)) throw new Error('Geçersiz durum.');
      patch.status = status;
    }
    if (adminNote !== undefined) patch.admin_note = cleanText(adminNote, 500) || null;

    const db = requireSupabaseAdmin();
    const { data, error } = await db.from(TABLE).update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id) {
    const db = requireSupabaseAdmin();
    const { error } = await db.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }
}

module.exports = new ListingRequestService();
module.exports.normalizePhone = normalizePhone;
