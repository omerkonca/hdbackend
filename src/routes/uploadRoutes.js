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
  // Local storage fallback
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../../public/uploads'));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
  console.log('📁 Local storage initialized (fallback)');
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
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'Dosya seçilmedi.' });
  }
  
  // Cloudinary'de req.file.path bir web URL'idir (https://...). 
  // Yerel disk storage'da ise absolute path'tir. O yüzden http ile başlayıp başlamadığına bakıyoruz.
  const fileUrl = (req.file.path && req.file.path.startsWith('http')) 
    ? req.file.path 
    : `/uploads/${req.file.filename}`;
    
  res.json({ ok: true, fileUrl, filename: req.file.filename || req.file.public_id });
});

module.exports = router;
