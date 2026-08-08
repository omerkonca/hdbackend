const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { requireAdminToken } = require('../middlewares/auth');

/**
 * Varsayılan: Supabase Storage (city-assets) — ücretsiz kota için.
 * Cloudinary yalnızca USE_CLOUDINARY=true iken açılır (acil durum).
 */
const forceCloudinary = String(process.env.USE_CLOUDINARY || '').toLowerCase() === 'true';
const hasCloudinary =
  forceCloudinary &&
  config.CLOUDINARY.CLOUD_NAME &&
  config.CLOUDINARY.API_KEY &&
  config.CLOUDINARY.API_SECRET;

let storage;
let useSupabaseStorage = true;

if (hasCloudinary) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  cloudinary.config({
    cloud_name: config.CLOUDINARY.CLOUD_NAME,
    api_key: config.CLOUDINARY.API_KEY,
    api_secret: config.CLOUDINARY.API_SECRET,
  });
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'hepsiduzici-uploads',
      resource_type: 'auto',
      allowed_formats: [
        'jpg', 'jpeg', 'png', 'mp4', 'mov', 'webp', 'heic', 'avi', '3gp', 'mkv', 'webm',
        'JPG', 'JPEG', 'PNG', 'MP4', 'MOV', 'WEBP', 'HEIC', 'AVI', '3GP', 'MKV', 'WEBM',
      ],
    },
  });
  useSupabaseStorage = false;
  console.log('☁️  Cloudinary storage enabled (USE_CLOUDINARY=true)');
} else {
  storage = multer.memoryStorage();
  console.log('💾 Supabase Storage upload active (city-assets)');
}

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

function mimeToExt(mime, originalName) {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (fromName) return fromName;
  if (!mime) return '';
  if (mime.includes('jpeg')) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('quicktime')) return '.mov';
  if (mime.includes('webm')) return '.webm';
  return '';
}

router.post('/', requireAdminToken, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload Error:', err);
      return res.status(400).json({ ok: false, message: err.message || 'Dosya yükleme hatası.' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'Dosya seçilmedi.' });
  }

  try {
    if (useSupabaseStorage) {
      const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
      const supabase = requireSupabaseAdmin();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = mimeToExt(req.file.mimetype, req.file.originalname);
      const filename = `file-${uniqueSuffix}${ext}`;

      const { error } = await supabase.storage
        .from('city-assets')
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('city-assets')
        .getPublicUrl(filename);

      return res.json({ ok: true, fileUrl: urlData.publicUrl, filename });
    }

    return res.json({
      ok: true,
      fileUrl: req.file.path,
      filename: req.file.filename || req.file.public_id,
    });
  } catch (error) {
    console.error('❌ Upload to storage failed:', error.message);
    return res.status(500).json({
      ok: false,
      message: 'Dosya yüklenirken hata oluştu.',
      detail: error.message,
    });
  }
});

module.exports = router;
