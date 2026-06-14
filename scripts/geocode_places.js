/**
 * Gezi yerleri koordinat düzeltmeleri → map_corrections.json + assets/data/place_coords.json
 * Kullanım: node scripts/geocode_places.js
 */
const fs = require('fs');
const path = require('path');
const {
  CORRECTIONS_PATH,
  mapsSearchUrl,
  norm,
} = require('../src/utils/mapCorrections');

/** Wikipedia / OSM / resmi kaynak doğrulanmış koordinatlar */
const VERIFIED_PLACES = {
  'Harun Reşit Kalesi': { lat: 37.26878, lng: 36.487798 },
  'Karasu Şelalesi': { lat: 37.283, lng: 36.467 },
  'Yeşil Şelalesi': { lat: 37.302788, lng: 36.300907 },
  'Haruniye Kaplıcaları': { lat: 37.381, lng: 36.492 },
  'Haruniye-Kuşçu Doğa Yolu': { lat: 37.381, lng: 36.492 },
  'Haruniye bölgesi dinlenmesi': { lat: 37.381, lng: 36.492 },
  'Düldül Dağı Zirvesi': { lat: 37.348476, lng: 36.515607 },
  'Düldül Dağı Trekking': { lat: 37.348476, lng: 36.515607 },
  'Kurtlar Yaylası Trekking Parkuru': { lat: 37.3105, lng: 36.5285 },
  'Kurtlar Yaylası Kamp Alanı': { lat: 37.3105, lng: 36.5285 },
  'Saman ve Kurtlar kaleleri': { lat: 37.272, lng: 36.492 },
  'Sabun Çayı Mesire Alanı': { lat: 37.283, lng: 36.467 },
  'Sabun Çayı Kamp ve Piknik Alanı': { lat: 37.283, lng: 36.467 },
  'Sabun Çayı Vadisi Yürüyüşü': { lat: 37.283, lng: 36.467 },
  'Deve Mağarası, Deve Kanyonu ve Adem\'in Şelalesi (Kısık Kanyonu Rotası)': {
    lat: 37.302,
    lng: 36.515,
  },
  'Deve Mağarası': { lat: 37.302, lng: 36.515 },
  'Düziçi Köy Enstitüsü Müzesi (Eğitim Tarihi Müzesi)': { lat: 37.381, lng: 36.492 },
  'Karatepe-Aslantaş Açık Hava Müzesi ve Milli Parkı': { lat: 37.294, lng: 36.257 },
  'Karatepe-Aslantaş Açık Hava Müzesi': { lat: 37.294, lng: 36.257 },
  'Karatepe-Aslantaş Müzesi': { lat: 37.294, lng: 36.257 },
  'Aslantaş Barajı': { lat: 37.3, lng: 36.25 },
  'Kastabala (Hierapolis) Antik Kenti': { lat: 37.177, lng: 36.185 },
  'Kastabala Antik Kenti': { lat: 37.177, lng: 36.185 },
  'Toprakkale Kalesi': { lat: 37.065, lng: 36.143 },
  'Delioğlan Şelalesi': { lat: 37.1867, lng: 36.4256 },
  'Uyuz Pınarı': { lat: 37.297, lng: 36.504 },
  'Kocakesme Şelalesi': { lat: 37.228, lng: 36.463 },
  'Dumanlı Yaylası': { lat: 37.288, lng: 36.565 },
  'Dumanlı Yaylası Yürüyüş Parkuru': { lat: 37.288, lng: 36.565 },
  'Dumanlı Yaylası Kamp Alanı': { lat: 37.288, lng: 36.565 },
  'Dumanlı Yaylası çevresi': { lat: 37.288, lng: 36.565 },
  'Düldül Dağı Trekking Rotası': { lat: 37.348476, lng: 36.515607 },
  'Düldül Yaylası Doğa Yürüyüşü': { lat: 37.349, lng: 36.561 },
  'Düldül Yaylası Kamp Alanı': { lat: 37.349, lng: 36.561 },
  'Kuşçu Yaylası': { lat: 37.382, lng: 36.471 },
  'Mezdağ (Mezdağı) Yaylası Yürüyüş Rotası': { lat: 37.32, lng: 36.54 },
  'Mezdağ (Mezdağı) Yaylası Kamp Alanı': { lat: 37.32, lng: 36.54 },
  'Hodu Yaylası Doğa Yürüyüşü': { lat: 37.315, lng: 36.53 },
  'Hodu Yaylası Kamp Alanı': { lat: 37.315, lng: 36.53 },
  'Tozluyurt Yaylası Kamp Alanı': { lat: 37.33, lng: 36.55 },
  'Berke Barajı ve göl alanı': { lat: 37.2215, lng: 36.471 },
  'Berke Barajı Manzarası': { lat: 37.2215, lng: 36.471 },
  'Berke Barajı Çevre Yürüyüşü': { lat: 37.2215, lng: 36.471 },
  'Berke Barajı Kıyısı Kamp': { lat: 37.2215, lng: 36.471 },
  'Taş Köprü (Fettahoğluları)': { lat: 37.245, lng: 36.46 },
  'Taş Köprü': { lat: 37.245, lng: 36.46 },
  'Osmaniye Kent Müzesi': { lat: 37.074, lng: 36.248 },
  'Osmaniye Arkeoloji Müzesi': { lat: 37.0742, lng: 36.2475 },
  'Bahçe Kalesi': { lat: 37.129, lng: 36.624 },
  'Kadirli Kalesi': { lat: 37.371, lng: 36.098 },
  'Hemite (Amouda) Kalesi': { lat: 37.165, lng: 36.657 },
  'Zorkun Yaylası': { lat: 37.065, lng: 36.355 },
  'Yarpuz Yaylası': { lat: 37.34, lng: 36.52 },
  'Olukbaşı Şelalesi': { lat: 37.085, lng: 36.22 },
  'Hasanbeyli İlçesi ve Çevresi': { lat: 37.127, lng: 36.555 },
  'Sumbas İlçesi ve Doğası': { lat: 37.451, lng: 36.023 },
  'Ceyhan Nehri Kanyonu': { lat: 37.22, lng: 36.47 },
  'Atik (Ulu) Cami – Osmaniye Merkez': { lat: 37.0742, lng: 36.2478 },
  'Osmaniye Şehir Ormanı ve Tabiat Parkı': { lat: 37.079, lng: 36.235 },
  'Harun Reşit Çocuk Parkı ve Millet Bahçesi': { lat: 37.2395, lng: 36.4468 },
  'Atatürk Parkı (Park Restorant)': { lat: 37.24, lng: 36.446 },
  'Düziçi Belediyesi İletişim': { lat: 37.244, lng: 36.451 },
  'Düziçi Çarşı ve Ulu Cami': { lat: 37.244, lng: 36.451 },
  'Kurtuluş Çarşı ve Yeraltı Camii': { lat: 37.232, lng: 36.441 },
};

