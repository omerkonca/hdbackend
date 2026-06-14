/**
 * map_corrections.json → city_content.json (backend + flutter assets) koordinat senkronu.
 * Kullanım: node scripts/sync_map_coords.js
 */
const fs = require('fs');
const path = require('path');
const {
  enrichExploreWithCorrections,
  norm,
  loadCorrections,
  mapsSearchUrl,
} = require('../src/utils/mapCorrections');

const TARGETS = [
  path.resolve(__dirname, '../data/city_content.json'),
  path.resolve(__dirname, '../../assets/data/city_content.json'),
];

function fuzzyMatchPlace(name, lookup) {
  const n = norm(name);
  if (lookup.has(n)) return lookup.get(n);

  for (const [key, value] of lookup.entries()) {
    if (n.includes(key) || key.includes(n)) return value;
  }
  return null;
}

function syncFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Dosya yok, atlanıyor: ${filePath}`);
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const before = JSON.stringify(data);
  const enriched = enrichExploreWithCorrections(data);
  const corrections = loadCorrections();
  const lookup = new Map();
  for (const [key, value] of Object.entries(corrections.places || {})) {
    lookup.set(norm(key), value);
  }

  let patched = 0;
  if (enriched.explore?.categories) {
    for (const cat of enriched.explore.categories) {
      for (const place of cat.places || []) {
        const match = fuzzyMatchPlace(place.name, lookup);
        if (!match?.lat || !match?.lng) continue;
        const changed =
          place.lat !== match.lat ||
          place.lng !== match.lng ||
          (match.googleMapsUrl && place.googleMapsUrl !== match.googleMapsUrl);
        if (changed) patched++;
        place.lat = match.lat;
        place.lng = match.lng;
        if (!place.googleMapsUrl || place.googleMapsUrl === '') {
          place.googleMapsUrl = match.googleMapsUrl || mapsSearchUrl(match.lat, match.lng);
        }
      }
    }
  }

  if (enriched.explore?.suggestions) {
    for (const suggestion of enriched.explore.suggestions) {
      for (const place of suggestion.places || []) {
        const match = fuzzyMatchPlace(place.name, lookup);
        if (!match?.lat || !match?.lng) continue;
        place.lat = match.lat;
        place.lng = match.lng;
        if (!place.googleMapsUrl) {
          place.googleMapsUrl = match.googleMapsUrl || mapsSearchUrl(match.lat, match.lng);
        }
        patched++;
      }
    }
  }

  const after = JSON.stringify(enriched);
  if (before !== after) {
    fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2) + '\n', 'utf8');
    console.log(`✅ ${filePath} — ${patched} yer güncellendi`);
  } else {
    console.log(`⏭  ${filePath} — değişiklik yok`);
  }
  return patched;
}

let total = 0;
for (const target of TARGETS) {
  total += syncFile(target);
}
console.log(`\nToplam ${total} koordinat düzeltmesi uygulandı.`);
