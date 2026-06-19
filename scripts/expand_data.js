const fs = require('fs');
const path = require('path');

const filePaths = [
  path.resolve(__dirname, '../data/city_content.json'),
  path.resolve(__dirname, '../../assets/data/city_content.json')
];

// New Mosques to add to 'ibadet'
const newMosques = [
  {
    name: "Boğaziçi Camii",
    shortDescription: "Boğaziçi Mahallesi'nin huzurlu camisi.",
    detail: "Boğaziçi Mahallesi sakinlerinin ibadet ve buluşma noktası olan, temiz çevre düzenlemesine sahip camidir.",
    address: "Boğaziçi Mah., Düziçi",
    tag: "CAMİ",
    lat: 37.2285,
    lng: 36.4385,
    image: "assets/images/mosque_placeholder.jpg"
  },
  {
    name: "Çiftlik Mahallesi Camii",
    shortDescription: "Çiftlik Mahallesi camisi.",
    detail: "Çiftlik Mahallesi'nde yer alan, geniş cemaat kapasiteli ve hayırsever hemşehrilerimizin katkılarıyla yapılmış camidir.",
    address: "Çiftlik Mah., Düziçi",
    tag: "CAMİ",
    lat: 37.2180,
    lng: 36.4520,
    image: "assets/images/mosque_placeholder.jpg"
  },
  {
    name: "Karacaoğlan Camii",
    shortDescription: "Cumhuriyet Mahallesi Karacaoğlan sokak camii.",
    detail: "Karacaoğlan sokak civarındaki vatandaşlarımıza hizmet veren, manevi atmosferi yüksek mahalle camimizdir.",
    address: "Cumhuriyet Mah., Karacaoğlan Mevkii, Düziçi",
    tag: "CAMİ",
    lat: 37.2435,
    lng: 36.4480,
    image: "assets/images/mosque_placeholder.jpg"
  },
  {
    name: "Şehitler Camii",
    shortDescription: "Şehitler Parkı yakınındaki yeni camimiz.",
    detail: "İrfanlı Mahallesi Şehitler Parkı bölgesinde, modern mimarisi ve estetik iç tasarımıyla dikkat çeken huzur dolu ibadethane.",
    address: "İrfanlı Mah., Şehitler Mevkii, Düziçi",
    tag: "CAMİ",
    lat: 37.2438,
    lng: 36.4510,
    image: "assets/images/mosque_placeholder.jpg"
  },
  {
    name: "Yenimahalle Camii",
    shortDescription: "Yenimahalle sakinlerine hizmet veren cami.",
    detail: "Yenimahalle bölgesinde yer alan, taziye evi ve Kur'an kursu müştemilatı da bulunan büyük mahalle camisi.",
    address: "Yenimahalle, Düziçi",
    tag: "CAMİ",
    lat: 37.2350,
    lng: 36.4650,
    image: "assets/images/mosque_placeholder.jpg"
  }
];

