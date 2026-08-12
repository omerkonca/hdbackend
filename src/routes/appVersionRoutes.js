const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAdminToken } = require('../middlewares/auth');

const router = express.Router();

const FILE_PATH = path.resolve(__dirname, '../../data/app_version.json');

const DEFAULT_POLICY = {
  android: {
    latest: '1.2.8',
    minSoft: '1.2.0',
    minForce: '1.1.0',
    storeUrl:
      'https://play.google.com/store/apps/details?id=net.hepsiduzici.hepsi_duzici',
  },
  ios: {
    latest: '1.2.8',
    minSoft: '1.2.0',
    minForce: '1.1.0',
    storeUrl: 'https://apps.apple.com/app/id6775205369',
  },
  title: 'Güncelleme gerekli',
  message:
    'Uygulamayı güvenle kullanmaya devam etmek için lütfen güncelleyin.',
  forceTitle: 'Zorunlu güncelleme',
  forceMessage:
    'Bu sürüm artık desteklenmiyor. Devam etmek için güncellemeniz gerekir.',
};

function ensureFile() {
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULT_POLICY, null, 2), 'utf8');
  }
}

function readPolicy() {
  ensureFile();
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_POLICY,
      ...parsed,
      android: { ...DEFAULT_POLICY.android, ...(parsed.android || {}) },
      ios: { ...DEFAULT_POLICY.ios, ...(parsed.ios || {}) },
    };
  } catch (err) {
    console.error('[app-version] read failed:', err.message);
    return { ...DEFAULT_POLICY };
  }
}

function writePolicy(policy) {
  ensureFile();
  const tmp = `${FILE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(policy, null, 2), 'utf8');
  fs.renameSync(tmp, FILE_PATH);
}

function normalizePlatform(input, fallback) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    latest: String(src.latest || fallback.latest).trim(),
    minSoft: String(src.minSoft || fallback.minSoft).trim(),
    minForce: String(src.minForce || fallback.minForce).trim(),
    storeUrl: String(src.storeUrl || fallback.storeUrl).trim(),
  };
}

/** Public — uygulama açılışında çekilir */
router.get('/', (_req, res) => {
  const policy = readPolicy();
  res.set('Cache-Control', 'public, max-age=60');
  return res.json({ ok: true, ...policy });
});

/** Admin — panelden kaydet */
router.put('/', requireAdminToken, (req, res) => {
  try {
    const body = req.body || {};
    const current = readPolicy();
    const next = {
      android: normalizePlatform(body.android, current.android),
      ios: normalizePlatform(body.ios, current.ios),
      title: String(body.title || current.title).trim(),
      message: String(body.message || current.message).trim(),
      forceTitle: String(body.forceTitle || current.forceTitle).trim(),
      forceMessage: String(body.forceMessage || current.forceMessage).trim(),
    };
    writePolicy(next);
    return res.json({ ok: true, ...next });
  } catch (err) {
    console.error('[app-version] write failed:', err.message);
    return res.status(500).json({ ok: false, message: 'Sürüm politikası kaydedilemedi.' });
  }
});

/** Admin — mevcut değeri oku (auth) */
router.get('/admin', requireAdminToken, (_req, res) => {
  return res.json({ ok: true, ...readPolicy() });
});

module.exports = router;
