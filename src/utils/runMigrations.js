const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function ensureCitizenReportsTable() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('[migrate] DATABASE_URL yok — citizen_reports tablosu otomatik kurulmadı.');
    return;
  }

  const sqlPath = path.resolve(__dirname, '../../migrations/citizen_reports.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('[migrate] citizen_reports tablosu hazır.');
  } catch (err) {
    console.error('[migrate] citizen_reports kurulumu başarısız:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { ensureCitizenReportsTable };
