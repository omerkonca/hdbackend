const config = require('../config');

const MAX_FAILED_ATTEMPTS = Number(process.env.ADMIN_MAX_FAILED_ATTEMPTS || 3);
const LOCKOUT_MS = Number(process.env.ADMIN_LOCKOUT_MINUTES || 30) * 60 * 1000;

/** @type {Map<string, { failures: number, lockedUntil: number }>} */
const lockoutStore = new Map();

/** Son denemeler — hassas veri tutulmaz */
const authAttempts = [];

function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getLockoutState(clientKey) {
  const state = lockoutStore.get(clientKey);
  if (!state) {
    return { failures: 0, lockedUntil: 0 };
  }
  if (state.lockedUntil && Date.now() >= state.lockedUntil) {
    lockoutStore.delete(clientKey);
    return { failures: 0, lockedUntil: 0 };
  }
  return state;
}

function isLockedOut(clientKey) {
  const state = getLockoutState(clientKey);
  return state.lockedUntil > Date.now();
}

function getLockoutRemainingMs(clientKey) {
  const state = getLockoutState(clientKey);
  return Math.max(0, state.lockedUntil - Date.now());
}

function recordFailedAttempt(clientKey) {
  const state = getLockoutState(clientKey);
  const failures = state.failures + 1;

  if (failures >= MAX_FAILED_ATTEMPTS) {
    lockoutStore.set(clientKey, {
      failures,
      lockedUntil: Date.now() + LOCKOUT_MS,
    });
    return 0;
  }

  lockoutStore.set(clientKey, { failures, lockedUntil: 0 });
  return MAX_FAILED_ATTEMPTS - failures;
}

function clearAttempts(clientKey) {
  lockoutStore.delete(clientKey);
}

function sendLockoutResponse(res, clientKey) {
  const retryAfterSec = Math.ceil(getLockoutRemainingMs(clientKey) / 1000);
  const retryMinutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  res.set('Retry-After', String(retryAfterSec));
  return res.status(429).json({
    ok: false,
    locked: true,
    message: `3 hatalı deneme yapıldı. Giriş ${retryMinutes} dakika süreyle kilitlendi.`,
    retryAfterSeconds: retryAfterSec,
  });
}

function requireAdminToken(req, res, next) {
  const clientKey = getClientKey(req);

  if (isLockedOut(clientKey)) {
    return sendLockoutResponse(res, clientKey);
  }

  const token = req.headers['x-admin-token'];
  const expected = config.ADMIN_TOKEN;
  const match = Boolean(expected && token && token === expected);

  authAttempts.push({
    timestamp: new Date().toISOString(),
    ip: clientKey,
    success: match,
  });
  if (authAttempts.length > 50) {
    authAttempts.shift();
  }

  if (!match) {
    const remaining = recordFailedAttempt(clientKey);
    if (isLockedOut(clientKey)) {
      return sendLockoutResponse(res, clientKey);
    }
    return res.status(401).json({
      ok: false,
      message: 'Hatalı admin şifresi.',
      remainingAttempts: remaining,
    });
  }

  clearAttempts(clientKey);
  next();
}

module.exports = {
  requireAdminToken,
  authAttempts,
  getClientKey,
  isLockedOut,
  getLockoutRemainingMs,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MS,
};
