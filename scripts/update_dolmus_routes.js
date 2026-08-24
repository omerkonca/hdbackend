require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { requireSupabaseAdmin } = require('../src/utils/supabaseAdmin');

const dolmusRoutes = [
  {
    id: "hat-1",
    lineCode: "HAT 1",
    route: "Düziçi - Osmaniye Merkez Hattı",
    category: "intercity",
    schedule: "06:00 - 22:00 (Her 15-20 dakikada bir)",
    firstBus: "Düziçi Çarşı İçi Durakları, Yarbaşı Kavşağı, E-5 (D-400) Karayolu Bağlantısı, Kanlı Geçit Mevkii, Şekerdere Kavşağı (Osmaniye Girişi), Fıstık Heykeli (Osmaniye Merkez), Kadirli Yolu Kavşağı",
    departure: "Düziçi Merkez Otogar",
    arrival: "Osmaniye Şehirlerarası Otobüs Terminali",
    fareFull: "100 TL",
    fareNote: "Her 15-20 dakikada bir hareket eder (Ana Hat)",
    operator: "Düziçi Minibüs Kooperatifi",
    phone: "03288761234",
    vehicleType: "minibüs"
  },
  {
    id: "hat-2",
    lineCode: "HAT 2",
    route: "Osmaniye - Adana Hattı (Ceyhan Üzeri)",
    category: "intercity",
    schedule: "06:00 - 21:00 (Saat başı veya doldukça)",
    firstBus: "Toprakkale Merkez, Kısık Mevkii, Ceyhan Bölge Trafik, Ceyhan Otogarı, Yılankale Kavşağı, Yakapınar (Misis), İncirlik",
    departure: "Osmaniye Otogar",
    arrival: "Adana Yüreğir Otogarı",
    fareFull: "120 - 150 TL",
    fareNote: "Eski Yol / Ceyhan Üzeri Seferler",
    operator: "Osmaniye - Adana Birlik",
    phone: "03288141212",
    vehicleType: "minibüs"
  },
  {
    id: "hat-3",
    lineCode: "HAT 3",
    route: "Şehir İçi 1 Nolu Hat (Çamiçi & Haruniye Yönü)",
    category: "city",
    schedule: "07:00 - 21:00 (Düzenli ring)",
    firstBus: "Belediye Önü, Okullar Bölgesi, Kurtuluş Mahallesi, Düziçi Devlet Hastanesi, Haruniye Merkez",
    departure: "Çarşı Merkez / Meydan",
    arrival: "Çamiçi Mahallesi",
    fareFull: "Şehir İçi Tarife",
    fareNote: "Düziçi'nin tarihi Haruniye yerleşimi bu hat üzerindedir",
    operator: "Düziçi Şehir İçi Minibüsleri",
    phone: "03288761234",
    vehicleType: "minibüs"
  },
  {
    id: "hat-4",
    lineCode: "HAT 4",
    route: "Şehir İçi 2 Nolu Hat (İrfanlı & Karacaoğlan Yönü)",
    category: "city",
    schedule: "07:00 - 21:00 (Düzenli ring)",
    firstBus: "PTT Caddesi, İrfanlı Mahallesi Girişi, İrfanlı Merkez",
    departure: "Çarşı Merkez",
    arrival: "Karacaoğlan Mahallesi",
    fareFull: "Şehir İçi Tarife",
    fareNote: "İrfanlı ve Karacaoğlan mahallelerine ring seferler",
    operator: "Düziçi Şehir İçi Minibüsleri",
    phone: "03288761234",
    vehicleType: "minibüs"
  },
  {
    id: "hat-5",
    lineCode: "HAT 5",
    route: "Şehir İçi 3 Nolu Hat (Yenice / Enice Yönü)",
    category: "city",
    schedule: "07:00 - 20:00 (30-40 dakikada bir ring)",
    firstBus: "Belediye / Merkez Caddeler, Yenice Yolu",
    departure: "Çarşı Merkez",
    arrival: "Yenice (Enice) Mahallesi Merkez",
    fareFull: "Şehir İçi Tarife",
    fareNote: "Gün içinde 30-40 dakikada bir ring atar",
    operator: "Düziçi Şehir İçi Minibüsleri",
    phone: "03288761234",
    vehicleType: "minibüs"
  },
  {
    id: "hat-6",
    lineCode: "HAT 6",
    route: "Düziçi - Ellek Beldesi Hattı",
    category: "village",
    schedule: "06:30 - 19:30 (Sık aralıklarla)",
    firstBus: "Hastane Kavşağı, Ellek Yolu Ayrımı, Ellek Çarşı, Ellek Pastanesi",
    departure: "Düziçi Köy Garajı",
    arrival: "Gökyıldız Mahallesi",
    fareFull: "Belde Tarifesi",
    fareNote: "Sabah ve akşam saatlerinde yoğunlaştırılmış seferler",
    operator: "Ellek Minibüsleri",
    phone: "03288761234",
    vehicleType: "koy_servisi"
  },
  {
    id: "hat-7",
    lineCode: "HAT 7",
    route: "Düziçi - Yarbaşı Beldesi Hattı",
    category: "village",
    schedule: "07:00 - 19:00 (Ortalama saat başı)",
    firstBus: "Otogar Kavşağı, Yarbaşı Yolu E-5 Bağlantısı",
    departure: "Düziçi Köy Garajı",
    arrival: "Yarbaşı Belde Merkezi",
    fareFull: "Belde Tarifesi",
    fareNote: "Ortalama saat başı hareket eder",
    operator: "Yarbaşı Minibüsleri",
    phone: "03288761234",
    vehicleType: "koy_servisi"
  },
  {
    id: "hat-8",
    lineCode: "HAT 8",
    route: "Düziçi - Atalan Beldesi Hattı",
    category: "village",
    schedule: "07:00 - 18:00 (Düzenli seferler)",
    firstBus: "İlçe Çıkışı (Atalan Yönü), Atalan Yolu Ayrımı, Atalan Çarşı / Meydan",
    departure: "Düziçi Köy Garajı",
    arrival: "Atalan Mahalleleri",
    fareFull: "Belde Tarifesi",
    fareNote: "Sabah ve akşam saatlerinde yoğun seferler",
    operator: "Atalan Minibüsleri",
    phone: "03288761234",
    vehicleType: "koy_servisi"
  },
  {
    id: "hat-9",
    lineCode: "HAT 9",
    route: "Düziçi - Böcekli Beldesi Hattı",
    category: "village",
    schedule: "07:00 - 18:00 (Düzenli seferler)",
    firstBus: "Böcekli Yolu (Bağlantı Yolu), Böcekli Belde Girişi",
    departure: "Düziçi Köy Garajı",
    arrival: "Böcekli Merkez",
    fareFull: "Belde Tarifesi",
    fareNote: "Sabah ilçeye geliş, akşam beldeye dönüş yoğunluklu",
    operator: "Böcekli Minibüsleri",
    phone: "03288761234",
    vehicleType: "koy_servisi"
  },
  {
    id: "hat-10",
    lineCode: "HAT 10",
    route: "Düziçi - Alibozlu TOKİ Hattı",
    category: "village",
    schedule: "Sabah yoğun, gün içi saat başı",
    firstBus: "Refik Cesur Bulvarı, Alibozlu Köyü Yolu",
    departure: "Düziçi Köy Garajı / Çarşı",
    arrival: "Alibozlu TOKİ Konutları",
    fareFull: "Köy/TOKİ Tarifesi",
    fareNote: "Sabah saatlerinde sık, gün içinde saat başı seferler",
    operator: "Alibozlu - TOKİ Servisleri",
    phone: "03288761234",
    vehicleType: "koy_servisi"
  },
  {
    id: "hat-11",
    lineCode: "HAT 11",
    route: "Düziçi - Boyalı & Pirsultanlı Hattı",
    category: "village",
    schedule: "Sabah köye gidiş, akşam dönüş ağırlıklı",
    firstBus: "İlçe Çıkışı, Boyalı Köyü Yolu Ayrımı, Boyalı Köyü Merkez",
    departure: "Düziçi Köy Garajı",
    arrival: "Pirsultanlı Köyü",
    fareFull: "Köy Tarifesi",
    fareNote: "Köy ve yayla güzergâhı",
    operator: "Boyalı Köy Servisleri",
    phone: "03288761234",
    vehicleType: "koy_servisi"
  },
  {
    id: "hat-12",
    lineCode: "HAT 12",
    route: "Düziçi - Çerçioğlu Köyü Hattı",
    category: "village",
    schedule: "Sabah Geliş: 07:30 | Akşam Dönüş: 16:00 - 17:00",
    firstBus: "Çerçioğlu Yolu Kavşağı, Çerçioğlu Köy Girişi",
    departure: "Düziçi Köy Garajı",
    arrival: "Çerçioğlu Köy Meydanı",
    fareFull: "Köy Tarifesi",
    fareNote: "Sabah ilçeye geliş (07:30), Akşam köye dönüş (16:00 - 17:00)",
    operator: "Çerçioğlu Köy Servisi",
    phone: "03288761234",
    vehicleType: "koy_servisi"
  }
];

