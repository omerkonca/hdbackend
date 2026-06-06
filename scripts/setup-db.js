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

const sql = `
-- 1. Şehir İçerikleri (City Content) Tablosu
CREATE TABLE IF NOT EXISTS city_contents (
  id INT PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_row CHECK (id = 1)
);

-- 2. Haberler (News Items) Tablosu
CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  source_url TEXT,
  source_name TEXT,
  full_text TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Eczaneler (Pharmacies) Tablosu
CREATE TABLE IF NOT EXISTS pharmacies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_label TEXT,
  date_range TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function run() {
  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    console.log('Running SQL table creation queries...');
    await client.query(sql);
    console.log('✅ Tables created successfully or already exist!');
  } catch (err) {
    console.error('❌ Table creation failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
