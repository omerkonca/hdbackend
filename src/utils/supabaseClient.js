const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://duehxbdlpwvbpqfjyjai.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_k-EcjTqZe_4kmwWLIEJX3Q_3cHt_szO';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL ve Key eksik! Lütfen .env dosyasını kontrol edin.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

module.exports = supabase;
