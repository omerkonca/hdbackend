const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is missing in .env!');
  process.exit(1);
}

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  try {
    console.log('🔌 Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const sqlPath = path.resolve(__dirname, '../migrations/enable_rls_security.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔒 Applying Row Level Security (RLS) policies to all tables...');
    await client.query(sql);
    console.log('🎉 SUCCESS: Row Level Security (RLS) is now ENABLED on all public tables with secure policies!');

    // List all public tables and their RLS status to verify
    const verifySql = `
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `;
    const res = await client.query(verifySql);
    console.log('\n📊 Public Tables & RLS Status:');
    console.table(res.rows);

  } catch (err) {
    console.error('❌ Failed to apply RLS fix:', err.message);
  } finally {
    await client.end();
  }
}

main();
