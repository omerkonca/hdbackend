/**
 * Retry oversized Cloudinary videos via compressed mp4 derivatives.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://duehxbdlpwvbpqfjyjai.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1ZWh4YmRscHd2YnBxZmp5amFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NjkzNTksImV4cCI6MjA5NjM0NTM1OX0.eWLP6yAF5t6kAOPEsGr0Iw_V1IN6t1ZMFCqNqTUHN3w';

const BUCKET = 'city-assets';
const MAP_PATH = path.join(__dirname, '../data/cloudinary-url-map.json');

const FAILED = [
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782299651/hepsiduzici-uploads/k5htugzetkbcfqflqw5x.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782663959/hepsiduzici-uploads/ytm8anbo58cj0cokoqwv.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782728906/hepsiduzici-uploads/jbj6tokxxbhgikc94yzs.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783087462/hepsiduzici-uploads/w23zvvjsnpe51t65u2zr.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783087765/hepsiduzici-uploads/ri6dexp2irhqtrsx22f6.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783515007/hepsiduzici-uploads/w1jp05ujzdlw8l8ssbfn.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783862713/hepsiduzici-uploads/af6innccbfytsyeakizf.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783863298/hepsiduzici-uploads/cpnv7skimnikqf2mckeo.mov',
];

function compressedUrl(original) {
  // Insert transformation after /upload/
  return original.replace('/video/upload/', '/video/upload/f_mp4,q_auto:eco,w_720/');
}

function targetName(url) {
  const file = url.split('/').pop().replace(/\.mov$/i, '.mp4');
  return `migrated/hepsiduzici-uploads/${file}`;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  let map = {};
  if (fs.existsSync(MAP_PATH)) map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

  for (const original of FAILED) {
    if (map[original]) {
      console.log('SKIP', original.split('/').pop());
      continue;
    }
    const src = compressedUrl(original);
    const name = targetName(original);
    try {
      console.log('GET compressed', original.split('/').pop());
      const res = await fetch(src);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`  ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
      if (buf.length > 49 * 1024 * 1024) throw new Error('still too large');

      const { error } = await supabase.storage.from(BUCKET).upload(name, buf, {
        contentType: 'video/mp4',
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
      map[original] = data.publicUrl;
      fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
      console.log('  OK', data.publicUrl);
    } catch (e) {
      console.error('  FAIL', e.message || e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
