const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("UPDATE pro_subscriptions SET is_active = true, expires_at = NOW() + INTERVAL '30 days', updated_at = NOW() WHERE platform = 'ios' AND is_sandbox = true");
  console.log('Updated rows:', res.rowCount);
  const rows = await client.query('SELECT platform, plan, is_active, is_sandbox, expires_at FROM pro_subscriptions');
  console.table(rows.rows);
  await client.end();
}

run();
