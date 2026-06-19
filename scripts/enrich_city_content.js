const fs = require('fs');
const path = require('path');

const cityContentPath = path.resolve(__dirname, '../data/city_content.json');
const mapCorrectionsPath = path.resolve(__dirname, '../data/map_corrections.json');

const mosques = [
  {
    name: "Kurtuluş Çarşı ve Yeraltı Camii",
    shortDescription: "Kurtuluş Mahallesi çarşı merkezinde yer alan yeraltı camii.",
    detail: "İlçe merkezinin en hareketli ticaret caddesi olan Kurtuluş Mahallesi'nde yer alır. Çarşı esnafı ve ziyaretçiler için önemli bir ibadet noktasıdır.",
    address: "Kurtuluş Mahallesi, Düziçi",
    tag: "MERKEZ",
    lat: 37.232,
    lng: 36.441,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.232,36.441"
  },
  {
    name: "Düziçi Çarşı ve Ulu Cami",
    shortDescription: "Merkez çarşıda yer alan Düziçi'nin en eski camilerinden biri.",
    detail: "Uzun Banı ve Üzümlü mahalleleri arasında, eski pazar yerine yakın, geniş cemaat kapasiteli ve tarihi mimariye sahip merkez ulu camimizdir.",
    address: "Üzümlü Mahallesi, Düziçi",
    tag: "MERKEZ",
    lat: 37.240,
    lng: 36.446,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.240,36.446"
  },
  {
    name: "İrfanlı Camii",
    shortDescription: "İrfanlı Mahallesi'nin en büyük cemaat kapasiteli camii.",
    detail: "İlçe stadyumu ve yeni belediye binası civarında yer alan, modern mimariye sahip ve geniş bir bahçesi bulunan mahalle camimizdir.",
    address: "İrfanlı Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2462,
    lng: 36.4535,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2462,36.4535"
  },
  {
    name: "Hacılar Camii",
    shortDescription: "Hacılar (Hürriyet) bölgesinin merkezi ibadethanesi.",
    detail: "Çerçioğlu ve Yeşildere yolları kavşağına yakın, Hürriyet Mahallesi sınırları içerisindeki en büyük camidir.",
    address: "Hürriyet Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2515,
    lng: 36.4625,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2515,36.4625"
  },
  {
    name: "Toki Camii",
    shortDescription: "Düziçi Toki Konutları bölgesi camii.",
    detail: "Karacaören ve Toki Konutları bölgesinde yaşayan hemşehrilerimizin ibadet ihtiyaçlarını karşılamak üzere inşa edilmiş modern camidir.",
    address: "Toki Konutları, Düziçi",
    tag: "TOKİ",
    lat: 37.2592,
    lng: 36.4415,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2592,36.4415"
  },
  {
    name: "Uzunbanı Camii",
    shortDescription: "Uzunbanı Mahallesi'nin tarihi dokulu camii.",
    detail: "Çamiçi caddesi güzergâhında, asırlık çınar ağaçları altındaki yeşillikler içinde yer alan huzurlu bir mahalle camisidir.",
    address: "Uzunbanı Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2455,
    lng: 36.4390,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2455,36.4390"
  },
  {
    name: "Veysel Karani Camii",
    shortDescription: "Refik Cesur Bulvarı Çamiçi yönündeki modern cami.",
    detail: "Geniş avlusu, kubbe işlemeleri ve çift minaresiyle dikkat çeken, Çamiçi yolu üzerindeki modern ibadethanemizdir.",
    address: "Çamiçi Yolu, Düziçi",
    tag: "MAHALLE",
    lat: 37.2355,
    lng: 36.4580,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2355,36.4580"
  },
  {
    name: "Bilali Habeş Camii",
    shortDescription: "Üzümlü Mahallesi alt kesimi camii.",
    detail: "Tren yolu ve Yarbaşı sınırına yakın, Üzümlü Mahallesi'nin alt kesiminde sakin ve nezih bir bölgede yer alır.",
    address: "Üzümlü Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2280,
    lng: 36.4510,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2280,36.4510"
  },
  {
    name: "İmam-ı Azam Camii",
    shortDescription: "Yeşilova Mahallesi otogar kavşağı yakınındaki cami.",
    detail: "Yeni otogar ve sanayi sitesi kavşağı yakınlarında bulunan, transit yolcuların ve çevre esnafın sıklıkla kullandığı camidir.",
    address: "Yeşilova Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2340,
    lng: 36.4485,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2340,36.4485"
  },
  {
    name: "Yeşilova Camii",
    shortDescription: "Yeşilova Mahallesi merkez camii.",
    detail: "Mahalle okulunun hemen yanında yer alan, geleneksel taş mimariye sahip tarihi Yeşilova mahallesi camimizdir.",
    address: "Yeşilova Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2385,
    lng: 36.4490,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2385,36.4490"
  },
  {
    name: "Hz. Ukkaşe Camii",
    shortDescription: "Hürriyet Mahallesi üst kesimlerindeki yeni cami.",
    detail: "Amanos Dağları eteklerine yakın, temiz havası ve panoramik Düziçi manzarası olan yeni ibadethanemizdir.",
    address: "Hürriyet Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2480,
    lng: 36.4670,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2480,36.4670"
  },
  {
    name: "Milli Şair Mehmet Akif Ersoy Camii",
    shortDescription: "Karlıca Mahallesi sınırındaki yeni cami projesi.",
    detail: "Adını İstiklal Marşı şairimizden alan, Karlıca ve Hürriyet mahalleleri arasındaki yeni yerleşim bölgesinde hizmet veren camidir.",
    address: "Karlıca Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2410,
    lng: 36.4350,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2410,36.4350"
  },
  {
    name: "Yıldırım Beyazıt Camii",
    shortDescription: "Kurtuluş Mahallesi alt kesimlerindeki cami.",
    detail: "Yarbaşı belde yoluna yakın, Kurtuluş Mahallesi'nin batı yönündeki yerleşim yerinde sakin bir ibadet alanıdır.",
    address: "Kurtuluş Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2330,
    lng: 36.4310,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2330,36.4310"
  },
  {
    name: "Haruniye Camii",
    shortDescription: "Tarihi Haruniye belde merkezindeki ulu cami.",
    detail: "Haruniye kalesi eteklerinde, kaplıca yolu üzerindeki tarihi dokusu korunmuş ve restorasyon görmüş ulu camidir.",
    address: "Haruniye Beldesi, Düziçi",
    tag: "BELDE",
    lat: 37.3810,
    lng: 36.4920,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.3810,36.4920"
  },
  {
    name: "Ellek Merkez Camii",
    shortDescription: "Ellek Beldesi'nin en büyük camii.",
    detail: "Ellek belediye binası meydanında yer alan, geniş kubbesi ve yüksek minareleri olan beldenin kalbi niteliğindeki camidir.",
    address: "Ellek Beldesi, Düziçi",
    tag: "BELDE",
    lat: 37.2880,
    lng: 36.4800,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2880,36.4800"
  },
  {
    name: "Yarbaşı Merkez Camii",
    shortDescription: "Yarbaşı Beldesi merkez caddesindeki cami.",
    detail: "Yarbaşı belediyesi ve okulunun yakınlarında bulunan, yeşilliklerle çevrili ve huzurlu bir belde camisidir.",
    address: "Yarbaşı Beldesi, Düziçi",
    tag: "BELDE",
    lat: 37.1990,
    lng: 36.4300,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.1990,36.4300"
  },
  {
    name: "28 Mart Camii",
    shortDescription: "İstiklal Mahallesi 28 Mart caddesi üzerindeki cami.",
    detail: "İlçe kurtuluş günü olan 28 Mart adını taşıyan cadde üzerinde, çarşı girişine yakın merkezi camidir.",
    address: "İstiklal Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2425,
    lng: 36.4550,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2425,36.4550"
  },
  {
    name: "48 Evler Camii",
    shortDescription: "İrfanlı Mahallesi 48 Evler sitesi camii.",
    detail: "İlçe kütüphanesi ve 48 Evler konut yapı kooperatifi sitesi yakınında sakin bir park içinde yer alan camidir.",
    address: "İrfanlı Mahallesi, Düziçi",
    tag: "MAHALLE",
    lat: 37.2475,
    lng: 36.4455,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2475,36.4455"
  }
];

