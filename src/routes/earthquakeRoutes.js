const express = require('express');
const { fetchEarthquakes, getEarthquakeStats, recordFeltVote } = require('../services/earthquakeService');

const router = express.Router();

// GET /api/earthquakes (Canlı Deprem Listesi)
router.get('/', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const limit = parseInt(req.query.limit || '100', 10);
    const minMagnitude = parseFloat(req.query.minMag || '0');
    const maxDistanceKm = parseFloat(req.query.maxDist || '99999');

    let list = await fetchEarthquakes(forceRefresh);

    if (minMagnitude > 0) {
      list = list.filter(q => q.magnitude >= minMagnitude);
    }
    if (maxDistanceKm < 90000) {
      list = list.filter(q => q.distanceKm <= maxDistanceKm);
    }

    list = list.slice(0, limit);

    return res.json({
      ok: true,
      count: list.length,
      timestamp: new Date().toISOString(),
      earthquakes: list,
    });
  } catch (err) {
    console.error('❌ /api/earthquakes error:', err);
    return res.status(500).json({ ok: false, message: 'Deprem verileri alınamadı.' });
  }
});

// GET /api/earthquakes/stats (Sismik İstatistikler)
router.get('/stats', async (req, res) => {
  try {
    const stats = await getEarthquakeStats();
    return res.json({ ok: true, stats });
  } catch (err) {
    console.error('❌ /api/earthquakes/stats error:', err);
    return res.status(500).json({ ok: false, message: 'İstatistikler hesaplanamadı.' });
  }
});

// POST /api/earthquakes/felt ("Hissedildi mi?" Oylaması)
router.post('/felt', (req, res) => {
  try {
    const { quakeId, intensityType } = req.body || {};
    if (!quakeId) {
      return res.status(400).json({ ok: false, message: 'quakeId gerekli.' });
    }
    const updatedVotes = recordFeltVote(quakeId, intensityType || 'soft');
    return res.json({ ok: true, votes: updatedVotes });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
