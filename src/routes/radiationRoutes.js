const express = require('express');
const { getRadiationMap } = require('../services/radiationService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const force = req.query.refresh === '1' || req.query.refresh === 'true';
    const data = await getRadiationMap({ forceRefresh: force });
    return res.json({
      ok: true,
      ...data,
      disclaimer:
        'Doğal arka plan genellikle 50–150 nSv/s civarındadır. Yağmur değerleri yükseltebilir. Resmi acil durum kaynağı NDK / EURDEP’tir.',
      officialMapUrl: 'https://remap.jrc.ec.europa.eu/Advanced.aspx',
      ndkUrl: 'https://www.ndk.gov.tr/radyasyon-izleme-ve-uyari-sistemi-agi-radisa',
    });
  } catch (err) {
    console.error('[radiation]', err.message);
    return res.status(500).json({ ok: false, message: 'Radyasyon verisi alınamadı.' });
  }
});

module.exports = router;
