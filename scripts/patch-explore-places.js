/**
 * Gezi rehberi mekanlarına lat/lng, otopark, WC, giriş ücreti ekler.
 * Kullanım: node backend/scripts/patch-explore-places.js
 */
const fs = require('fs');
const path = require('path');

const FILES = [
  path.resolve(__dirname, '../data/city_content.json'),
  path.resolve(__dirname, '../../assets/data/city_content.json'),
];

/** İsim -> ziyaret meta (saha / resmi kaynak özeti) */
const META = {
  'Harun Reşit Kalesi': {
    lat: 37.258, lng: 36.48, parking: 'sinirli', restroom: 'var', entryFee: 'ucretsiz',
    entryFeeNote: 'Kale ziyareti ücretsiz; kafe ayrı.',
  },
  'Saman Kalesi': {
    lat: 37.265, lng: 36.435, parking: 'sinirli', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Kurtlar Kalesi': {
    lat: 37.265, lng: 36.435, parking: 'yok', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Taş Köprü (Fettahoğluları)': {
    lat: 37.245, lng: 36.46, parking: 'sinirli', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Düziçi Ulu Cami': {
    lat: 37.24, lng: 36.446, parking: 'var', restroom: 'var', entryFee: 'ucretsiz',
  },
  'Yarbaşı Tren İstasyonu': {
    lat: 37.199, lng: 36.43, parking: 'var', restroom: 'var', entryFee: 'ucretsiz',
  },
  'Düziçi Çarşı ve Hamamları': {
    lat: 37.234, lng: 36.442, parking: 'sinirli', restroom: 'var', entryFee: 'ucretsiz',
  },
  'Karasu Şelalesi': {
    lat: 37.251, lng: 36.468, parking: 'var', restroom: 'yok', entryFee: 'ucretsiz',
    entryFeeNote: 'Doğa alanı; sezon dışı erişim zor olabilir.',
  },
  'Delioğlan Şelalesi': {
    lat: 37.265, lng: 36.475, parking: 'sinirli', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Yeşil Şelale': {
    lat: 37.27, lng: 36.48, parking: 'yok', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Sabun Çayı Vadisi': {
    lat: 37.255, lng: 36.465, parking: 'sinirli', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Berke Barajı Göl Manzarası': {
    lat: 37.2215, lng: 36.471, parking: 'var', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Ceyhan Nehri Kıyıları': {
    lat: 37.22, lng: 36.47, parking: 'sinirli', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Dumanlı Yaylası': {
    lat: 37.288, lng: 36.565, parking: 'var', restroom: 'sinirli', entryFee: 'ucretsiz',
    entryFeeNote: 'Yayla işletmelerinde WC ve otopark değişebilir.',
  },
  'Düldül Dağı Trekking Rotası': {
    lat: 37.288, lng: 36.565, parking: 'sinirli', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Sabun Çayı Vadisi Yürüyüşü': {
    lat: 37.251, lng: 36.468, parking: 'var', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Berke Barajı Çevre Yürüyüşü': {
    lat: 37.2215, lng: 36.471, parking: 'var', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Haruniye-Kuşçu Doğa Yolu': {
    lat: 37.262, lng: 36.495, parking: 'sinirli', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Dumanlı Yaylası Kamp Alanı': {
    lat: 37.288, lng: 36.565, parking: 'var', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Berke Barajı Kıyısı Kamp': {
    lat: 37.2215, lng: 36.471, parking: 'var', restroom: 'yok', entryFee: 'ucretsiz',
  },
  'Sabun Çayı Kamp ve Piknik Alanı': {
    lat: 37.255, lng: 36.465, parking: 'var', restroom: 'sinirli', entryFee: 'ucretsiz',
  },
  'Harun Reşit Çocuk Parkı ve Millet Bahçesi': {
    lat: 37.2395, lng: 36.4468, parking: 'var', restroom: 'var', entryFee: 'ucretsiz',
  },
  'Eğitimci Bekir İlyas Kara Çocuk Köyü': {
    lat: 37.2440, lng: 36.4510, parking: 'var', restroom: 'var', entryFee: 'ucretsiz',
    entryFeeNote: 'Giriş ve oyun alanlarının kullanımı tamamen ücretsizdir. Belediye tarafından park içinde düzenlenen geleneksel çay ve fıstık ikramlı halk buluşmaları da halka açıktır.',
  },
  'Atatürk Parkı (Park Restorant)': {
    lat: 37.2400, lng: 36.4460, parking: 'var', restroom: 'var', entryFee: 'ucretsiz',
    entryFeeNote: 'Park alanına giriş, çocuk oyun grupları ve yeşil alan kullanımı ücretsizdir. Restoran hizmetleri ücretlidir.',
  },
  'Sabun Çayı Mesire Alanı': {
    lat: 37.2550, lng: 36.4650, parking: 'var', restroom: 'var', entryFee: 'ucretli',
    entryFeeNote: 'Araçla giriş, otopark kullanımı ve çardakların kiralanması ücrete tabidir. Fiyatlar oldukça makul düzeydedir.',
  },
  'Haruniye Kaplıcaları': {
    lat: 37.262, lng: 36.495, parking: 'var', restroom: 'var', entryFee: 'ucretli',
    entryFeeNote: 'Kaplıca giriş ücreti işletmeye göre değişir; tadilat dönemlerinde kapalı olabilir.',
  },
  'Karatepe-Aslantaş Açık Hava Müzesi': {
    lat: 37.3, lng: 36.25, parking: 'var', restroom: 'var', entryFee: 'ucretli',
    entryFeeNote: 'Müze giriş ücreti güncel tarifeye göre.',
  },
  'Aslantaş Barajı': {
    lat: 37.3, lng: 36.25, parking: 'var', restroom: 'sinirli', entryFee: 'ucretsiz',
  },
  'Kastabala (Hierapolis) Antik Kenti': {
    lat: 37.07, lng: 36.25, parking: 'var', restroom: 'var', entryFee: 'ucretli',
  },
  'Osmaniye Künefeleri': {
    lat: 37.234, lng: 36.442, parking: 'sinirli', restroom: 'var', entryFee: 'ucretsiz',
  },
  'Esnaf Lokantaları': {
    lat: 37.234, lng: 36.442, parking: 'sinirli', restroom: 'var', entryFee: 'ucretsiz',
  },
};

const DEFAULT_META = {
  parking: 'bilinmiyor',
  restroom: 'bilinmiyor',
  entryFee: 'bilinmiyor',
};

function patchPlace(place) {
  const m = META[place.name] || {};
  const merged = { ...DEFAULT_META, ...m };
  place.lat = place.lat ?? merged.lat;
  place.lng = place.lng ?? merged.lng;
  place.parking = place.parking || merged.parking;
  place.restroom = place.restroom || merged.restroom;
  place.entryFee = place.entryFee || merged.entryFee;
  if (merged.entryFeeNote && !place.entryFeeNote) place.entryFeeNote = merged.entryFeeNote;
  if (!place.googleMapsUrl && place.lat && place.lng) {
    place.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
}

function run(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const cats = data.explore?.categories || [];
  let count = 0;
  for (const cat of cats) {
    for (const place of cat.places || []) {
      patchPlace(place);
      count++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Patched ${count} places in ${filePath}`);
}

for (const f of FILES) {
  if (fs.existsSync(f)) run(f);
}
