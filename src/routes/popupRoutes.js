const express = require('express');
const popupService = require('../services/popupAnnouncementService');
const { requireAdminToken } = require('../middlewares/auth');

const router = express.Router();

/**
 * Public: Mobil uygulama açılışında çağrılır.
 * Aktif olan en güncel pop-up'ı döner.
 */
router.get('/active', async (req, res) => {
  try {
    const popup = await popupService.getActivePopup();
    return res.json({ ok: true, popup });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * Admin: Tüm pop-up duyuruları listeler.
 */
router.get('/admin/all', requireAdminToken, async (req, res) => {
  try {
    const popups = await popupService.listAdmin();
    return res.json({ ok: true, popups });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * Admin: Yeni pop-up duyuru ekler.
 */
router.post('/', requireAdminToken, async (req, res) => {
  try {
    const popup = await popupService.create(req.body);
    return res.json({ ok: true, popup });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

/**
 * Admin: Pop-up günceller.
 */
router.put('/:id', requireAdminToken, async (req, res) => {
  try {
    const popup = await popupService.update(req.params.id, req.body);
    return res.json({ ok: true, popup });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

/**
 * Admin: Aktif/Pasif durumunu değiştirir.
 */
router.patch('/:id/toggle', requireAdminToken, async (req, res) => {
  try {
    const popup = await popupService.toggleActive(req.params.id);
    return res.json({ ok: true, popup });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

/**
 * Admin: Pop-up duyuruyu siler.
 */
router.delete('/:id', requireAdminToken, async (req, res) => {
  try {
    await popupService.delete(req.params.id);
    return res.json({ ok: true, message: 'Duyuru silindi' });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

module.exports = router;
