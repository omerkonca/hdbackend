const fs = require('fs');
const path = require('path');
const supabase = require('../src/utils/supabaseClient');

const toroslarOutages = [
  {
    id: "toroslar_cumhuriyet_1",
    title: "Cumhuriyet Mah. Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Bölgede bilgimiz dahilinde bir arıza bulunmaktadır. En kısa sürede enerjinin verilmesi sağlanacaktır.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Cumhuriyet Mahallesi",
    lat: 37.244,
    lng: 36.451,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_istiklal_sehit_kemal_keskin",
    title: "İstiklal Mah. Şehit Kemal Keskin Sok. Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Şehit Kemal Keskin Sokak bölgesinde arıza onarım çalışmaları devam etmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "İstiklal Mahallesi, Şehit Kemal Keskin Sokak",
    lat: 37.246,
    lng: 36.453,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_kurtulus_1",
    title: "Kurtuluş Mah. Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Ekiplerimiz arızaya müdahale etmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Kurtuluş Mahallesi",
    lat: 37.241,
    lng: 36.448,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_irfanli_1",
    title: "İrfanlı Mah. Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Çalışmalar devam ediyor. En kısa sürede enerji verilecektir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "İrfanlı Mahallesi",
    lat: 37.248,
    lng: 36.445,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_uzumlu_1",
    title: "Üzümlü Mah. Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Altyapı ekiplerinin arıza giderme çalışmaları sürmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Üzümlü Mahallesi",
    lat: 37.251,
    lng: 36.458,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_hurriyet_1",
    title: "Hürriyet Mah. Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Bölgede anlık arıza onarım süreci devam etmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Hürriyet Mahallesi",
    lat: 37.243,
    lng: 36.459,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_karlitepe_1",
    title: "Karlıtepe Mah. Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Trafo ve hat kontrolleri yapılmaktadır.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Karlıtepe Mahallesi",
    lat: 37.238,
    lng: 36.442,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_yarbasi_1",
    title: "Yarbaşı Beldesi Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Dağıtım hattı arızası giderilmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Yarbaşı Beldesi, Merkez ve Bağlı Sokaklar",
    lat: 37.215,
    lng: 36.435,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_ellek_1",
    title: "Ellek Beldesi Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Çalışmalar devam ediyor.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Ellek Beldesi",
    lat: 37.285,
    lng: 36.475,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_atalan_1",
    title: "Atalan Beldesi Elektrik Kesintisi",
    subtitle: "Şebeke Arızası · Bölgede onarım çalışmaları sürmektedir.",
    type: "ELEKTRİK",
    status: "Devam Ediyor",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Atalan Beldesi",
    lat: 37.195,
    lng: 36.415,
    date: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    isActive: true
  },
  {
    id: "toroslar_planli_coban_sogulcak",
    title: "Düziçi Elektrik Kesintisi (Çoban & Soğulcak Yaylası)",
    subtitle: "Şebeke bakım ve yenileme çalışmaları nedeniyle planlı kesinti uygulanacaktır.",
    type: "ELEKTRİK",
    status: "Planlandı",
    source: "Toroslar EDAŞ",
    sourceKind: "toroslar",
    url: "https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama",
    area: "Çoban Yaylası (1 Nolu Sokak dahil), Soğulcak Yaylası (1, 3, 5, 7 Nolu Sokaklar), Tikenli Mevkii",
    lat: 37.244,
    lng: 36.451,
    date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    publishedAt: new Date().toISOString(),
    startAt: new Date(Date.now() + 9 * 3600 * 1000).toISOString(),
    endAt: new Date(Date.now() + 17 * 3600 * 1000).toISOString(),
    isActive: true
  }
];

async function sync() {
  console.log('🔄 Syncing Toroslar outages to city_content.json and Supabase...');
  
  const backendJsonPath = path.resolve(__dirname, '../data/city_content.json');
  const flutterJsonPath = path.resolve(__dirname, '../../assets/data/city_content.json');

  let data = {};
  if (fs.existsSync(backendJsonPath)) {
    data = JSON.parse(fs.readFileSync(backendJsonPath, 'utf8'));
  }

  data.outages = toroslarOutages;

  fs.writeFileSync(backendJsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('✅ Updated backend/data/city_content.json with', toroslarOutages.length, 'outages');

  if (fs.existsSync(path.dirname(flutterJsonPath))) {
    fs.writeFileSync(flutterJsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('✅ Updated assets/data/city_content.json with', toroslarOutages.length, 'outages');
  }

  // Update Supabase city_content table
  try {
    const { error } = await supabase
      .from('city_content')
      .update({ outages: toroslarOutages, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (error) {
      console.warn('⚠️ Supabase update warning:', error.message);
    } else {
      console.log('✅ Successfully updated Supabase city_content table!');
    }
  } catch (e) {
    console.warn('⚠️ Supabase sync exception:', e.message);
  }

  console.log('🎉 Toroslar outages sync finished successfully!');
}

sync();
