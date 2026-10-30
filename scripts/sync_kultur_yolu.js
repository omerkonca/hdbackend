const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const newEvents = [
  {
    id: 'adana-kultur-yolu-2026-genel',
    title: 'Adana Kültür Yolu Festivali 2026 (Ana Festival Programı)',
    category: 'Festival',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park & Müze Kompleksi',
    date: '2026-11-07T07:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-sagopa-kajmer-2026',
    title: 'Sagopa Kajmer Konseri (Kültür Yolu Festivali)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-07T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-ahmet-safak-2026',
    title: 'Ahmet Şafak Konseri (Kültür Yolu Festivali)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-08T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-sefo-2026',
    title: 'Sefo Konseri (Kültür Yolu Festivali)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-09T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-ataturk-senfoni-2026',
    title: "10 Kasım Atatürk'ü Anma Özel Senfoni Konseri",
    category: 'Kültür & Sanat',
    city: 'Adana',
    district: 'Seyhan',
    location: '01 Burda PGM Sahne / Çukurova Senfoni',
    date: '2026-11-10T17:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-serkan-kaya-2026',
    title: 'Serkan Kaya Konseri (Kültür Yolu Festivali)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-11T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-simge-2026',
    title: 'Simge Konseri (Kültür Yolu Festivali)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-12T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-ebru-yasar-2026',
    title: 'Ebru Yaşar Konseri (Kültür Yolu Festivali)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-13T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-demet-akalin-2026',
    title: 'Demet Akalın Konseri (Kültür Yolu Festivali)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-14T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-murat-boz-2026',
    title: 'Murat Boz - Büyük Kapanış Konseri (Kültür Yolu)',
    category: 'Konser',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Ana Sahnesi',
    date: '2026-11-15T18:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-dijital-sanat-2026',
    title: 'Çağdaş Sanat & Dijital Işık Sergileri (Kültür Yolu)',
    category: 'Kültür & Sanat',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Yeni Müze Kompleksi (Milli Mensucat)',
    date: '2026-11-07T08:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  },
  {
    id: 'adana-kultur-yolu-cocuk-senligi-2026',
    title: 'Çocuk Köyü, Tiyatro ve Eğlence Şenliği (Kültür Yolu)',
    category: 'Kültür & Sanat',
    city: 'Adana',
    district: 'Seyhan',
    location: 'Adana Merkez Park Çocuk Alanı',
    date: '2026-11-08T10:00:00.000Z',
    imageUrl: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&q=80',
    price: 'Ücretsiz (Halka Açık)',
    link: 'https://kulturyolufestivali.com',
    source: 'T.C. Kültür ve Turizm Bakanlığı'
  }
];

async function updateAll() {
  const backendJsonPath = path.resolve(__dirname, '../data/city_content.json');
  const flutterJsonPath = path.resolve(__dirname, '../../assets/data/city_content.json');

  // 1. Update backend/data/city_content.json
  const backendData = JSON.parse(fs.readFileSync(backendJsonPath, 'utf8'));
  const currentCE = backendData.customEvents || [];
  const filteredCE = currentCE.filter(e => !e.id.startsWith('adana-kultur-yolu-'));
  backendData.customEvents = [...newEvents, ...filteredCE];
  fs.writeFileSync(backendJsonPath, JSON.stringify(backendData, null, 2), 'utf8');
  console.log('✅ Updated backend/data/city_content.json');

  // 2. Update assets/data/city_content.json
  const flutterData = JSON.parse(fs.readFileSync(flutterJsonPath, 'utf8'));
  const flutterCE = flutterData.customEvents || [];
  const filteredFlutterCE = flutterCE.filter(e => !e.id.startsWith('adana-kultur-yolu-'));
  flutterData.customEvents = [...newEvents, ...filteredFlutterCE];
  fs.writeFileSync(flutterJsonPath, JSON.stringify(flutterData, null, 2), 'utf8');
  console.log('✅ Updated assets/data/city_content.json');

  // 3. Update Supabase Postgres DB
  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const res = await client.query('SELECT data FROM city_contents WHERE id = 1');
    const dbData = res.rows[0].data;
    const dbCE = dbData.customEvents || [];
    const filteredDbCE = dbCE.filter(e => !e.id.startsWith('adana-kultur-yolu-'));
    dbData.customEvents = [...newEvents, ...filteredDbCE];

    await client.query('UPDATE city_contents SET data = $1, updated_at = $2 WHERE id = 1', [
      dbData,
      new Date().toISOString()
    ]);
    console.log('🎉 Successfully updated Supabase database with Adana Kültür Yolu Festivali events!');
    await client.end();
  }
}

updateAll().catch(err => {
  console.error('❌ Error updating:', err);
  process.exit(1);
});

