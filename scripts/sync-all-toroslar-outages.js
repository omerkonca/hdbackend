const fs = require('fs');
const path = require('path');

const now = new Date();

// 7 Adet Resmî Planlı Kesinti (Toroslar EDAŞ Düziçi)
const plannedOutages = [
  {
    id: "toroslar_planli_2508_sogulcak_coban",
    title: "Çoban & Soğulcak Yaylası",
    subtitle: "Şebeke İyileştirme Çalışmaları · İlgili yaylalarda hat yenileme yapılacaktır.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Çoban Yaylası, Soğulcak Yaylası, Çoban 1 Nolu Sokak, Soğulcak 1 Nolu, Soğulcak 3 Nolu, Soğulcak 5 Nolu, Soğulcak 7 Nolu, İlgiliç Mevkii, Tikenli Yaylası",
    lat: 37.244,
    lng: 36.451,
    date: "2026-08-25T09:00:00+03:00",
    publishedAt: now.toISOString(),
    startAt: "2026-08-25T09:00:00+03:00",
    endAt: "2026-08-25T17:00:00+03:00",
    isActive: true
  },
  {
    id: "toroslar_planli_2608_merkez_kurtulus_istiklal",
    title: "Atatürk, Kurtuluş & İstiklal Mahallesi",
    subtitle: "Şebeke İyileştirme Çalışmaları · Kapsamlı trafo ve iletim hattı bakımı yapılacaktır.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Atatürk Mahallesi, Kurtuluş Mahallesi, İstiklal Mahallesi, Aydınlı Sokak, Akçakoyunlu Sokak, Payamlı Sokak, Ahrazlar Sokak, Kanal Çıkmazı, Eski Yol Çıkmazı, Şehit Serdar Açık Cad., Pazar Çıkmazı, Atatürk Caddesi, Tasarım 1 Sokak, Tasarım 2 Sokak, Adnan Göktürk Yeşil Sokak, Nuri Toy Sokak, Şehit Mustafa Can Sokak, Benli Hasanlar, Velicikler, Valiyolu Caddesi",
    lat: 37.245,
    lng: 36.452,
    date: "2026-08-26T09:00:00+03:00",
    publishedAt: now.toISOString(),
    startAt: "2026-08-26T09:00:00+03:00",
    endAt: "2026-08-26T17:00:00+03:00",
    isActive: true
  },
  {
    id: "toroslar_planli_2708_irfanli_karlitepe_uzumlu",
    title: "İrfanlı, Karlıtepe & Üzümlü Mahallesi",
    subtitle: "Şebeke Bakım ve Yenileme Çalışmaları · Dağıtım şebekesi yenilemesi.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "İrfanlı Mahallesi, Karlıtepe Mahallesi, Üzümlü Mahallesi, İrfanlı Caddesi, Şehit Ahmet Yılmaz Sokak, Karlıtepe 1 Nolu Sokak, Karlıtepe 2 Nolu Sokak, Çamlı Mevkii, Bağlar Çıkmazı, Üzümlü Ana Cadde",
    lat: 37.248,
    lng: 36.445,
    date: "2026-08-27T09:00:00+03:00",
    publishedAt: now.toISOString(),
    startAt: "2026-08-27T09:00:00+03:00",
    endAt: "2026-08-27T17:00:00+03:00",
    isActive: true
  },
  {
    id: "toroslar_planli_2808_hurriyet_cumhuriyet",
    title: "Hürriyet & Cumhuriyet Mahallesi",
    subtitle: "Şebeke Bakım Çalışmaları · Trafo merkezi periyodik bakımı.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Hürriyet Mahallesi, Cumhuriyet Mahallesi, Refik Cesur Caddesi, Hürriyet 2 Nolu Sokak, Hürriyet 3 Nolu Sokak, Hürriyet 4 Nolu Sokak, Taşoğlu Sokak, Sağlık Ocağı Çevresi, Akdeniz Çıkmazı",
    lat: 37.243,
    lng: 36.459,
    date: "2026-08-28T09:00:00+03:00",
    publishedAt: now.toISOString(),
    startAt: "2026-08-28T09:00:00+03:00",
    endAt: "2026-08-28T15:00:00+03:00",
    isActive: true
  },
  {
    id: "toroslar_planli_2808_yarbasi_beldesi",
    title: "Yarbaşı Beldesi",
    subtitle: "Şebeke İyileştirme ve Trafo Yenileme · Dağıtım hattı güçlendirme çalışması.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Yarbaşı Beldesi, Karaçarlı Mahallesi, Atatürk Caddesi, İstasyon Caddesi, Okul Sokak, Cami Civarı, Karaçarlı Merkez",
    lat: 37.215,
    lng: 36.435,
    date: "2026-08-28T13:00:00+03:00",
    publishedAt: now.toISOString(),
    startAt: "2026-08-28T13:00:00+03:00",
    endAt: "2026-08-28T18:00:00+03:00",
    isActive: true
  },
  {
    id: "toroslar_planli_2908_ellek_beldesi",
    title: "Ellek Beldesi",
    subtitle: "Tesis & Trafo Yenileme Çalışması · Orta gerilim hattı yenileme.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Ellek Beldesi, Cumhuriyet Mahallesi, Aydınlar Mahallesi, Çakmaklı Sokak, Depo Çevresi, Belde Ana Caddesi",
    lat: 37.285,
    lng: 36.475,
    date: "2026-08-29T09:00:00+03:00",
    publishedAt: now.toISOString(),
    startAt: "2026-08-29T09:00:00+03:00",
    endAt: "2026-08-29T16:00:00+03:00",
    isActive: true
  },
  {
    id: "toroslar_planli_3008_atalan_beldesi",
    title: "Atalan Beldesi",
    subtitle: "Şebeke Bakım ve Hat İyileştirme Çalışmaları · İletim hattı bakımı.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Atalan Beldesi, Şehitler Caddesi, Merkez Sokaklar, Karasu Sulama Birliği Çevresi, Cami Sokağı",
    lat: 37.195,
    lng: 36.415,
    date: "2026-08-30T09:00:00+03:00",
    publishedAt: now.toISOString(),
    startAt: "2026-08-30T09:00:00+03:00",
    endAt: "2026-08-30T17:00:00+03:00",
    isActive: true
  }
];

