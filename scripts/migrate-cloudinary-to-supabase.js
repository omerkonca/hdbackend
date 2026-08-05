/**
 * Cloudinary -> Supabase Storage migration (one-shot).
 * Usage: node scripts/migrate-cloudinary-to-supabase.js
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

const URLS = [
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782299337/hepsiduzici-uploads/chxvq3trp9wlvwe2swl1.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782324915/hepsiduzici-uploads/ra5zgqniyujggvoozktr.webp',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782324917/hepsiduzici-uploads/tujfbgptyousdp3prk62.webp',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782324921/hepsiduzici-uploads/yyhrcvghnojfv9rwnhbi.webp',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782324932/hepsiduzici-uploads/jl0vb5jgzbegozzsbcko.webp',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782324935/hepsiduzici-uploads/azq67yoxu7fhg99on4kn.webp',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782324937/hepsiduzici-uploads/jqrsf6rlu2zodgo7lsyr.webp',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1782728910/hepsiduzici-uploads/mjbyr6pcqqp13qvmpsj9.png',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1783086412/hepsiduzici-uploads/fxp7vpz0tr2ca8zvmbph.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1783086668/hepsiduzici-uploads/peqfhcarj7eud1ks74s4.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1783862753/hepsiduzici-uploads/r0zamoxplknnwwyurjr5.jpg',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782033540/hepsiduzici-uploads/jzr6f2xtlq1k0inmgqx1.mp4',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782033655/hepsiduzici-uploads/sozliwl7c1hqn7znuhdp.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782299412/hepsiduzici-uploads/i7i7bnaozetpwwntmqsa.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782299651/hepsiduzici-uploads/k5htugzetkbcfqflqw5x.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782663959/hepsiduzici-uploads/ytm8anbo58cj0cokoqwv.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782664120/hepsiduzici-uploads/zqfb4j7lvfvrmqtn7tqh.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782664132/hepsiduzici-uploads/mn6xmpbwrpt7dbnilu37.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782664153/hepsiduzici-uploads/udvzqlk8rbofwkrb5roh.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1782728906/hepsiduzici-uploads/jbj6tokxxbhgikc94yzs.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783086449/hepsiduzici-uploads/rorg1o26ho37yiwonsgp.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783087462/hepsiduzici-uploads/w23zvvjsnpe51t65u2zr.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783087723/hepsiduzici-uploads/n9fu4cpyck9d3616ygc1.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783087765/hepsiduzici-uploads/ri6dexp2irhqtrsx22f6.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783515007/hepsiduzici-uploads/w1jp05ujzdlw8l8ssbfn.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783696903/hepsiduzici-uploads/qhw0uwinzautbhzc4r65.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783862713/hepsiduzici-uploads/af6innccbfytsyeakizf.mov',
  'https://res.cloudinary.com/dbdlspayw/video/upload/v1783863298/hepsiduzici-uploads/cpnv7skimnikqf2mckeo.mov',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1785515452/hepsiduzici-citizen-reports/wub0jy8wlj3rqsq2gxqb.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1785515452/hepsiduzici-citizen-reports/lhmzzyxhtn15b1b8hsqs.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1785515453/hepsiduzici-citizen-reports/uqiza2uamx3u9msnxmpo.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1781360504/hepsiduzici-citizen-reports/gifetnbv8uj90cjjj3fy.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1785769658/hepsiduzici-citizen-reports/xv7wa8hhbah2g3afutdw.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1785769659/hepsiduzici-citizen-reports/i1ydjyxagqmvnhflzlw4.jpg',
  'https://res.cloudinary.com/dbdlspayw/image/upload/v1785769661/hepsiduzici-citizen-reports/azyiei7dakp9mvtqiaex.jpg',
];

function guessContentType(url) {
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function targetName(url) {
  const parts = url.split('/');
  const file = parts[parts.length - 1];
  const folder = parts[parts.length - 2] || 'migrated';
  return `migrated/${folder}/${file}`;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  let map = {};
  if (fs.existsSync(MAP_PATH)) {
    try {
      map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
    } catch (_) {}
  }

  console.log(`Migrating ${URLS.length} assets -> ${BUCKET}`);
  let ok = 0;
  let fail = 0;

  for (const url of URLS) {
    if (map[url]) {
      console.log(`SKIP already mapped: ${url.split('/').pop()}`);
      ok++;
      continue;
    }

    const name = targetName(url);
    const contentType = guessContentType(url);

    try {
      console.log(`GET ${url.split('/').pop()} ...`);
      const buf = await download(url);
      console.log(`  ${(buf.length / 1024 / 1024).toFixed(1)} MB -> ${name}`);

      const { error } = await supabase.storage.from(BUCKET).upload(name, buf, {
        contentType,
        upsert: true,
      });
      if (error) throw error;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
      map[url] = data.publicUrl;
      fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2), 'utf8');
      ok++;
      console.log(`  OK ${data.publicUrl}`);
    } catch (e) {
      fail++;
      console.error(`  FAIL ${e.message || e}`);
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail}`);
  console.log(`Map: ${MAP_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