const hotels = [
  {
    name: "Karacaoğlan Otel",
    shortDescription: "Düziçi ilçe merkezinde konforlu konaklama hizmeti.",
    detail: "İlçe merkezinde, çarşıya ve resmi kurumlara yürüme mesafesinde yer alan temiz ve konforlu mahalle otelidir.",
    address: "Kurtuluş Mahallesi, Refik Cesur Bulvarı, Düziçi",
    tag: "MERKEZ",
    lat: 37.2405,
    lng: 36.4475,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2405,36.4475"
  },
  {
    name: "Düziçi Termal Otel",
    shortDescription: "Haruniye Kaplıcaları bünyesinde şifalı termal otel.",
    detail: "Düziçi'nin en önemli turizm noktası olan Haruniye Kaplıcaları içerisinde, şifalı kaplıca suları ve doğa manzarası eşliğinde konaklama imkanı.",
    address: "Haruniye Kaplıcaları Mevkii, Düziçi",
    tag: "KAPLICA",
    lat: 37.3815,
    lng: 36.4940,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.3815,36.4940"
  },
  {
    name: "Düziçi Öğretmenevi",
    shortDescription: "İrfanlı Mahallesi'nde güvenilir ve ekonomik konaklama tesisi.",
    detail: "Geniş bahçesi, kafeteryası ve otoparkı bulunan, tüm vatandaşlarımızın yararlanabileceği konforlu konaklama tesisi.",
    address: "İrfanlı Mahallesi, Düziçi",
    tag: "MERKEZ",
    lat: 37.2450,
    lng: 36.4520,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2450,36.4520"
  }
];

