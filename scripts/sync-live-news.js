const { Client } = require('pg');
require('dotenv').config();
const newsService = require('../src/services/newsService');

async function syncLiveNews() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const items = await newsService.scrapeNews({ max: 120 });
  console.log(`Scraped ${items.length} items from RSS sources.`);

  let inserted = 0;
  for (const item of items) {
    if (!item.title || !item.sourceUrl) continue;
    const query = `
      INSERT INTO news_items (id, title, summary, image_url, created_at, source_url, source_name, category, is_ai_generated, is_ai_optimized)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        image_url = COALESCE(EXCLUDED.image_url, news_items.image_url),
        category = EXCLUDED.category,
        source_name = EXCLUDED.source_name;
    `;
    try {
      await client.query(query, [
        item.id,
        item.title,
        item.summary,
        item.imageUrl || null,
        item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        item.sourceUrl,
        item.sourceName,
        item.category,
        item.isAiGenerated || false,
        item.isAiOptimized || false,
      ]);
      inserted++;
    } catch (err) {
      console.warn(`Insert error for ${item.title}:`, err.message);
    }
  }
  console.log(`Successfully synced ${inserted} news into Supabase!`);

  // Verify Sabir Gazetesi news
  const res = await client.query("SELECT id, title, source_name, category, created_at FROM news_items WHERE source_name ILIKE '%Sabir%' ORDER BY created_at DESC LIMIT 10");
  console.log('\nLatest Sabir news in DB:');
  res.rows.forEach(r => console.log(' -', r.source_name, '|', r.title, '|', r.created_at, '|', r.category));

  await client.end();
}

syncLiveNews().catch(console.error);