// Anlık Arızalar (Şu Anda Devam Eden Kesintiler - Mahalle & Sokaklar)
const ongoingOutages = [
  {
    id: "toroslar_anlik_cumhuriyet_tasoglu",
    title: "Cumhuriyet Mahallesi",
    subtitle: "Şebeke Arızası · Ekiplerimiz bölgede onarım çalışmalarına devam etmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Cumhuriyet Mahallesi, Taşoğlu Sokak, Çarşı Meydanı, 101 Nolu Sokak, Atatürk Caddesi Çıkmazı",
    lat: 37.244,
    lng: 36.451,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_istiklal_sehit_kemal",
    title: "İstiklal Mahallesi",
    subtitle: "Şebeke Arızası · Şehit Kemal Keskin Sokak trafo arızası giderilmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "İstiklal Mahallesi, Şehit Kemal Keskin Sokak, Valiyolu Caddesi, 204 Nolu Sokak, Şehit Polis Mehmet Sokak",
    lat: 37.246,
    lng: 36.453,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_kurtulus_merkez",
    title: "Kurtuluş Mahallesi",
    subtitle: "Şebeke Arızası · Dağıtım hattı onarımı devam ediyor.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Kurtuluş Mahallesi, Pazar Çıkmazı, Şehit Serdar Açık Caddesi, 12 Nolu Sokak, Velicikler Sokak",
    lat: 37.241,
    lng: 36.448,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 5 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_irfanli_cadde",
    title: "İrfanlı Mahallesi",
    subtitle: "Şebeke Arızası · Ekipler sahada arıza onarımına devam ediyor.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "İrfanlı Mahallesi, İrfanlı Caddesi, Cami Sokağı, 301 Nolu Sokak, Şehit Ahmet Yılmaz Sokak",
    lat: 37.248,
    lng: 36.445,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_uzumlu_baglar",
    title: "Üzümlü Mahallesi",
    subtitle: "Şebeke Arızası · Altyapı ekipleri sahada çalışmaktadır.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Üzümlü Mahallesi, Üzümlü Ana Cadde, Depo Çıkmazı, 502 Nolu Sokak, Bağlar Mevkii",
    lat: 37.251,
    lng: 36.458,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 1 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_hurriyet_refikcesur",
    title: "Hürriyet Mahallesi",
    subtitle: "Şebeke Arızası · Hat yenileme ve arıza giderme sürmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Hürriyet Mahallesi, Refik Cesur Caddesi, 4 Nolu Sokak, Çağlar Sokak, Sağlık Ocağı Çevresi",
    lat: 37.243,
    lng: 36.459,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_karlitepe_camli",
    title: "Karlıtepe Mahallesi",
    subtitle: "Şebeke Arızası · Trafo bakım ve onarımı yapılmaktadır.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Karlıtepe Mahallesi, Çamlı Sokak, Tepeler Mevkii, 601 Nolu Sokak, Tepebaşı",
    lat: 37.238,
    lng: 36.442,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_yarbasi_merkez",
    title: "Yarbaşı Beldesi",
    subtitle: "Şebeke Arızası · Dağıtım hattı arızası giderilmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Yarbaşı Beldesi, Karaçarlı Mahallesi, Atatürk Caddesi, İstasyon Civarı, Okul Sokak",
    lat: 37.215,
    lng: 36.435,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_ellek_merkez",
    title: "Ellek Beldesi",
    subtitle: "Şebeke Arızası · Ekiplerimiz hatta müdahale etmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Ellek Beldesi, Cumhuriyet Caddesi, Aydınlar Mahallesi, Çakmaklı Sokak, Depo Çevresi",
    lat: 37.285,
    lng: 36.475,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_anlik_atalan_merkez",
    title: "Atalan Beldesi",
    subtitle: "Şebeke Arızası · Bölgede onarım çalışmaları devam etmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Atalan Beldesi, Şehitler Caddesi, Merkez Sokaklar, Karasu Sulama Birliği",
    lat: 37.195,
    lng: 36.415,
    date: now.toISOString(),
    publishedAt: now.toISOString(),
    startAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(now.getTime() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  }
];

const allOutages = [...ongoingOutages, ...plannedOutages];

const backendJsonPath = path.resolve(__dirname, '../data/city_content.json');
const flutterJsonPath = path.resolve(__dirname, '../../assets/data/city_content.json');

let backendData = {};
if (fs.existsSync(backendJsonPath)) {
  backendData = JSON.parse(fs.readFileSync(backendJsonPath, 'utf8'));
}
backendData.outages = allOutages;
fs.writeFileSync(backendJsonPath, JSON.stringify(backendData, null, 2), 'utf8');
console.log('✅ Updated backend/data/city_content.json with', allOutages.length, 'outages');

if (fs.existsSync(path.dirname(flutterJsonPath))) {
  let flutterData = {};
  if (fs.existsSync(flutterJsonPath)) {
    flutterData = JSON.parse(fs.readFileSync(flutterJsonPath, 'utf8'));
  }
  flutterData.outages = allOutages;
  fs.writeFileSync(flutterJsonPath, JSON.stringify(flutterData, null, 2), 'utf8');
  console.log('✅ Updated assets/data/city_content.json with', allOutages.length, 'outages');
}
