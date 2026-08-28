const { Pool } = require('pg');

let pool = null;

function getDbPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });
  return pool;
}

module.exports = { getDbPool };
