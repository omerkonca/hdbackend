const { Client } = require('pg');
require('dotenv').config();
async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("SELECT id, title, source_name, category, created_at FROM news_items WHERE source_name ILIKE $1 ORDER BY created_at DESC LIMIT 10", ['%Sabir Gazetesi Düziçi%']);
  console.log('Count:', res.rows.length);
  res.rows.forEach(r => console.log(' -', r.title, '|', r.created_at, '|', r.category));
  await client.end();
}
check().catch(console.error);
