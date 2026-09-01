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

async function ensureRlsSecurityOnAllTables() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('[migrate] DATABASE_URL yok — RLS güvenlik migrasyonu otomatik çalıştırılmadı.');
    return;
  }

  const sqlPath = path.resolve(__dirname, '../../migrations/enable_rls_security.sql');
  if (!fs.existsSync(sqlPath)) return;
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('[migrate] ✅ Tüm tablolarda RLS güvenlik politikaları aktif edildi.');
  } catch (err) {
    console.error('[migrate] RLS güvenlik kurulumu hatası:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = {
  ensureCitizenReportsTable,
  ensurePopupAnnouncementsTable,
  ensureRlsSecurityOnAllTables,
};
