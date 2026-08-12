const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAdminToken } = require('../middlewares/auth');
const { getSupabaseAdmin } = require('../utils/supabaseAdmin');

const router = express.Router();

const FILE_PATH = path.resolve(__dirname, '../../data/app_version.json');

/** Kapalı eşik — kimseyi etkilemez */
const OFF = '0.0.1';

const SEED_VERSIONS = [
  '1.2.8',
  '1.2.7',
  '1.2.6',
  '1.2.5',
  '1.2.4',
  '1.2.3',
  '1.2.2',
  '1.2.1',
  '1.2.0',
  '1.1.0',
  '1.0.0',
];

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

function normalizeVersion(raw) {
  let v = String(raw || '').trim();
  const plus = v.indexOf('+');
  if (plus >= 0) v = v.slice(0, plus);
  const dash = v.indexOf('-');
  if (dash >= 0) v = v.slice(0, dash);
  return v.trim();
}

function compareSemver(a, b) {
  const pa = normalizeVersion(a)
    .split('.')
    .map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);
  const pb = normalizeVersion(b)
    .split('.')
    .map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
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

async function listKnownVersions(policy) {
  const counts = { android: {}, ios: {}, all: {} };
  const add = (platform, version) => {
    const v = normalizeVersion(version);
    if (!v || !/^\d+\.\d+/.test(v)) return;
    const key =
      platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : null;
    if (key) {
      counts[key][v] = (counts[key][v] || 0) + 1;
    }
    counts.all[v] = (counts.all[v] || 0) + 1;
  };

  for (const p of [policy.android, policy.ios]) {
    add('all', p.latest);
    add('all', p.minSoft);
    add('all', p.minForce);
  }
  SEED_VERSIONS.forEach((v) => add('all', v));

  try {
    const db = getSupabaseAdmin();
    if (db) {
      const { data, error } = await db
        .from('device_tokens')
        .select('platform, app_version')
        .not('app_version', 'is', null)
        .limit(5000);
      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          const plat = String(row.platform || '').toLowerCase();
          add(plat.includes('ios') ? 'ios' : 'android', row.app_version);
        });
      }
    }
  } catch (err) {
    console.warn('[app-version] version scan failed:', err.message);
  }

  const sortDesc = (a, b) => compareSemver(b, a);

  const allSet = new Set(
    [
      ...Object.keys(counts.all),
      ...SEED_VERSIONS,
      policy.android.latest,
      policy.android.minSoft,
      policy.android.minForce,
      policy.ios.latest,
      policy.ios.minSoft,
      policy.ios.minForce,
    ]
      .map(normalizeVersion)
      .filter(Boolean),
  );

  const allList = [...allSet]
    .filter((v) => v !== OFF && /^\d+\.\d+/.test(v))
    .sort(sortDesc)
    .map((version) => ({
      version,
      devices: counts.all[version] || 0,
      android: counts.android[version] || 0,
      ios: counts.ios[version] || 0,
    }));

  return { all: allList };
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

/** Admin — politika + cihazlardan bilinen sürümler */
router.get('/admin', requireAdminToken, async (_req, res) => {
  try {
    const policy = readPolicy();
    const versions = await listKnownVersions(policy);
    return res.json({ ok: true, ...policy, versions, offVersion: OFF });
  } catch (err) {
    console.error('[app-version] admin read failed:', err.message);
    return res.status(500).json({ ok: false, message: 'Sürüm politikası okunamadı.' });
  }
});

module.exports = router;
