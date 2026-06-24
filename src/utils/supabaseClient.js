const { createClient } = require('@supabase/supabase-js');
const { getSupabaseAdmin } = require('./supabaseAdmin');
const config = require('../config');

const supabaseUrl = config.SUPABASE_URL;
const serviceAdmin = getSupabaseAdmin();
const readKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || config.SUPABASE_ANON_KEY;

if (!supabaseUrl || !readKey) {
  console.error('❌ Supabase URL ve Key eksik! Lütfen .env dosyasını kontrol edin.');
}

if (!serviceAdmin) {
  console.warn(
    '⚠️ SUPABASE_SERVICE_ROLE_KEY tanımlı değil — city content / haber yazma ve storage yükleme başarısız olabilir.',
  );
}

// Okuma: anon yeterli; yazma işlemleri requireSupabaseAdmin() kullanmalı.
const supabase = serviceAdmin || createClient(supabaseUrl, readKey, {
  auth: { persistSession: false },
});

module.exports = supabase;
