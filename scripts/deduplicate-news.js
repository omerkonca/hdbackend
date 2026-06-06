const { Client } = require('pg');
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
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Get count before
    const beforeRes = await client.query('SELECT COUNT(*) FROM news_items');
    const beforeCount = parseInt(beforeRes.rows[0].count, 10);
    console.log(`Current news items count: ${beforeCount}`);

    console.log('Running deduplication query...');
    // Distinct on source_url, keeping the one with the longest full_text, or latest created_at
    const deleteQuery = `
      DELETE FROM news_items
      WHERE id NOT IN (
        SELECT DISTINCT ON (source_url) id
        FROM news_items
        ORDER BY source_url, COALESCE(length(full_text), 0) DESC, created_at DESC
      );
    `;
    const deleteRes = await client.query(deleteQuery);
    console.log('Deduplication completed!');

    // Get count after
    const afterRes = await client.query('SELECT COUNT(*) FROM news_items');
    const afterCount = parseInt(afterRes.rows[0].count, 10);
    console.log(`New news items count: ${afterCount}`);
    console.log(`Deleted ${beforeCount - afterCount} duplicate records.`);

  } catch (err) {
    console.error('❌ Deduplication failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
