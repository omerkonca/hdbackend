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
  } catch (e) {
    console.error('[FCM] init failed:', e.message);
    return false;
  }
}

async function sendMulticast(tokens, { title, body, data = {} }) {
  if (!ensureFirebase() || tokens.length === 0) {
    return { sent: 0, failed: tokens.length, error: 'FCM not configured or no tokens' };
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
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    sent += response.successCount;
    failed += response.failureCount;

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM] Send failed to token: ${batch[idx].substring(0, 30)}... Error:`, resp.error);
        }
      });
    }
  }

  return { sent, failed };
}

function isFcmConfigured() {
  return ensureFirebase();
}

async function sendToTopic(topic, { title, body, data = {} }) {
  if (!ensureFirebase()) {
    return { success: false, error: 'FCM not configured' };
  }
  try {
    const response = await admin.messaging().send({
      topic,
      notification: { title, body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`[FCM] Send to topic ${topic} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendMulticast, isFcmConfigured, sendToTopic };
