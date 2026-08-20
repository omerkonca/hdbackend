const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    GRANT SELECT, INSERT, UPDATE ON TABLE public.pro_subscriptions TO anon, authenticated;
    DROP POLICY IF EXISTS "Allow insert on pro_subscriptions" ON public.pro_subscriptions;
    DROP POLICY IF EXISTS "Allow upsert on pro_subscriptions" ON public.pro_subscriptions;
    DROP POLICY IF EXISTS "Allow update on pro_subscriptions" ON public.pro_subscriptions;
    CREATE POLICY "Allow all on pro_subscriptions" ON public.pro_subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  `);
  console.log('Granted all permissions on pro_subscriptions');
  await client.end();
}

run();
