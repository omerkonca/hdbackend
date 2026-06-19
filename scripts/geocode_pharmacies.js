/**
 * Nominatim ile eczane koordinatlarını map_corrections.json'a yazar.
 * Kullanım: node scripts/geocode_pharmacies.js
 * Opsiyonel: node scripts/geocode_pharmacies.js --force  (mevcut koordinatları da yeniler)
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const {
  CORRECTIONS_PATH,
  mapsSearchUrl,
} = require('../src/utils/mapCorrections');

const force = process.argv.includes('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bilinen adresler (eczaneler.gen.tr / belediye kaynakları)
const KNOWN_ADDRESSES = {
  'Ali İren Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Aydın Eczanesi': 'İstiklal Mahallesi, Düziçi, Osmaniye',
  'Ayşe Gül Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Ayşegül Eczanesi': 'Yeşilova Mahallesi, Düziçi, Osmaniye',
  'Büyükmert Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Cansu Eczanesi': 'İrfanlı Mahallesi, Düziçi, Osmaniye',
  'Deniz Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Dilşad Eczanesi': 'Kurtuluş Mahallesi, Düziçi, Osmaniye',
  'Düziçi Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Elmas Eczanesi': 'İstiklal Mahallesi, Düziçi, Osmaniye',
  'Fatih Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Hayat Eczanesi': 'İrfanlı Mahallesi, Düziçi, Osmaniye',
  'Metlioğlu Eczanesi': 'Refik Cesur Bulvarı No:380, Düziçi, Osmaniye',
  'Murat Eczanesi': 'İrfanlı Mah. Hasan Hüseyin Türkoğlu Cad. No:39 Düziçi Osmaniye',
  'Özkan Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Sağlık Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Şerife Eczanesi': 'Yeşilova Mahallesi, Düziçi, Osmaniye',
  'Şen Eczanesi': 'Kurtuluş Mahallesi, Düziçi, Osmaniye',
  'Yücel Eczanesi': 'İstiklal Mahallesi, Düziçi, Osmaniye',
  'Taşkın Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Sağlam Eczanesi': 'İrfanlı Mahallesi, Dr. Selahattin Beyaz Sokak, No: 4/A, Düziçi, Osmaniye',
  'Serkan Eczanesi': 'Yeşilova Mahallesi, Aydınlar Caddesi, No: 34/G, Düziçi, Osmaniye',
  'Melike Eczanesi': 'Cumhuriyet Mahallesi, Düziçi, Osmaniye',
  'Namlı Eczanesi': 'İrfanlı Mahallesi, Ilıca Caddesi, No: 100/A, Düziçi, Osmaniye',
};

async function geocode(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'tr');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'HepsiDuzici/1.0 (map-corrections; contact: hepsiduzici@local)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = await res.json();
  if (!data.length) return null;
  const hit = data[0];
  return {
    lat: Number(parseFloat(hit.lat).toFixed(6)),
    lng: Number(parseFloat(hit.lon).toFixed(6)),
    displayName: hit.display_name,
  };
}

async function main() {
  const corrections = JSON.parse(fs.readFileSync(CORRECTIONS_PATH, 'utf8'));
  if (!corrections.pharmacies) corrections.pharmacies = {};

  const names = new Set([
    ...Object.keys(corrections.pharmacies),
    ...Object.keys(KNOWN_ADDRESSES),
  ]);

  let updated = 0;
  for (const name of names) {
    const existing = corrections.pharmacies[name] || {};
    if (!force && existing.lat != null && existing.lng != null) {
      console.log(`⏭  ${name} — zaten var`);
      continue;
    }

    const address = KNOWN_ADDRESSES[name] || `${name}, Düziçi, Osmaniye, Türkiye`;
    const queries = [
      `${name}, ${address}`,
      `${name}, Düziçi, Osmaniye`,
      address,
    ];

    let result = null;
    for (const q of queries) {
      console.log(`🔍 ${name} → "${q}"`);
      result = await geocode(q);
      await sleep(1100);
      if (result) break;
    }

    if (!result) {
      console.warn(`⚠️  ${name} — koordinat bulunamadı`);
      if (!corrections.pharmacies[name]) {
        corrections.pharmacies[name] = { lat: null, lng: null, googleMapsUrl: '' };
      }
      continue;
    }

    corrections.pharmacies[name] = {
      lat: result.lat,
      lng: result.lng,
      googleMapsUrl: mapsSearchUrl(result.lat, result.lng),
    };
    console.log(`✅ ${name} → ${result.lat}, ${result.lng}`);
    updated++;
  }

  fs.writeFileSync(CORRECTIONS_PATH, JSON.stringify(corrections, null, 2) + '\n', 'utf8');

  const assetPath = path.resolve(__dirname, '../../assets/data/pharmacy_coords.json');
  fs.writeFileSync(
    assetPath,
    JSON.stringify({ pharmacies: corrections.pharmacies }, null, 2) + '\n',
    'utf8',
  );
  console.log(`\nBitti: ${updated} eczane güncellendi → ${CORRECTIONS_PATH}`);
  console.log(`Flutter asset → ${assetPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
