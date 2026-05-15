const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
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
router.get('/weather', apiController.getWeather);
router.use('/discover', require('./discoverRoutes'));

// Admin endpoints
router.get('/admin/check', requireAdminToken, (req, res) => res.json({ ok: true, message: 'Token gecerli.' }));
router.get('/backups', requireAdminToken, apiController.getBackups);
router.post('/city-content', requireAdminToken, apiController.updateCityContent);
router.post('/city-content/restore-last', requireAdminToken, apiController.restoreLastBackup);
router.post('/pharmacies/refresh', requireAdminToken, apiController.refreshPharmacies);
router.post('/news/refresh', requireAdminToken, apiController.refreshNews);
router.post('/finance/refresh', requireAdminToken, apiController.refreshFinance);
router.post('/fuel/refresh', requireAdminToken, apiController.refreshFuel);
router.post('/outages/refresh', requireAdminToken, apiController.refreshOutages);

module.exports = router;
