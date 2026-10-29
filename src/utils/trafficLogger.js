const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getDbPool } = require('./dbPool');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');

function extractClientIp(req) {
  const xff = req?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return (
    req?.headers?.['cf-connecting-ip'] ||
    req?.headers?.['x-real-ip'] ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    'unknown'
  );
}

/**
 * 5651 sayılı Kanun kapsamında Yer Sağlayıcı trafik bilgisi (IP, zaman damgası, işlem türü, içerik ID)
 * kaydını tutar.
 */
async function logTrafficEvent(req, { action, resourceType, resourceId, metadata = {} }) {
  try {
    const ip = String(extractClientIp(req));
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
    const port = req?.socket?.remotePort ? Number(req.socket.remotePort) : null;
    const userAgent = String(req?.headers?.['user-agent'] || '').slice(0, 500);
    const timestamp = new Date().toISOString();

    const entry = {
      timestamp,
      action: String(action || 'ugc_create'),
      resource_type: String(resourceType || 'unknown'),
      resource_id: String(resourceId || ''),
      client_ip: ip,
      ip_hash: ipHash,
      client_port: port,
      user_agent: userAgent,
      metadata,
    };

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS traffic_logs_5651 (
            id BIGSERIAL PRIMARY KEY,
            action TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT,
            client_ip TEXT,
            ip_hash TEXT,
            client_port INT,
            user_agent TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `);
        await pool.query(
          `INSERT INTO traffic_logs_5651 (
            action, resource_type, resource_id, client_ip, ip_hash, client_port, user_agent, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            entry.action,
            entry.resource_type,
            entry.resource_id,
            entry.client_ip,
            entry.ip_hash,
            entry.client_port,
            entry.user_agent,
            JSON.stringify(entry.metadata || {}),
          ],
        );
      } catch (dbErr) {
        console.warn('[5651-TrafficLog] DB write warning:', dbErr.message);
      }
    }

    try {
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
      const logFile = path.join(LOG_DIR, 'traffic-5651.jsonl');
      fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (_) {
      // Salt-okunur dosya sistemlerinde standart çıktıya yaz
      console.log('[5651-TrafficLog]', JSON.stringify(entry));
    }
  } catch (err) {
    console.error('[5651-TrafficLog] Error:', err.message);
  }
}

module.exports = {
  extractClientIp,
  logTrafficEvent,
};

