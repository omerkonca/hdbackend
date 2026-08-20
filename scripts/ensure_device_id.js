const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Add device_id column if not exists
  await client.query(`
    ALTER TABLE public.pro_subscriptions 
    ADD COLUMN IF NOT EXISTS device_id text;

    CREATE INDEX IF NOT EXISTS idx_pro_subscriptions_device_id 
    ON public.pro_subscriptions (device_id);

    GRANT SELECT, INSERT, UPDATE ON TABLE public.pro_subscriptions TO anon, authenticated;
  `);

  console.log('device_id column and index ensured on pro_subscriptions');
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pro_subscriptions'
  `);
  console.table(cols.rows);
  await client.end();
}

run();
