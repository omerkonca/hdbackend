const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { requireAdminToken } = require('../middlewares/auth');

const uploadDir = path.join(config.PATHS.PUBLIC_DIR, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
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
  return '.jpg';
}

router.post('/', requireAdminToken, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Upload] Multer Error:', err);
      return res.status(400).json({ ok: false, message: err.message || 'Dosya yükleme hatası.' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'Dosya seçilmedi.' });
  }

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = mimeToExt(req.file.mimetype, req.file.originalname);
  const filename = `file-${uniqueSuffix}${ext}`;

  // 1. Önce Supabase Storage Dene
  try {
    const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
    const supabase = requireSupabaseAdmin();

    const { error } = await supabase.storage
      .from('city-assets')
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (!error) {
      const { data: urlData } = supabase.storage
        .from('city-assets')
        .getPublicUrl(filename);

      if (urlData && urlData.publicUrl) {
        return res.json({ ok: true, fileUrl: urlData.publicUrl, filename });
      }
    } else {
      console.warn('[Upload] Supabase Storage failed, falling back to alternative storage:', error.message);
    }
  } catch (err) {
    console.warn('[Upload] Supabase Storage exception, falling back:', err.message);
  }

  // 2. Cloudinary Dene (Yapılandırılmışsa)
  const hasCloudinary =
    config.CLOUDINARY.CLOUD_NAME &&
    config.CLOUDINARY.API_KEY &&
    config.CLOUDINARY.API_SECRET;

  if (hasCloudinary) {
    try {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: config.CLOUDINARY.CLOUD_NAME,
        api_key: config.CLOUDINARY.API_KEY,
        api_secret: config.CLOUDINARY.API_SECRET,
      });

      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'hepsiduzici-uploads',
            resource_type: 'auto',
            public_id: `file-${uniqueSuffix}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      const cResult = await uploadPromise;
      if (cResult && (cResult.secure_url || cResult.url)) {
        return res.json({
          ok: true,
          fileUrl: cResult.secure_url || cResult.url,
          filename: cResult.public_id,
        });
      }
    } catch (cErr) {
      console.warn('[Upload] Cloudinary upload failed, falling back to local disk:', cErr.message);
    }
  }

  // 3. Yerel Sunucu Depolama Fallback (Kesintisiz Çalışır)
  try {
    const targetFilePath = path.join(uploadDir, filename);
    fs.writeFileSync(targetFilePath, req.file.buffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/${filename}`;

    console.log('[Upload] Saved locally to:', fileUrl);
    return res.json({
      ok: true,
      fileUrl,
      filename,
    });
  } catch (diskErr) {
    console.error('❌ Upload to local disk failed:', diskErr.message);
    return res.status(500).json({
      ok: false,
      message: 'Dosya kaydedilemedi.',
      detail: diskErr.message,
    });
  }
});

module.exports = router;
