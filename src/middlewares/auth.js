const config = require('../config');

function requireAdminToken(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== config.ADMIN_TOKEN) {
    return res.status(401).json({
      ok: false,
      message: 'Yetkisiz istek. Gecerli x-admin-token gerekli.',
    });
  }
  next();
}

module.exports = { requireAdminToken };