// New Supermarkets to add to 'supermarket'
const newSupermarkets = [
  {
    name: "BİM Cumhuriyet Şubesi",
    shortDescription: "Cumhuriyet Mahallesi BİM market şubesi.",
    detail: "Cumhuriyet Mahallesi'nde temel gıda ve aktüel ürünler ile vatandaşlarımıza hizmet sunan BİM şubesi.",
    address: "Cumhuriyet Mah., Atatürk Cad., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2440,
    lng: 36.4495,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "A101 Cumhuriyet Şubesi",
    shortDescription: "Cumhuriyet Mahallesi A101 market şubesi.",
    detail: "Geniş ürün yelpazesi ve uygun fiyatlarıyla Cumhuriyet caddesi üzerinde hizmet veren A101 market şubesi.",
    address: "Cumhuriyet Mah., Atatürk Cad., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2432,
    lng: 36.4502,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "Şok Cumhuriyet Şubesi",
    shortDescription: "Cumhuriyet Mahallesi Şok market şubesi.",
    detail: "Cumhuriyet Mahallesi meydan civarında yer alan, haftalık kampanyalarıyla ünlü Şok market şubesi.",
    address: "Cumhuriyet Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2448,
    lng: 36.4525,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "BİM Uzunbanı Şubesi",
    shortDescription: "Uzunbanı Mahallesi BİM market şubesi.",
    detail: "Uzunbanı Mahallesi sakinlerinin günlük gıda ihtiyaçları için hizmet sunan indirim marketi şubesi.",
    address: "Uzunbanı Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2460,
    lng: 36.4385,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "A101 Uzunbanı Şubesi",
    shortDescription: "Uzunbanı Mahallesi A101 market şubesi.",
    detail: "Uzunbanı caddesi üzerinde yer alan, ucuzluk ve kaliteyi bir arada sunan zincir perakende market şubesi.",
    address: "Uzunbanı Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2450,
    lng: 36.4398,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "BİM Yeşilova Şubesi",
    shortDescription: "Yeşilova Mahallesi BİM market şubesi.",
    detail: "Yeşilova Mahallesi otogar istikametinde bulunan, taze ve kaliteli gıda ürünleri sunan zincir market.",
    address: "Yeşilova Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2345,
    lng: 36.4490,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "A101 Yeşilova Şubesi",
    shortDescription: "Yeşilova Mahallesi A101 market şubesi.",
    detail: "Yeşilova Mahallesi otogar kavşağında geniş aktüel ürün reyonlarıyla hizmet sunan A101 şubesi.",
    address: "Yeşilova Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2355,
    lng: 36.4482,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "Şok İrfanlı Şubesi",
    shortDescription: "İrfanlı Mahallesi Şok market şubesi.",
    detail: "İrfanlı caddesinde stadyum yolu üzerinde yer alan, cazip fiyatlı zincir market şubesi.",
    address: "İrfanlı Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2468,
    lng: 36.4540,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "BİM Hürriyet Şubesi",
    shortDescription: "Hürriyet Mahallesi BİM market şubesi.",
    detail: "Hürriyet Mahallesi Refik Cesur Bulvarı üzerinde zengin ürün çeşitleriyle hizmet sunan BİM market.",
    address: "Hürriyet Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2425,
    lng: 36.4595,
    image: "assets/images/market_placeholder.jpg"
  },
  {
    name: "A101 Hürriyet Şubesi",
    shortDescription: "Hürriyet Mahallesi A101 market şubesi.",
    detail: "Hürriyet Mahallesi'nde vatandaşlarımızın yürüme mesafesinde ulaşabileceği zincir market şubesi.",
    address: "Hürriyet Mah., Düziçi",
    tag: "ZİNCİR",
    lat: 37.2418,
    lng: 36.4588,
    image: "assets/images/market_placeholder.jpg"
  }
];

// New Parking Lots to add to 'parking'
const newParkings = [
  {
    name: "Cumhuriyet Meydanı Açık Otoparkı",
    shortDescription: "Cumhuriyet Meydanı belediye açık otopark alanı.",
    detail: "İlçe merkezindeki etkinlik meydanı yakınında bulunan, kısa süreli araç parkı için tasarlanmış geniş otopark sahasıdır.",
    address: "Cumhuriyet Mah., Meydan Yanı, Düziçi",
    tag: "AÇIK",
    lat: 37.2441,
    lng: 36.4518,
    image: "assets/images/parking_placeholder.jpg"
  },
  {
    name: "İlçe Emniyet Yanı Açık Otopark",
    shortDescription: "İlçe emniyet müdürlüğü yanı açık park alanı.",
    detail: "Emniyet işlemleri olan vatandaşlarımız ve çarşı esnafı için tasarlanmış ücretsiz belediye açık otopark alanı.",
    address: "Cumhuriyet Mah., Emniyet Arkası, Düziçi",
    tag: "ÜCRETSİZ",
    lat: 37.2418,
    lng: 36.4510,
    image: "assets/images/parking_placeholder.jpg"
  },
  {
    name: "Sabun Çayı Mesire Alanı Otoparkı",
    shortDescription: "Sabun çayı mesire yeri otopark alanı.",
    detail: "Hafta sonu piknik ve doğa gezisine gelen hemşehrilerimizin araçlarını güvenle park edebileceği büyük toprak otopark sahası.",
    address: "Sabun Çayı Turizm Yolu, Düziçi",
    tag: "MESİRE",
    lat: 37.2842,
    lng: 36.4678,
    image: "assets/images/parking_placeholder.jpg"
  },
  {
    name: "Gençlik Merkezi Açık Otoparkı",
    shortDescription: "Düziçi Gençlik Merkezi ücretsiz otopark alanı.",
    detail: "Spor salonu ve Gençlik Merkezi ziyaretçileri için tasarlanmış asfalt zeminli, güvenli açık otopark.",
    address: "İrfanlı Mah., Gençlik Merkezi Yanı, Düziçi",
    tag: "ÜCRETSİZ",
    lat: 37.2462,
    lng: 36.4548,
    image: "assets/images/parking_placeholder.jpg"
  }
];