function toEntry({ lat, lng }) {
  return {
    lat,
    lng,
    googleMapsUrl: mapsSearchUrl(lat, lng),
  };
}

function main() {
  const corrections = JSON.parse(fs.readFileSync(CORRECTIONS_PATH, 'utf8'));
  if (!corrections.places) corrections.places = {};

  let updated = 0;
  for (const [name, coords] of Object.entries(VERIFIED_PLACES)) {
    corrections.places[name] = toEntry(coords);
    updated++;
  }

  // Mevcut corrections'taki eski yanlış değerleri de güncelle (isim eşleşmesi)
  const cityPath = path.resolve(__dirname, '../../assets/data/city_content.json');
  const city = JSON.parse(fs.readFileSync(cityPath, 'utf8'));
  const allNames = new Set();
  for (const cat of city.explore?.categories || []) {
    for (const p of cat.places || []) allNames.add(p.name);
  }
  for (const s of city.explore?.suggestions || []) {
    for (const p of s.places || []) allNames.add(p.name);
  }

  for (const name of allNames) {
    const n = norm(name);
    for (const [key, coords] of Object.entries(VERIFIED_PLACES)) {
      const k = norm(key);
      if (n === k || (n.length >= 6 && k.length >= 6 && (n.includes(k) || k.includes(n)))) {
        corrections.places[name] = toEntry(coords);
      }
    }
  }

  fs.writeFileSync(CORRECTIONS_PATH, JSON.stringify(corrections, null, 2) + '\n', 'utf8');

  const assetPath = path.resolve(__dirname, '../../assets/data/place_coords.json');
  fs.writeFileSync(
    assetPath,
    JSON.stringify({ places: corrections.places }, null, 2) + '\n',
    'utf8',
  );

  console.log(`✅ ${updated} doğrulanmış yer → ${CORRECTIONS_PATH}`);
  console.log(`✅ Flutter asset → ${assetPath}`);
}

main();
