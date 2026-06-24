const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const config = require('../config');
const { requireAdminToken } = require('../middlewares/auth');

// Cloudinary Configuration
let storage;
let useSupabaseStorage = false;

if (config.CLOUDINARY.CLOUD_NAME && config.CLOUDINARY.API_KEY && config.CLOUDINARY.API_SECRET) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY.CLOUD_NAME,
    api_key: config.CLOUDINARY.API_KEY,
    api_secret: config.CLOUDINARY.API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'hepsiduzici-uploads',
      resource_type: 'auto', // Hem resim hem video için
      allowed_formats: [
        'jpg', 'jpeg', 'png', 'mp4', 'mov', 'webp', 'heic', 'avi', '3gp', 'mkv', 'webm',
        'JPG', 'JPEG', 'PNG', 'MP4', 'MOV', 'WEBP', 'HEIC', 'AVI', '3GP', 'MKV', 'WEBM'
      ],
    },
  });
  console.log('☁️  Cloudinary storage initialized');
} else {
  // Supabase Storage memory fallback
  storage = multer.memoryStorage();
  useSupabaseStorage = true;
  console.log('💾 Supabase storage fallback initialized');
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
});

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
      const filename = `file-${uniqueSuffix}${path.extname(req.file.originalname)}`;
      
      const { data, error } = await supabase.storage
        .from('city-assets')
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });
        
      if (error) {
        throw error;
      }
      
      const { data: urlData } = supabase.storage
        .from('city-assets')
        .getPublicUrl(filename);
        
      res.json({ ok: true, fileUrl: urlData.publicUrl, filename });
    } else {
      res.json({ ok: true, fileUrl: req.file.path, filename: req.file.filename || req.file.public_id });
    }
  } catch (error) {
    console.error('❌ Upload to storage failed:', error.message);
    res.status(500).json({ ok: false, message: 'Dosya yüklenirken hata oluştu.', detail: error.message });
  }
});

module.exports = router;