// New EV Charges to add to 'ev_charge'
const newEVCharges = [
  {
    name: "Trugo Şarj İstasyonu (Kaymakamlık)",
    shortDescription: "Hükümet Konağı otoparkı Trugo hızlı şarj noktası.",
    detail: "Hükümet Konağı otoparkında yer alan, Trugo altyapısıyla tüm elektrikli araçlara 180 kW DC yüksek hızlı şarj sağlayan ünite.",
    address: "Cumhuriyet Mah., Kaymakamlık Otoparkı, Düziçi",
    tag: "DC HIZLI",
    lat: 37.2443,
    lng: 36.4508,
    image: "assets/images/ev_placeholder.jpg"
  },
  {
    name: "Eşarj İstasyonu (Yeni Otogar)",
    shortDescription: "Düziçi Otogarı Eşarj şarj ünitesi.",
    detail: "Yeni otogarda bekleyen veya yolculuk yapan elektrikli araç sahipleri için konumlandırılmış Eşarj AC normal şarj ünitesi.",
    address: "Yeşilova Mah., Yeni Otogar İçi, Düziçi",
    tag: "AC NORMAL",
    lat: 37.2338,
    lng: 36.4482,
    image: "assets/images/ev_placeholder.jpg"
  },
  {
    name: "Voltrun Şarj İstasyonu (Çevre Yolu BP)",
    shortDescription: "Çevre yolu BP istasyonu içindeki Voltrun şarj noktası.",
    detail: "Çevre yolundaki BP akaryakıt istasyonunda yer alan, Voltrun altyapısı ile elektrikli araç şarjı sunan DC hızlı ünitedir.",
    address: "İstiklal Mah., Çevre Yolu Üzeri, Düziçi",
    tag: "DC HIZLI",
    lat: 37.2366,
    lng: 36.4447,
    image: "assets/images/ev_placeholder.jpg"
  },
  {
    name: "Astor Şarj İstasyonu (D-400 Girişi)",
    shortDescription: "D-400 karayolu Shell istasyonu şarj ünitesi.",
    detail: "Düziçi D-400 otoyol bağlantı noktasındaki Shell istasyonunda yer alan Astor DC hızlı şarj cihazıdır.",
    address: "D-400 Bağlantı Yolu, Düziçi Girişi",
    tag: "DC HIZLI",
    lat: 37.2309,
    lng: 36.4397,
    image: "assets/images/ev_placeholder.jpg"
  }
];

// New Petrol Stations to add to services.fuel.stations
const newPetrolStations = [
  {
    name: "Milangaz Otogaz İstasyonu",
    brand: "Petrol",
    lat: 37.2315,
    lng: 36.4570,
    address: "Karşıyaka Mah., Otogar Yolu, Düziçi",
    hours: "7/24"
  },
  {
    name: "Aygaz Otogaz İstasyonu",
    brand: "Petrol",
    lat: 37.2348,
    lng: 36.4488,
    address: "Yeşilova Mah., Yeni Otogar Civarı, Düziçi",
    hours: "7/24"
  },
  {
    name: "TP Petrol Çevre Yolu",
    brand: "TP",
    lat: 37.2392,
    lng: 36.4578,
    address: "İstiklal Mah., Çevre Yolu, Düziçi",
    hours: "7/24"
  },
  {
    name: "Memoil Akaryakıt",
    brand: "Petrol",
    lat: 37.2185,
    lng: 36.4305,
    address: "Yarbaşı Mevkii, D-400 Karayolu, Düziçi",
    hours: "7/24"
  }
];

