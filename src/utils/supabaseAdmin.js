const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let adminClient;

function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = config.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  adminClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return adminClient;
}

function requireSupabaseAdmin() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY eksik — veritabanı yazma işlemleri çalışmaz. Render ortam değişkenlerine ekleyin.',
    );
  }
  return client;
}

module.exports = { getSupabaseAdmin, requireSupabaseAdmin };
