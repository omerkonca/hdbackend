const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("UPDATE pro_subscriptions SET is_active = true, expires_at = NOW() + INTERVAL '30 days', updated_at = NOW() WHERE id = 'bac0205f-b7c3-41b5-a3f5-a93d93446cc1'");
  console.log('Updated rows:', res.rowCount);
  const rows = await client.query("SELECT platform, plan, is_active, expires_at FROM pro_subscriptions WHERE id = 'bac0205f-b7c3-41b5-a3f5-a93d93446cc1'");
  console.table(rows.rows);
  await client.end();
}

run();
