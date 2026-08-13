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
    const url = config.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      config.SUPABASE_ANON_KEY;
    if (url && key) {
      return createClient(url, key, { auth: { persistSession: false } });
    }
    throw new Error('Supabase URL veya Key bulunamadı.');
  }
  return client;
}

module.exports = { getSupabaseAdmin, requireSupabaseAdmin };

