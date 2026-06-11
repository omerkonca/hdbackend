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

  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(__dirname, '../../public/uploads/citizen-reports'));
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `report-${unique}${path.extname(file.originalname)}`);
    },
  });
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

    const imageUrls = (req.files || []).map(fileToUrl).filter(Boolean);

    const row = await citizenReportService.create({
      category,
      message,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      imageUrls,
      platform: platform || null,
      appVersion: appVersion || null,
    });

    emailService.sendCitizenReportEmail(row).then((result) => {
      if (!result?.ok) {
        console.error('[citizen-reports] e-posta gönderilemedi:', result?.reason, result?.detail || '');
      }
    }).catch((err) => {
      console.error('[citizen-reports] e-posta gönderilemedi:', err.message);
    });

    return res.json({
      ok: true,
      id: row.id,
      createdAt: row.created_at,
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
