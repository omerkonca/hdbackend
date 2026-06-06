const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://duehxbdlpwvbpqfjyjai.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_k-EcjTqZe_4kmwWLIEJX3Q_3cHt_szO';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const jsonPath = path.resolve(__dirname, '../../assets/data/city_content.json');
    console.log(`Reading city content from ${jsonPath}...`);
    
    const raw = await fs.readFile(jsonPath, 'utf8');
    const data = JSON.parse(raw);

    console.log('Upserting to Supabase table city_contents...');
    const { error } = await supabase
      .from('city_contents')
      .upsert({ id: 1, data: data, updated_at: new Date().toISOString() });

    if (error) {
      throw error;
    }
    console.log('✅ Supabase seeding completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('Detaylar için lütfen Supabase tablosunun (city_contents) oluşturulup oluşturulmadığını kontrol edin.');
  }
}

run();
