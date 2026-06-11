/**
 * citizen_reports RLS politikalarını uygular.
 * Kullanım: DATABASE_URL=postgresql://... node scripts/apply-citizen-reports-rls.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL gerekli.');
    process.exit(1);
  }

  const sqlPath = path.resolve(__dirname, '../migrations/citizen_reports.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('citizen_reports RLS politikaları uygulandı.');
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
