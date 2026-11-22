/**
 * Yüklenen fotoğrafları telefona uygun boyuta küçültür.
 *
 * Panelden yüklenen 2-4 MB'lık PNG/JPEG'ler her telefonda ayrı ayrı indiriliyor ve
 * Supabase veri çıkışı kotasını tüketiyordu. Burada en uzun kenarı 1600 px'e indirip
 * kaliteli JPEG'e çeviriyoruz (genelde 100-300 KB). Saydamlık gereken PNG'ler, GIF,
 * SVG ve video olduğu gibi bırakılır.
 */
let sharp = null;
try {
  sharp = require('sharp');
} catch (_) {
  sharp = null;
}

const MAX_EDGE = 1600;
const OPTIMIZABLE = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/**
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<{buffer: Buffer, mimetype: string, ext: string, optimized: boolean}>}
 */
async function optimizeImage(buffer, mimetype) {
  const type = String(mimetype || '').toLowerCase();
  if (!sharp || !OPTIMIZABLE.has(type) || !buffer?.length) {
    return { buffer, mimetype, ext: null, optimized: false };
  }
  try {
    const img = sharp(buffer, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    // Saydam PNG/WebP (logo, ikon) JPEG'e çevrilirse arka planı siyah olur: küçült ama formatı koru.
    if (meta.hasAlpha && (type === 'image/png' || type === 'image/webp')) {
      const out = await img
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      if (out.length >= buffer.length) return { buffer, mimetype, ext: null, optimized: false };
      return { buffer: out, mimetype: 'image/webp', ext: '.webp', optimized: true };
    }
    const out = await img
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    if (out.length >= buffer.length) return { buffer, mimetype, ext: null, optimized: false };
    return { buffer: out, mimetype: 'image/jpeg', ext: '.jpg', optimized: true };
  } catch (err) {
    console.warn('[imageOptimizer] küçültülemedi, orijinal kullanılıyor:', err.message);
    return { buffer, mimetype, ext: null, optimized: false };
  }
}

module.exports = { optimizeImage };
