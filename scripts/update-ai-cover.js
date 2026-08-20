const { Client } = require('pg');
require('dotenv').config();

async function updateAiNewsCover() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(
    "UPDATE news_items SET image_url = 'assets/images/ai_reporter_cover.jpg', images = ARRAY['assets/images/ai_reporter_cover.jpg'] WHERE id LIKE 'news-ai-reporter-%' OR is_ai_generated = true OR source_url LIKE '%duzici-ai-reporter%'"
  );
  console.log('Updated AI Reporter news in Supabase, rows affected:', res.rowCount);
  await client.end();
}

updateAiNewsCover().catch(console.error);
