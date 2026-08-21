const express = require('express');
const router = express.Router();
const studioService = require('../services/studioService');

// Son haberleri getir
router.get('/recent-news', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const news = await studioService.getRecentNews(limit);
    res.json({ ok: true, data: news });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Yapay zeka ile BPT formatına dönüştür
router.post('/ai-format', async (req, res) => {
  try {
    const { title, content, location } = req.body;
    if (!title && !content) {
      return res.status(400).json({ ok: false, error: 'Başlık veya içerik girilmelidir.' });
    }
    const result = await studioService.aiFormatStory({ title, content, location });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
