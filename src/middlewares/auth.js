const config = require('../config');

const authAttempts = [];

function requireAdminToken(req, res, next) {
  const token = req.headers['x-admin-token'];
  const expected = config.ADMIN_TOKEN;
  const match = token === expected;
  
  authAttempts.push({
    timestamp: new Date().toISOString(),
    ip: req.ip || req.headers['x-forwarded-for'],
    receivedLength: token ? token.length : 0,
    receivedObfuscated: token ? (token.length > 3 ? token.substring(0, 2) + '...' + token.substring(token.length - 1) : '***') : null,
    expectedLength: expected ? expected.length : 0,
    expectedObfuscated: expected ? (expected.length > 3 ? expected.substring(0, 2) + '...' + expected.substring(expected.length - 1) : '***') : null,
    match
  });
  if (authAttempts.length > 30) {
    authAttempts.shift();
  }

  console.log('[auth-debug] Received token:', JSON.stringify(token), 'Expected token:', JSON.stringify(config.ADMIN_TOKEN));
  if (!token || !match) {
    return res.status(401).json({
      ok: false,
      message: 'Yetkisiz istek. Gecerli x-admin-token gerekli.',
    });
  }
  next();
}

module.exports = { requireAdminToken, authAttempts };