function run() {
  console.log('🔄 Loading city_content.json...');
  const content = JSON.parse(fs.readFileSync(cityContentPath, 'utf8'));

  // 1. Add 'ibadet' category into explore.categories if not exists
  if (!content.explore) content.explore = {};
  if (!content.explore.categories) content.explore.categories = [];

  const existingIbadetIndex = content.explore.categories.findIndex(c => c.id === 'ibadet');
  const ibadetCategory = {
    id: "ibadet",
    icon: "mosque",
    badge: "İbadet",
    title: "İbadethaneler",
    places: mosques.map(m => ({
      name: m.name,
      shortDescription: m.shortDescription,
      detail: m.detail,
      address: m.address,
      tag: m.tag,
      image: "assets/images/mosque_placeholder.jpg",
      lat: m.lat,
      lng: m.lng,
      googleMapsUrl: m.googleMapsUrl
    })),
    subtitle: "Düziçi ve beldelerindeki camilerimiz"
  };

  if (existingIbadetIndex !== -1) {
    content.explore.categories[existingIbadetIndex] = ibadetCategory;
    console.log('✅ Updated existing mosques category.');
  } else {
    // Insert after guide
    const guideIndex = content.explore.categories.findIndex(c => c.id === 'guide');
    if (guideIndex !== -1) {
      content.explore.categories.splice(guideIndex + 1, 0, ibadetCategory);
    } else {
      content.explore.categories.push(ibadetCategory);
    }
    console.log('✅ Added new mosques category.');
  }

  // Add hotels category
  const existingHotelsIndex = content.explore.categories.findIndex(c => c.id === 'hotels');
  const hotelsCategory = {
    id: "hotels",
    icon: "hotel",
    badge: "Otel",
    title: "Oteller",
    places: hotels.map(h => ({
      name: h.name,
      shortDescription: h.shortDescription,
      detail: h.detail,
      address: h.address,
      tag: h.tag,
      image: "assets/images/hotel_placeholder.jpg",
      lat: h.lat,
      lng: h.lng,
      googleMapsUrl: h.googleMapsUrl
    })),
    subtitle: "Düziçi ve çevresindeki konaklama yerleri"
  };

  if (existingHotelsIndex !== -1) {
    content.explore.categories[existingHotelsIndex] = hotelsCategory;
    console.log('✅ Updated existing hotels category.');
  } else {
    const ibadetIndex = content.explore.categories.findIndex(c => c.id === 'ibadet');
    if (ibadetIndex !== -1) {
      content.explore.categories.splice(ibadetIndex + 1, 0, hotelsCategory);
    } else {
      content.explore.categories.push(hotelsCategory);
    }
    console.log('✅ Added new hotels category.');
  }

  // 2. Add coords to local_market directoryData
  const localMarket = content.explore.cityServices.find(s => s.id === 'local_market');
  if (localMarket && localMarket.directoryData) {
    const coordsMap = {
      "Pazartesi Pazarı": { lat: 37.2398, lng: 36.4468 },
      "Çarşamba Pazarı": { lat: 37.2322, lng: 36.4409 },
      "Cuma Pazarı": { lat: 37.2442, lng: 36.4512 }
    };
    localMarket.directoryData.forEach(d => {
      if (coordsMap[d.name]) {
        d.lat = coordsMap[d.name].lat;
        d.lng = coordsMap[d.name].lng;
      }
    });
    console.log('✅ Added market coordinates inside local_market.');
  }

  // 3. Add more fuel stations
  if (content.services && content.services.fuel && content.services.fuel.stations) {
    const existingIds = new Set(content.services.fuel.stations.map(s => s.id));
    const extraStations = [
      {
        id: "fuel_tp_merkez",
        lat: 37.2435,
        lng: 36.4522,
        name: "TP Petrol Merkez",
        brand: "TP",
        hours: "7/24",
        address: "İrfanlı Mah., Atatürk Caddesi, Düziçi"
      },
      {
        id: "fuel_bp_merkez",
        lat: 37.2365,
        lng: 36.4445,
        name: "BP Çarşı",
        brand: "BP",
        hours: "7/24",
        address: "Kurtuluş Mah., Şehit Ahmet Metlioğlu Cad., Düziçi"
      },
      {
        id: "fuel_lukoil_merkez",
        lat: 37.2422,
        lng: 36.4605,
        name: "Lukoil Hürriyet",
        brand: "Lukoil",
        hours: "06:00 – 24:00",
        address: "Hürriyet Mah., Refik Cesur Bulvarı, Düziçi"
      },
      {
        id: "fuel_aytemiz_yarbasi",
        lat: 37.2210,
        lng: 36.4320,
        name: "Aytemiz Yarbaşı",
        brand: "Aytemiz",
        hours: "7/24",
        address: "Yarbaşı Girişi, D.400 Karayolu Üzeri, Düziçi"
      }
    ];

    extraStations.forEach(s => {
      if (!existingIds.has(s.id)) {
        content.services.fuel.stations.push(s);
      }
    });
    console.log('✅ Added extra fuel stations.');
  }

  // Save changes to city_content.json
  fs.writeFileSync(cityContentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log('✅ city_content.json updated successfully!');

  // 4. Update map_corrections.json
  console.log('🔄 Loading map_corrections.json...');
  const corrections = JSON.parse(fs.readFileSync(mapCorrectionsPath, 'utf8'));
  if (!corrections.places) corrections.places = {};

  mosques.forEach(m => {
    corrections.places[m.name] = {
      lat: m.lat,
      lng: m.lng,
      googleMapsUrl: m.googleMapsUrl
    };
  });

  hotels.forEach(h => {
    corrections.places[h.name] = {
      lat: h.lat,
      lng: h.lng,
      googleMapsUrl: h.googleMapsUrl
    };
  });

  // Add markets to map corrections
  corrections.places["Pazartesi Pazarı"] = { lat: 37.2398, lng: 36.4468, googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2398,36.4468" };
  corrections.places["Çarşamba Pazarı"] = { lat: 37.2322, lng: 36.4409, googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2322,36.4409" };
  corrections.places["Cuma Pazarı"] = { lat: 37.2442, lng: 36.4512, googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=37.2442,36.4512" };

  fs.writeFileSync(mapCorrectionsPath, JSON.stringify(corrections, null, 2) + '\n', 'utf8');
  console.log('✅ map_corrections.json updated successfully!');
}

run();
