const express = require('express');
const router = express.Router();
const discoverService = require('../services/discoverService');

router.get('/', async (req, res) => {
  try {
    const data = await discoverService.getDiscoverData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/search', async (req, res) => {
  const { q } = req.query;
  try {
    const results = await discoverService.searchPlaces(q || '');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
