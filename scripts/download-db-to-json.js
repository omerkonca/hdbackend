const { createClient } = require('@supabase/supabase-js');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://duehxbdlpwvbpqfjyjai.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_k-EcjTqZe_4kmwWLIEJX3Q_3cHt_szO';

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGETS = [
  path.resolve(__dirname, '../data/city_content.json'),
  path.resolve(__dirname, '../../assets/data/city_content.json'),
];

async function run() {
  try {
    console.log('Fetching latest city content from Supabase...');
    const { data, error } = await supabase
      .from('city_contents')
      .select('data')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.data) {
      console.log('❌ Database is empty or row not found.');
      return;
    }

    const content = data.data;
    const pretty = JSON.stringify(content, null, 2) + '\n';

    for (const target of TARGETS) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, pretty, 'utf8');
      console.log(`✅ Saved to: ${target}`);
    }
    console.log('🎉 Database content successfully pulled to local JSON files!');
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
  }
}

run();
