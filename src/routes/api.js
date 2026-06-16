const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const emailService = require('../services/emailService');
const { requireAdminToken } = require('../middlewares/auth');

// Public endpoints
router.get('/city-content', apiController.getCityContent);
router.get('/pharmacies/duty', apiController.getDutyPharmacies);
router.get('/news', apiController.getNews);
router.get('/news/full-text', apiController.getNewsFullText);
router.get('/finance', apiController.getFinance);
router.get('/fuel', apiController.getFuel);
router.get('/events', apiController.getEvents);
router.get('/outages', apiController.getOutages);
router.get('/road-closures', apiController.getRoadClosures);
router.get('/weather', apiController.getWeather);
router.get('/prayers', apiController.getPrayerTimes);
router.get('/obituaries', apiController.getObituaries);
router.use('/citizen-reports', require('./citizenReports'));
router.use('/discover', require('./discoverRoutes'));
router.use('/places', require('./placesRoutes'));

// Admin endpoints
router.get('/admin/reveal-token', (req, res) => res.json({ token: require('../config').ADMIN_TOKEN }));
router.get('/admin/check', requireAdminToken, (req, res) => res.json({ ok: true, message: 'Token gecerli.' }));
router.get('/admin/email-status', requireAdminToken, (req, res) => {
  res.json({ ok: true, ...emailService.getEmailStatus() });
});
router.post('/admin/test-email', requireAdminToken, async (req, res) => {
  const result = await emailService.sendTestEmail();
  if (!result.ok) {
    return res.status(500).json({ ok: false, ...result });
  }
  return res.json({
    ok: true,
    message: 'Test e-postası gönderildi.',
    to: result.to,
    provider: result.provider,
    messageId: result.id || null,
  });
});
router.get('/backups', requireAdminToken, apiController.getBackups);
router.post('/city-content', requireAdminToken, apiController.updateCityContent);
router.post('/city-content/update-branding', requireAdminToken, apiController.updateBrandingFields);
router.post('/city-content/restore-last', requireAdminToken, apiController.restoreLastBackup);
router.post('/pharmacies/refresh', requireAdminToken, apiController.refreshPharmacies);
router.post('/news/refresh', requireAdminToken, apiController.refreshNews);
router.post('/finance/refresh', requireAdminToken, apiController.refreshFinance);
router.post('/fuel/refresh', requireAdminToken, apiController.refreshFuel);
router.post('/outages/refresh', requireAdminToken, apiController.refreshOutages);
router.post('/road-closures/refresh', requireAdminToken, apiController.refreshRoadClosures);
router.post('/obituaries/refresh', requireAdminToken, apiController.refreshObituaries);

module.exports = router;