// New Public Category & Places
const newPublicCategory = {
  id: "public",
  icon: "account_balance",
  badge: "Kamu",
  title: "Kamu Kurumları",
  subtitle: "Düziçi resmi kurum ve hükümet daireleri",
  places: [
    {
      name: "Düziçi Kaymakamlığı",
      shortDescription: "Düziçi Hükümet Konağı idari merkezi.",
      detail: "İlçemizin mülki idare merkezi olan, tüm resmi müdürlükleri bünyesinde barındıran Hükümet Konağı binasıdır.",
      address: "Cumhuriyet Mah., Hükümet Konağı, Düziçi",
      tag: "KAMU",
      lat: 37.2444,
      lng: 36.4507,
      image: "assets/images/police_placeholder.jpg"
    },
    {
      name: "Düziçi Belediye Başkanlığı",
      shortDescription: "Düziçi Belediyesi ana hizmet binası.",
      detail: "Düziçi yerel yönetim merkezi. İmar, fen işleri ve sosyal hizmetler birimleri ile halkımıza hizmet sunmaktadır.",
      address: "Cumhuriyet Mah., Belediye Meydanı No:1, Düziçi",
      tag: "BELEDİYE",
      lat: 37.2446,
      lng: 36.4513,
      image: "assets/images/police_placeholder.jpg"
    },
    {
      name: "Düziçi Adliyesi",
      shortDescription: "Düziçi adalet sarayı ve mahkemeleri.",
      detail: "Düziçi ilçesi adalet hizmetlerinin yürütüldüğü, Hükümet Konağı ek binasında bulunan adliye sarayıdır.",
      address: "Cumhuriyet Mah., Hükümet Konağı Yanı, Düziçi",
      tag: "ADLİYE",
      lat: 37.2440,
      lng: 36.4504,
      image: "assets/images/police_placeholder.jpg"
    },
    {
      name: "Düziçi PTT Merkez Müdürlüğü",
      shortDescription: "Düziçi merkez PTT kargo ve posta şubesi.",
      detail: "Kurtuluş Mahallesi'nde posta, telgraf, bankacılık ve lojistik hizmetleri sunan PTT ana hizmet binası.",
      address: "Kurtuluş Mah., Atatürk Caddesi, Düziçi",
      tag: "POSTA",
      lat: 37.2398,
      lng: 36.4478,
      image: "assets/images/police_placeholder.jpg"
    },
    {
      name: "Düziçi İlçe Nüfus Müdürlüğü",
      shortDescription: "Kimlik, pasaport ve ehliyet işlemleri dairesi.",
      detail: "Hükümet Konağı içerisinde yer alan, vatandaşlık, kimlik kartı ve adres tescili işlemlerini gerçekleştiren kamu dairesi.",
      address: "Cumhuriyet Mah., Hükümet Konağı Zemin Kat, Düziçi",
      tag: "NÜFUS",
      lat: 37.2444,
      lng: 36.4507,
      image: "assets/images/police_placeholder.jpg"
    },
    {
      name: "Düziçi Tapu Müdürlüğü",
      shortDescription: "Gayrimenkul tescil ve tapu kadastro işlemleri.",
      detail: "İlçemizdeki gayrimenkul tapu tescil, devir ve kadastro işlemlerini yürüten Çevre ve Şehircilik Bakanlığına bağlı dairedir.",
      address: "Cumhuriyet Mah., Hükümet Konağı 2. Kat, Düziçi",
      tag: "TAPU",
      lat: 37.2444,
      lng: 36.4507,
      image: "assets/images/police_placeholder.jpg"
    },
    {
      name: "Düziçi Sosyal Güvenlik Merkezi (SGK)",
      shortDescription: "SGK emeklilik, sigorta ve sağlık prim dairesi.",
      detail: "Hürriyet Mahallesi'nde yer alan, emeklilik, bağkur, ssk ve genel sağlık sigortası hizmetleri veren merkez binası.",
      address: "Hürriyet Mah., Refik Cesur Bulvarı, Düziçi",
      tag: "SOSYAL GÜVENLİK",
      lat: 37.2425,
      lng: 36.4552,
      image: "assets/images/police_placeholder.jpg"
    },
    {
      name: "Düziçi Sosyal Yardımlaşma ve Dayanışma Vakfı",
      shortDescription: "İhtiyaç sahibi vatandaşlarımıza sosyal destek dairesi.",
      detail: "Cumhuriyet Mahallesi Hükümet Konağı bünyesinde, muhtaç durumdaki ailelerimize nakdi ve ayni sosyal yardımları koordine eden vakıftır.",
      address: "Cumhuriyet Mah., Hükümet Konağı İçi, Düziçi",
      tag: "SOSYAL YARDIM",
      lat: 37.2444,
      lng: 36.4507,
      image: "assets/images/police_placeholder.jpg"
    }
  ]
};

