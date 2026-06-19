const fs = require('fs');
const path = require('path');

const filePaths = [
  path.resolve(__dirname, '../data/city_content.json'),
  path.resolve(__dirname, '../../assets/data/city_content.json')
];

const newSchools = [
  {
    name: "Düziçi Meslek Yüksekokulu (OKÜ)",
    shortDescription: "Korkut Ata Üniversitesi Düziçi Meslek Yüksekokulu.",
    detail: "Osmaniye Korkut Ata Üniversitesi bünyesinde çeşitli ön lisans programlarıyla eğitim veren yükseköğretim kurumudur.",
    address: "Karşıyaka Mah., Düziçi Meslek Yüksekokulu Kampüsü, Düziçi",
    tag: "YÜKSEKOKUL",
    lat: 37.2325,
    lng: 36.4620,
    image: "assets/images/school_placeholder.jpg"
  },
  {
    name: "Düziçi Karacaoğlan Mesleki ve Teknik Anadolu Lisesi",
    shortDescription: "Karacaoğlan Mahallesi meslek lisemiz.",
    detail: "Gençlerimize mesleki ve teknik beceriler kazandıran, bünyesinde çeşitli atölyeler bulunduran başarılı lisedir.",
    address: "Cumhuriyet Mah., Karacaoğlan Sokak, Düziçi",
    tag: "LİSE",
    lat: 37.2430,
    lng: 36.4460,
    image: "assets/images/school_placeholder.jpg"
  },
  {
    name: "Düziçi Fen Bilimleri Etüt Merkezi",
    shortDescription: "Düziçi ilçe merkezindeki başarılı özel öğretim kursu.",
    detail: "LGS, YKS hazırlık süreçlerinde öğrencilerimize destek eğitimleri sunan, modern dersliklere sahip etüt merkezidir.",
    address: "Cumhuriyet Mah., Refik Cesur Bulvarı, Düziçi",
    tag: "ETÜT",
    lat: 37.2442,
    lng: 36.4522,
    image: "assets/images/school_placeholder.jpg"
  },
  {
    name: "Düziçi Şehit Barış Aybek Mesleki ve Teknik Anadolu Lisesi",
    shortDescription: "Teknik ve mesleki eğitim veren lisemiz.",
    detail: "Elektrik, elektronik, makine ve bilişim alanlarında nitelikli eleman yetiştiren mesleki eğitim kurumumuzdur.",
    address: "İrfanlı Mah., Lise Caddesi, Düziçi",
    tag: "LİSE",
    lat: 37.2482,
    lng: 36.4552,
    image: "assets/images/school_placeholder.jpg"
  }
];

async function expandSchools() {
  try {
    for (const filePath of filePaths) {
      console.log(`Processing: ${filePath}...`);
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}, skipping.`);
        continue;
      }
      
      const raw = fs.readFileSync(filePath, 'utf8');
      const content = JSON.parse(raw);

      if (content.explore && content.explore.categories) {
        const schoolCat = content.explore.categories.find(c => c.id === 'school');
        if (schoolCat) {
          for (const s of newSchools) {
            if (!schoolCat.places.some(p => p.name === s.name)) {
              schoolCat.places.push({
                ...s,
                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
              });
              console.log(`  Added School: ${s.name}`);
            }
          }
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
      console.log(`✅ Saved school modifications back to: ${filePath}`);
    }
  } catch (err) {
    console.error('❌ School expansion failed:', err);
  }
}

expandSchools();
