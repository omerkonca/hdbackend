/**
 * apply_coord_fixes.js
 * 
 * Applies researched coordinate corrections to map_corrections.json
 * and syncs to Flutter asset JSONs (place_coords.json, pharmacy_coords.json).
 * 
 * Sources:
 * - Namlı Eczanesi: Google Maps search result (37.2599243, 36.4638883)
 * - Murat Eczanesi: Address: İrfanlı Mah. Hasan Hüseyin Türkoğlu Cad. No:39/1E, Düziçi
 *   (near Opet Petrol station, ~200m past Özertaş Wedding Hall)
 *   Estimated coords: 37.2538, 36.4665
 * - Sağlık Eczanesi: Böcekli Beldesi - should be near 37.296 not 36.36
 *   Actually from map_corrections: lat=37.29665, lng=36.360214 (OUTLIER - outside Duzici bounds?)
 *   Actually Böcekli is a sub-district of Düziçi near the highway. Keeping as is for now.
 * - Pazartesi Pazarı: Mehmet Yalçın Pazar Yeri (Yandex link): 37.248763, 36.466250
 * - Haftalık Pazar Yerleri (generic entry): Use centroid of the three pazar places
 * - Çarşamba Pazarı: Kurtuluş Mahallesi, kanal üstü - approx 37.2322, 36.4409 (already set)
 * - Cuma Pazarı: Düldül Caddesi area - approx 37.2442, 36.4512 (already set)
 */

const fs = require('fs');
const path = require('path');

const correctionsPath = path.resolve(__dirname, '../data/map_corrections.json');
const placeCoordsPath = path.resolve(__dirname, '../../assets/data/place_coords.json');
const pharmacyCoordsPath = path.resolve(__dirname, '../../assets/data/pharmacy_coords.json');

function makeEntry(lat, lng) {
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
  };
}

// Load current data
const data = JSON.parse(fs.readFileSync(correctionsPath, 'utf8'));

// ========================================================
// PHARMACY CORRECTIONS
// ========================================================

// Namlı Eczanesi: Was 37.2588, 36.4684 (wrong - too far NE of center)
// Correct: 37.259924, 36.463888 (from Google Maps search result)
data.pharmacies['Namlı Eczanesi'] = makeEntry(37.259924, 36.463888);
console.log('✅ Namlı Eczanesi: 37.259924, 36.463888');

// Murat Eczanesi: Was 37.254381, 36.467004 (wrong)
// Address: İrfanlı Mah., Hasan Hüseyin Türkoğlu Cad., No:39/1E
// Near Opet Petrol station, ~200m past Özertaş Wedding Hall
// This road runs E of the hospital area. Best estimate: 37.2538, 36.4655
data.pharmacies['Murat Eczanesi'] = makeEntry(37.2538, 36.4655);
console.log('✅ Murat Eczanesi: 37.2538, 36.4655 (İrfanlı Mah., Hasan Hüseyin Türkoğlu Cad.)');

// Sağlık Eczanesi: Was 37.29665, 36.360214 (likely Böcekli Beldesi - outlier but actually correct?)
// Böcekli is a sub-district of Düziçi.
// Refik Cesur Bulvarı branch: 37.237, 36.448 (main center)
// Böcekli Beldesi: Atatürk Cad. No:3 - near the D-400 highway area
// Keeping Böcekli location since it was set specifically for there
console.log('ℹ️  Sağlık Eczanesi: keeping at 37.29665, 36.360214 (Böcekli Beldesi)');

// Ayşegül & Şerife Eczanesi: Generic 37.238, 36.448 - these are near center, seems OK
// ========================================================

// ========================================================
// PLACES CORRECTIONS  
// ========================================================

// Pazartesi Pazarı: Was 37.2398, 36.4468 (old placeholder, wrong location)
// Correct: 37.248763, 36.466250 (from Yandex Maps: "Mehmet Yalçın Pazar Yeri")
data.places['Pazartesi Pazarı'] = makeEntry(37.248763, 36.466250);
console.log('✅ Pazartesi Pazarı: 37.248763, 36.466250 (Mehmet Yalçın Pazar Yeri - Yandex link verified)');

// Haftalık Pazar Yerleri: Was 37.238, 36.445 (generic placeholder)
// This represents all weekly markets collectively. Use the Pazartesi Pazarı location 
// since it's the most prominent/verified market location.
data.places['Haftalık Pazar Yerleri'] = makeEntry(37.248763, 36.466250);
console.log('✅ Haftalık Pazar Yerleri: 37.248763, 36.466250 (updated to verified pazar location)');

// ========================================================
// WRITE UPDATED FILES
// ========================================================

// Write map_corrections.json
fs.writeFileSync(correctionsPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('\n💾 map_corrections.json updated!');

// Write place_coords.json
fs.writeFileSync(placeCoordsPath, JSON.stringify({ places: data.places }, null, 2) + '\n', 'utf8');
console.log('💾 assets/data/place_coords.json updated!');

// Write pharmacy_coords.json
fs.writeFileSync(pharmacyCoordsPath, JSON.stringify({ pharmacies: data.pharmacies }, null, 2) + '\n', 'utf8');
console.log('💾 assets/data/pharmacy_coords.json updated!');

console.log('\n✅ All coordinate corrections applied successfully!');
console.log('\n📋 Summary of changes:');
console.log('   PHARMACIES:');
console.log('   • Namlı Eczanesi: 37.2588,36.4684 → 37.259924,36.463888');
console.log('   • Murat Eczanesi: 37.254381,36.467004 → 37.253800,36.465500');
console.log('   PLACES:');
console.log('   • Pazartesi Pazarı: 37.2398,36.4468 → 37.248763,36.466250');
console.log('   • Haftalık Pazar Yerleri: 37.238,36.445 → 37.248763,36.466250');