async function expandData() {
  try {
    for (const filePath of filePaths) {
      console.log(`Processing: ${filePath}...`);
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}, skipping.`);
        continue;
      }
      
      const raw = fs.readFileSync(filePath, 'utf8');
      const content = JSON.parse(raw);

      // 1. Expand Mosques ('ibadet')
      if (content.explore && content.explore.categories) {
        const ibadetCat = content.explore.categories.find(c => c.id === 'ibadet');
        if (ibadetCat) {
          for (const m of newMosques) {
            if (!ibadetCat.places.some(p => p.name === m.name)) {
              ibadetCat.places.push({
                ...m,
                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`
              });
              console.log(`  Added Mosque: ${m.name}`);
            }
          }
        }

        // 2. Expand Supermarkets ('supermarket')
        const supermarketCat = content.explore.categories.find(c => c.id === 'supermarket');
        if (supermarketCat) {
          for (const s of newSupermarkets) {
            if (!supermarketCat.places.some(p => p.name === s.name)) {
              supermarketCat.places.push({
                ...s,
                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
              });
              console.log(`  Added Supermarket: ${s.name}`);
            }
          }
        }

        // 3. Expand Parking ('parking')
        const parkingCat = content.explore.categories.find(c => c.id === 'parking');
        if (parkingCat) {
          for (const p of newParkings) {
            if (!parkingCat.places.some(pl => pl.name === p.name)) {
              parkingCat.places.push({
                ...p,
                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
              });
              console.log(`  Added Parking: ${p.name}`);
            }
          }
        }

        // 4. Expand EV Charge ('ev_charge')
        const evCat = content.explore.categories.find(c => c.id === 'ev_charge');
        if (evCat) {
          for (const ev of newEVCharges) {
            if (!evCat.places.some(pl => pl.name === ev.name)) {
              evCat.places.push({
                ...ev,
                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${ev.lat},${ev.lng}`
              });
              console.log(`  Added EV Charge: ${ev.name}`);
            }
          }
        }

        // 5. Add / Update 'public' Category
        let publicCat = content.explore.categories.find(c => c.id === 'public');
        const updatedPublicCategory = {
          ...newPublicCategory,
          places: newPublicCategory.places.map(p => ({
            ...p,
            googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
          }))
        };
        if (publicCat) {
          // Add missing ones
          for (const p of updatedPublicCategory.places) {
            if (!publicCat.places.some(pl => pl.name === p.name)) {
              publicCat.places.push(p);
              console.log(`  Added Public Place to existing: ${p.name}`);
            }
          }
        } else {
          content.explore.categories.push(updatedPublicCategory);
          console.log(`  Created 'public' category with ${updatedPublicCategory.places.length} places.`);
        }
      }

      // 6. Expand Petrol Stations ('services.fuel.stations')
      if (content.services && content.services.fuel && content.services.fuel.stations) {
        for (const s of newPetrolStations) {
          if (!content.services.fuel.stations.some(st => st.name === s.name)) {
            content.services.fuel.stations.push(s);
            console.log(`  Added Petrol Station: ${s.name}`);
          }
        }
      }

      // Save pretty printed JSON back to file
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
      console.log(`✅ Saved all modifications back to: ${filePath}`);
    }
  } catch (err) {
    console.error('❌ Data expansion failed:', err);
  }
}

expandData();
