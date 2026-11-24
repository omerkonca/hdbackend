const express = require('express');
const { requireAdminToken } = require('../middlewares/auth');
const listingRequestService = require('../services/listingRequestService');
const emailService = require('../services/emailService');
const { extractClientIp, logTrafficEvent } = require('../utils/trafficLogger');

const router = express.Router();

// Basit IP başına sınır: 1 saatte en fazla 5 talep (spam koruması).
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

router.post('/', async (req, res) => {
  try {
    const ip = String(extractClientIp(req));
    if (isRateLimited(ip)) {
      return res.status(429).json({
        ok: false,
        message: 'Çok fazla talep gönderildi. Lütfen biraz sonra tekrar deneyin.',
      });
    }

    const body = req.body || {};
    const { row, duplicate } = await listingRequestService.create({
      listingType: body.listingType,
      profession: body.profession,
      contactName: body.contactName,
      phone: body.phone,
      note: body.note,
      platform: body.platform,
      appVersion: body.appVersion,
    });

    if (!duplicate) {
      await logTrafficEvent(req, {
        action: 'listing_request_create',
        resourceType: 'listing_request',
        resourceId: row.id,
        metadata: { listingType: row.listing_type },
      });
      emailService.sendListingRequestEmail(row).then((r) => {
        if (!r?.ok) console.error('[listing-requests] e-posta gönderilemedi:', r?.reason, r?.detail || '');
      }).catch(() => {});
    }

    return res.json({
      ok: true,
      id: row.id,
      message: 'Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.',
    });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

router.get('/', requireAdminToken, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const items = await listingRequestService.list({ status });
    return res.json({ ok: true, items });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

router.patch('/:id', requireAdminToken, async (req, res) => {
  try {
    const body = req.body || {};
    const item = await listingRequestService.update(req.params.id, {
      status: body.status !== undefined ? String(body.status) : undefined,
      adminNote: Object.prototype.hasOwnProperty.call(body, 'adminNote') ? body.adminNote : undefined,
    });
    return res.json({ ok: true, item });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

router.delete('/:id', requireAdminToken, async (req, res) => {
  try {
    const result = await listingRequestService.delete(req.params.id);
    return res.json({ ok: true, ...result });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

module.exports = router;
