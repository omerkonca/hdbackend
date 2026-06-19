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

-- 1.5. Şehir İçerikleri Yedekleri (City Content Backups) Tablosu
CREATE TABLE IF NOT EXISTS city_content_backups (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT
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
  category TEXT DEFAULT 'Osmaniye',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE news_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Osmaniye';

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

-- 4. Vefat kayıtları
CREATE TABLE IF NOT EXISTS obituary_items (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  death_date TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL DEFAULT 'osmaniye',
  detail TEXT DEFAULT '',
  district TEXT DEFAULT '',
  neighborhood TEXT DEFAULT '',
  condolence_address TEXT DEFAULT '',
  burial_place TEXT DEFAULT '',
  age INT,
  source TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  detail_url TEXT DEFAULT '',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obituary_items_death_date ON obituary_items(death_date DESC);
CREATE INDEX IF NOT EXISTS idx_obituary_items_scope ON obituary_items(scope);
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
