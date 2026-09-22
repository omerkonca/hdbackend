const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();

    // 1. RLS status on all public tables
    const res = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log('\n📊 ALL PUBLIC TABLES:');
    console.table(res.rows);

    const unprotected = res.rows.filter(r => !r.rowsecurity);
    console.log('\n🚨 TABLES WITHOUT RLS (rls_disabled_in_public):', unprotected.map(r => r.tablename));

    // 2. Views in public
    const views = await client.query(`
      SELECT c.relname as view_name, c.reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v';
    `);
    console.log('\n👁️ VIEWS IN PUBLIC:', views.rows);

    // 3. Extensions in public
    const exts = await client.query(`
      SELECT e.extname, n.nspname
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE n.nspname = 'public';
    `);
    console.log('\n🧩 EXTENSIONS IN PUBLIC:', exts.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
