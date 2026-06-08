const express = require('express');
const { requireAdminToken } = require('../middlewares/auth');
const { isFcmConfigured, sendMulticast } = require('../services/fcmService');
const {
  fetchMarketingTokens,
  logPush,
  upsertDeviceToken,
} = require('../services/pushTokenService');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { token, platform, appVersion, marketingOptIn } = req.body ?? {};
    if (!token || typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ ok: false, message: 'Geçersiz token' });
    }
    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ ok: false, message: 'Geçersiz platform' });
    }

    const result = await upsertDeviceToken({
      token: token.trim(),
      platform,
      appVersion,
      marketingOptIn: marketingOptIn !== false,
    });

    if (!result.ok) {
      return res.status(500).json({ ok: false, message: result.error });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

router.post('/send', requireAdminToken, async (req, res) => {
  try {
    const { title, body, data } = req.body ?? {};
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ ok: false, message: 'Başlık ve mesaj gerekli' });
    }

    if (!isFcmConfigured()) {
      return res.status(503).json({
        ok: false,
        message: 'FCM yapılandırılmamış. Render\'da FIREBASE_SERVICE_ACCOUNT_JSON ekleyin.',
      });
    }

    const tokens = await fetchMarketingTokens();
    if (tokens.length === 0) {
      return res.json({ ok: true, sent: 0, failed: 0, message: 'Kayıtlı cihaz yok' });
    }

    const result = await sendMulticast(tokens, {
      title: title.trim(),
      body: body.trim(),
      data: data ?? {},
    });

    await logPush({
      title: title.trim(),
      body: body.trim(),
      target: 'all',
      sent: result.sent,
      failed: result.failed,
    });

    return res.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      total: tokens.length,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

router.get('/status', requireAdminToken, async (req, res) => {
  const tokens = await fetchMarketingTokens();
  return res.json({
    ok: true,
    fcmConfigured: isFcmConfigured(),
    registeredDevices: tokens.length,
  });
});

module.exports = router;
