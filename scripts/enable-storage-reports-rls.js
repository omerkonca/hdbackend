require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    
    const sql = `
      DROP POLICY IF EXISTS "Anon Insert for city-assets" ON storage.objects;
      CREATE POLICY "Anon Insert for city-assets" ON storage.objects
        FOR INSERT TO anon, authenticated
        WITH CHECK (bucket_id = 'city-assets');

      DROP POLICY IF EXISTS "Anon Select for city-assets" ON storage.objects;
      CREATE POLICY "Anon Select for city-assets" ON storage.objects
        FOR SELECT TO anon, authenticated
        USING (bucket_id = 'city-assets');
    `;
    await client.query(sql);
    console.log('✅ Successfully enabled public/anon insert & select on city-assets storage bucket!');
  } catch (err) {
    console.error('❌ Error applying storage RLS:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
