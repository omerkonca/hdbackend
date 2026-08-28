const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = require('pg');

let pool = null;

function getDbPool() {
  if (pool) return pool;
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  // Supabase direct connection host (db.xxx.supabase.co) bazen Render gibi IPv6 desteği olmayan
  // cloud sunucularında IPv6 üzerinden bağlanmayı deneyip ENETUNREACH verebilir.
  // Pooler bağlantısı IPv4 destekler.
  if (connectionString.includes('db.duehxbdlpwvbpqfjyjai.supabase.co:5432')) {
    connectionString = connectionString.replace(
      'db.duehxbdlpwvbpqfjyjai.supabase.co:5432',
      'aws-1-ap-northeast-1.pooler.supabase.com:6543'
    );
    if (!connectionString.includes('postgres.duehxbdlpwvbpqfjyjai')) {
      connectionString = connectionString.replace(
        'postgresql://postgres:',
        'postgresql://postgres.duehxbdlpwvbpqfjyjai:'
      );
    }
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });

  pool.on('error', (err) => {
    console.error('[dbPool] Unexpected error on idle client:', err.message);
  });

  return pool;
}

module.exports = { getDbPool };
