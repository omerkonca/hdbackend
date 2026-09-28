require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');
const newsService = require('../src/services/newsService');

async function syncHasret() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const sources = [
    { url: 'https://www.hasretgazetesi.com.tr/rss/duzici', name: 'Hasret Gazetesi Düziçi', scope: 'duzici' },
    { url: 'https://www.hasretgazetesi.com.tr/rss', name: 'Hasret Gazetesi', scope: 'osmaniye' }
  ];

  let totalInserted = 0;
  for (const src of sources) {
    try {
      const xml = await newsService.fetchRss(src.url);
      const items = newsService.parseNewsRss(xml, { sourceName: src.name, scope: src.scope, filterDuzici: false });
      console.log(`Parsed ${items.length} items from ${src.name}`);

      for (const item of items) {
        const check = await client.query('SELECT id FROM news_items WHERE id = $1 OR source_url = $2', [item.id, item.sourceUrl]);
        if (check.rows.length === 0) {
          await client.query(
            `INSERT INTO news_items (id, title, summary, image_url, source_url, source_name, category, created_at, verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
            [item.id, item.title, item.summary, item.imageUrl, item.sourceUrl, item.sourceName, item.category, item.createdAt]
          );
          totalInserted++;
        }
      }
    } catch (e) {
      console.error(`Error syncing ${src.name}:`, e.message);
    }
  }

  console.log(`Successfully inserted ${totalInserted} Hasret items into DB.`);
  await client.end();
}

syncHasret().catch(console.error);
