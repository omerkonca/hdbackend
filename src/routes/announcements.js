const express = require('express');
const publisherAnnouncementService = require('../services/publisherAnnouncementService');
const { requireAdminToken } = require('../middlewares/auth');

const router = express.Router();

/** Aktif yayıncı duyuruları (uygulama) */
router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 40);
    const items = await publisherAnnouncementService.listPublic({ limit });
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/** Admin: tüm duyurular */
router.get('/admin/all', requireAdminToken, async (req, res) => {
  try {
    const items = await publisherAnnouncementService.listAdmin();
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/** Tek duyuru */
router.get('/:id', async (req, res) => {
  try {
    const item = await publisherAnnouncementService.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ ok: false, message: 'Duyuru bulunamadı' });
    }
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/** Admin: yeni duyuru oluştur */
router.post('/', requireAdminToken, async (req, res) => {
  try {
    const { title, summary, body, imageUrl, isPinned, sendPush } = req.body ?? {};
    const item = await publisherAnnouncementService.create({
      title,
      summary,
      body,
      imageUrl,
      isPinned,
    });

    let push = null;
    if (sendPush === true) {
      push = await publisherAnnouncementService.sendPushForAnnouncement(item);
    }

    return res.json({ ok: true, item, push });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

/** Admin: güncelle */
router.put('/:id', requireAdminToken, async (req, res) => {
  try {
    const item = await publisherAnnouncementService.update(req.params.id, req.body ?? {});
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

/** Admin: yayından kaldır */
router.delete('/:id', requireAdminToken, async (req, res) => {
  try {
    const item = await publisherAnnouncementService.deactivate(req.params.id);
    return res.json({ ok: true, item });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

/** Admin: mevcut duyuru için push gönder */
router.post('/:id/push', requireAdminToken, async (req, res) => {
  try {
    const item = await publisherAnnouncementService.getById(req.params.id, { admin: true });
    if (!item) {
      return res.status(404).json({ ok: false, message: 'Duyuru bulunamadı' });
    }
    const push = await publisherAnnouncementService.sendPushForAnnouncement(item);
    return res.json({ ok: true, push });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;
