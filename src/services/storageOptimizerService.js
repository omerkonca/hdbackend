/**
 * Supabase deposundaki büyük görselleri kendiliğinden küçültür.
 *
 * Günde bir çalışır. city-assets kovasında 300 KB'tan büyük görselleri indirir,
 * küçültüp `opt/` altına bir yıllık önbellek etiketiyle yükler ve haber, duyuru,
 * açılış duyurusu ve ihbar kayıtlarındaki adresleri yenisine çevirir. Orijinal dosya
 * silinmez (geri dönüş mümkün kalsın). Supabase kısıtlıyken (402) hiçbir şeye
 * dokunmadan çıkar ve bir sonraki gün tekrar dener.
 */
const { getDbPool } = require('../utils/dbPool');
const { getSupabaseAdmin } = require('../utils/supabaseAdmin');
const { optimizeImage } = require('../utils/imageOptimizer');

const BUCKET = 'city-assets';
const MIN_BYTES = 300 * 1024;
const MAX_PER_RUN = 25;

function publicUrl(base, name) {
  return `${base}/storage/v1/object/public/${BUCKET}/${name.split('/').map(encodeURIComponent).join('/')}`;
}

async function replaceUrlEverywhere(pool, oldUrl, newUrl) {
  const results = await Promise.all([
    pool.query('UPDATE public.news_items SET image_url = $2 WHERE image_url = $1', [oldUrl, newUrl]),
    pool.query('UPDATE public.news_items SET images = array_replace(images, $1, $2) WHERE $1 = ANY(images)', [oldUrl, newUrl]),
    pool.query('UPDATE public.publisher_announcements SET image_url = $2 WHERE image_url = $1', [oldUrl, newUrl]),
    pool.query('UPDATE public.popup_announcements SET image_url = $2 WHERE image_url = $1', [oldUrl, newUrl]),
    pool.query('UPDATE public.citizen_reports SET image_urls = array_replace(image_urls, $1, $2) WHERE $1 = ANY(image_urls)', [oldUrl, newUrl]),
  ]);
  return results.reduce((s, r) => s + (r.rowCount || 0), 0);
}

async function runStorageOptimizer({ dryRun = false } = {}) {
  const pool = getDbPool();
  const db = getSupabaseAdmin();
  const base = process.env.SUPABASE_URL || require('../config').SUPABASE_URL;
  if (!pool || !db || !base) return { skipped: 'not-configured' };

  const { rows } = await pool.query(
    `SELECT o.name, (o.metadata->>'size')::bigint AS size, o.metadata->>'mimetype' AS mime
       FROM storage.objects o
      WHERE o.bucket_id = $1
        AND o.name NOT LIKE 'opt/%'
        AND (o.metadata->>'mimetype') LIKE 'image/%'
        AND (o.metadata->>'size')::bigint > $2
        AND NOT EXISTS (
          SELECT 1 FROM storage.objects o2
           WHERE o2.bucket_id = $1
             AND o2.name LIKE 'opt/' || regexp_replace(o.name, '\\.[^.]+$', '') || '.%'
        )
      ORDER BY (o.metadata->>'size')::bigint DESC
      LIMIT $3`,
    [BUCKET, MIN_BYTES, MAX_PER_RUN],
  );
  if (!rows.length) return { done: 0, pending: 0 };

  const report = [];
  for (const row of rows) {
    const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(row.name);
    if (dlErr || !blob) {
      const msg = String(dlErr?.message || dlErr || 'indirilemedi');
      // Kota kısıtlaması: bu tur için dur, yarın tekrar dene.
      if (/402|restrict|quota|exceed/i.test(msg) || dlErr?.status === 402 || dlErr?.statusCode === '402') {
        console.warn('[storage-optimizer] Supabase deposu kısıtlı, sonraki tura bırakıldı.');
        return { skipped: 'storage-restricted', pending: rows.length };
      }
      report.push({ name: row.name, error: msg });
      continue;
    }
    const input = Buffer.from(await blob.arrayBuffer());
    const opt = await optimizeImage(input, row.mime);
    if (!opt.optimized) {
      report.push({ name: row.name, skipped: 'zaten küçük' });
      continue;
    }
    const newName = `opt/${row.name.replace(/\.[^.]+$/, '')}${opt.ext}`;
    const oldUrl = publicUrl(base, row.name);
    const newUrl = publicUrl(base, newName);
    if (dryRun) {
      report.push({ name: row.name, from: input.length, to: opt.buffer.length, newName });
      continue;
    }
    const { error: upErr } = await db.storage.from(BUCKET).upload(newName, opt.buffer, {
      contentType: opt.mimetype,
      upsert: true,
      cacheControl: '31536000',
    });
    if (upErr) {
      report.push({ name: row.name, error: upErr.message });
      continue;
    }
    const updated = await replaceUrlEverywhere(pool, oldUrl, newUrl);
    report.push({ name: row.name, from: input.length, to: opt.buffer.length, updated });
  }
  const saved = report.reduce((s, r) => s + (r.from && r.to ? r.from - r.to : 0), 0);
  console.info(
    `[storage-optimizer] ${report.filter((r) => r.to).length} görsel küçültüldü, ${Math.round(saved / 1024)} KB tasarruf.`,
  );
  return { done: report.filter((r) => r.to).length, saved, report };
}

module.exports = { runStorageOptimizer };
