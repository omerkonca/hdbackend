const admin = require('firebase-admin');

let initialized = false;

function ensureFirebase() {
  if (initialized) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return false;
  try {
    const serviceAccount = JSON.parse(raw);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    initialized = true;
    return true;
  } catch (err) {
    console.error('[FCM] init failed:', err.message);
    return false;
  }
}

async function sendMulticast(tokens, { title, body, data = {} }) {
  if (!ensureFirebase() || tokens.length === 0) {
    return { sent: 0, failed: tokens.length, error: 'FCM not configured or no tokens' };
  }

  const stringData = {};
  for (const [key, value] of Object.entries(data || {})) {
    stringData[String(key)] = String(value ?? '');
  }

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let sent = 0;
  let failed = 0;

  for (const batch of chunks) {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: stringData,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    sent += response.successCount;
    failed += response.failureCount;
  }

  return { sent, failed };
}

async function sendToTopic(topic, { title, body, data = {} }) {
  if (!ensureFirebase()) {
    return { success: false, error: 'FCM not configured' };
  }
  const topicName = String(topic || '').trim();
  if (!topicName) {
    return { success: false, error: 'Topic required' };
  }

  const stringData = {};
  for (const [key, value] of Object.entries(data || {})) {
    stringData[String(key)] = String(value ?? '');
  }

  try {
    const messageId = await admin.messaging().send({
      topic: topicName,
      notification: {
        title: String(title || '').trim() || 'Yeni haber',
        body: String(body || '').trim() || 'Detaylar için uygulamayı açın.',
      },
      data: stringData,
      android: { priority: 'high' },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    return { success: true, messageId };
  } catch (err) {
    console.error(`[FCM] sendToTopic(${topicName}) failed:`, err.message);
    return { success: false, error: err.message };
  }
}

function isFcmConfigured() {
  return ensureFirebase();
}

module.exports = {
  sendMulticast,
  sendToTopic,
  isFcmConfigured,
};