async function run() {
  console.log('🚀 Updating dolmuş lines...');

  // 1. backend/data/city_content.json
  const backendPath = path.join(__dirname, '../data/city_content.json');
  if (fs.existsSync(backendPath)) {
    const raw = JSON.parse(fs.readFileSync(backendPath, 'utf8'));
    raw.dolmus = dolmusRoutes;
    if (raw.transportation) {
      raw.transportation.dolmus = dolmusRoutes;
    }
    fs.writeFileSync(backendPath, JSON.stringify(raw, null, 2), 'utf8');
    console.log('✅ Updated backend/data/city_content.json');
  }

  // 2. assets/data/city_content.json
  const appPath = path.join(__dirname, '../../assets/data/city_content.json');
  if (fs.existsSync(appPath)) {
    const raw = JSON.parse(fs.readFileSync(appPath, 'utf8'));
    raw.dolmus = dolmusRoutes;
    if (raw.transportation) {
      raw.transportation.dolmus = dolmusRoutes;
    }
    fs.writeFileSync(appPath, JSON.stringify(raw, null, 2), 'utf8');
    console.log('✅ Updated assets/data/city_content.json');
  }

  // 3. Supabase city_contents
  try {
    const fileService = require('../src/services/fileService');
    const content = await fileService.readCityContent();
    content.dolmus = dolmusRoutes;
    if (content.transportation) {
      content.transportation.dolmus = dolmusRoutes;
    }
    await fileService.writeCityContent(content);
    console.log('✅ Successfully updated Supabase city_contents (id: 1)');
  } catch (err) {
    console.error('❌ Supabase admin error:', err.message);
  }

  console.log('🎉 Done updating all 12 dolmuş lines!');
}

run();
