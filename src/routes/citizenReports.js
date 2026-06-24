const express = require('express');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const config = require('../config');
const { requireAdminToken } = require('../middlewares/auth');
const citizenReportService = require('../services/citizenReportService');
const emailService = require('../services/emailService');

const router = express.Router();

let useSupabaseStorage = false;

function buildStorage() {
  if (
    config.CLOUDINARY.CLOUD_NAME &&
    config.CLOUDINARY.API_KEY &&
    config.CLOUDINARY.API_SECRET
  ) {
    cloudinary.config({
      cloud_name: config.CLOUDINARY.CLOUD_NAME,
      api_key: config.CLOUDINARY.API_KEY,
      api_secret: config.CLOUDINARY.API_SECRET,
    });
    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'hepsiduzici-citizen-reports',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
      },
    });
  }

  useSupabaseStorage = true;
  return multer.memoryStorage();
}

const upload = multer({
  storage: buildStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 3 },
});

function fileToUrl(file) {
  if (!file) return null;
  if (file.path && file.path.startsWith('http')) return file.path;
  return `/uploads/citizen-reports/${file.filename}`;
}

router.post('/', (req, res, next) => {
  upload.array('photos', 3)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        message: err.message || 'Fotoğraf yüklenemedi.',
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const category = String(req.body?.category || '').trim();
    const message = String(req.body?.message || '').trim();
    const contactName = String(req.body?.contactName || '').trim();
    const contactEmail = String(req.body?.contactEmail || '').trim();
    const platform = String(req.body?.platform || '').trim();
    const appVersion = String(req.body?.appVersion || '').trim();

    const imageUrls = [];
    if (useSupabaseStorage && req.files && req.files.length > 0) {
      const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
      const supabase = requireSupabaseAdmin();
      for (const file of req.files) {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const filename = `report-${unique}${path.extname(file.originalname)}`;
        
        const { data, error } = await supabase.storage
          .from('city-assets')
          .upload(filename, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });
          
        if (error) {
          console.error('[citizen-reports] Supabase upload failed:', error.message);
          continue;
        }
        
        const { data: urlData } = supabase.storage
          .from('city-assets')
          .getPublicUrl(filename);
          
        imageUrls.push(urlData.publicUrl);
      }
    } else {
      imageUrls.push(...(req.files || []).map(fileToUrl).filter(Boolean));
    }

    const row = await citizenReportService.create({
      category,
      message,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      imageUrls,
      platform: platform || null,
      appVersion: appVersion || null,
    });

    const emailResult = await emailService.sendCitizenReportEmail(row);
    if (!emailResult?.ok) {
      console.error(
        '[citizen-reports] e-posta gönderilemedi:',
        emailResult?.reason,
        emailResult?.detail || '',
      );
    }

    return res.json({
      ok: true,
      id: row.id,
      createdAt: row.created_at,
      emailSent: emailResult?.ok === true,
      message: 'Bildiriminiz alındı. Teşekkür ederiz.',
    });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

router.get('/', requireAdminToken, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const items = await citizenReportService.list({ status });
    return res.json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

router.patch('/:id/status', requireAdminToken, async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    const row = await citizenReportService.updateStatus(req.params.id, status);
    return res.json({ ok: true, item: row });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

module.exports = router;
