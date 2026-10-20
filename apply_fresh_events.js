const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const freshScraped = [
  {
    "title": "CRUSH",
    "city": "Adana",
    "location": "Adana Çukurova Üniversitesi Festival Alanı",
    "dateText": "25 Ekim 2026 21:00",
    "price": "1540 ₺'den itibaren",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/crush-adana-cukurova-universitesi-festival-alani.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/crush-",
    "category": "Festival"
  },
  {
    "title": "Şebnem Ferah",
    "city": "Adana",
    "location": "Adana Çukurova Üniversitesi Festival Alanı",
    "dateText": "31 Ekim 2026 21:30",
    "price": "2500 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/sebnem-ferah.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/sebnem-ferah----",
    "category": "Konser"
  },
  {
    "title": "Levent Yüksel",
    "city": "Adana",
    "location": "Adana Çukurova Üniversitesi Açıkhava Tiyatrosu",
    "dateText": "20 Ekim 2026 21:00",
    "price": "1675 ₺'den itibaren",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/levent-yuksel.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/levent--yuksel-",
    "category": "Konser"
  },
  {
    "title": "Melek Mosso Konseri",
    "city": "Adana",
    "location": "Adana Çukurova Üniversitesi Açıkhava Tiyatrosu",
    "dateText": "21 Ekim 2026 20:30",
    "price": "935 ₺'den itibaren",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/melek-mosso-adana.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/melek--mosso--konseri",
    "category": "Konser"
  },
  {
    "title": "Çok Güzel Hareketler 2",
    "city": "Adana",
    "location": "Çukurova Üniversitesi Kongre Merkezi",
    "dateText": "19 Aralık 2026 15:30",
    "price": "1400 ₺'den itibaren",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/cok-guzel-hareketler-2.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/cok-guzel-hareketler-2-",
    "category": "Tiyatro"
  },
  {
    "title": "Melis Fis Konseri",
    "city": "Adana",
    "location": "01 Burda PGM Sahne - Adana",
    "dateText": "31 Ekim 2026 17:00",
    "price": "1350 ₺'den itibaren",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/melis-fis.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/melis-fis--konseri",
    "category": "Konser"
  },
  {
    "title": "Gökhan Çınar - Katarsis - Gel Yeniden Başlayalım",
    "city": "Adana",
    "location": "Adana Çukurova Üniversitesi Açıkhava Tiyatrosu",
    "dateText": "23 Ekim 2026 21:00",
    "price": "1100 ₺'den itibaren",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/gokhan-cinar.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/gokhan-cinar-katarsis-gel-yeniden-baslayalim",
    "category": "Kültür & Sanat"
  },
  {
    "title": "OKTOBERFEST - Adana",
    "city": "Adana",
    "location": "Adana HiltonSA",
    "dateText": "24 Ekim 2026 18:00",
    "price": "1390 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/oktoberfest.jpg",
    "link": "https://www.bubilet.com.tr/adana/etkinlik/oktoberfest-adana-hiltonsa",
    "category": "Festival"
  },
  {
    "title": "Motive Konseri",
    "city": "Mersin",
    "location": "Mersin Yenişehir Belediyesi Atatürk Kültür Merkezi",
    "dateText": "28 Ekim 2026 21:00",
    "price": "750 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/motive.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/motive-mersin",
    "category": "Konser"
  },
  {
    "title": "Duman Konseri",
    "city": "Mersin",
    "location": "Mersin Mezitli Açıkhava Tiyatrosu",
    "dateText": "04 Kasım 2026 21:00",
    "price": "900 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/duman.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/duman-mersin",
    "category": "Konser"
  },
  {
    "title": "Şehriban'la Memleket Kahkahası",
    "city": "Mersin",
    "location": "Yenişehir Belediyesi Barış Salonu",
    "dateText": "14 Kasım 2026 20:00",
    "price": "550 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/sehribanla-memleket.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/sehribanla-memleket-kahkahasi",
    "category": "Stand-Up"
  },
  {
    "title": "Gökhan Çınar - Katarsis - Gel Yeniden Başlayalım",
    "city": "Mersin",
    "location": "Mersin Mezitli Açıkhava Tiyatrosu",
    "dateText": "24 Ekim 2026 21:00",
    "price": "900 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/gokhan-cinar.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/gokhan-cinar-katarsis-gel-yeniden-baslayalim",
    "category": "Kültür & Sanat"
  },
  {
    "title": "Hikayeden Adamlar - Mahalle Turnesi",
    "city": "Mersin",
    "location": "Mersin Yenişehir Belediyesi Sahnesi",
    "dateText": "18 Kasım 2026 20:30",
    "price": "600 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/hikayeden-adamlar.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/hikayeden-adamlar-mahalle",
    "category": "Tiyatro"
  },
  {
    "title": "Sefa Doğanay - Tek Mi Sandınız?",
    "city": "Mersin",
    "location": "Mersin Kültür Merkezi",
    "dateText": "21 Kasım 2026 20:00",
    "price": "700 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/sefa-doganay.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/sefa-doganay-show",
    "category": "Stand-Up"
  },
  {
    "title": "Leman Sam Konseri",
    "city": "Mersin",
    "location": "Mersin Açıkhava Tiyatrosu",
    "dateText": "29 Ekim 2026 20:30",
    "price": "850 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/leman-sam.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/leman-sam-konseri",
    "category": "Konser"
  },
  {
    "title": "Melis Fis Konseri",
    "city": "Mersin",
    "location": "Mersin Mezitli Açıkhava",
    "dateText": "01 Kasım 2026 20:00",
    "price": "750 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/melis-fis.jpg",
    "link": "https://www.bubilet.com.tr/mersin/etkinlik/melis-fis--konseri",
    "category": "Konser"
  },
  {
    "title": "Candles and Echoes - Gaziantep",
    "city": "Gaziantep",
    "location": "Şehitkamil Sanat Merkezi",
    "dateText": "07 Kasım 2026 20:30",
    "price": "800 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/candles-and-echoes.jpg",
    "link": "https://www.bubilet.com.tr/gaziantep/etkinlik/candles-and-echoes-gaziantep",
    "category": "Konser"
  },
  {
    "title": "Motive Konseri",
    "city": "Gaziantep",
    "location": "GAÜN Mavera KSM",
    "dateText": "29 Ekim 2026 21:00",
    "price": "850 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/motive.jpg",
    "link": "https://www.bubilet.com.tr/gaziantep/etkinlik/motive-gaziantep",
    "category": "Konser"
  },
  {
    "title": "Sagopa Kajmer Konseri",
    "city": "Gaziantep",
    "location": "GAÜN Mavera KSM",
    "dateText": "06 Kasım 2026 21:00",
    "price": "950 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/sagopa-kajmer.jpg",
    "link": "https://www.bubilet.com.tr/gaziantep/etkinlik/sagopa-kajmer-konseri",
    "category": "Konser"
  },
  {
    "title": "Gökhan Türkmen Konseri",
    "city": "Gaziantep",
    "location": "Şahinbey Kongre ve Sanat Merkezi",
    "dateText": "13 Kasım 2026 21:00",
    "price": "850 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/gokhan-turkmen.jpg",
    "link": "https://www.bubilet.com.tr/gaziantep/etkinlik/gokhan-turkmen-gaziantep",
    "category": "Konser"
  },
  {
    "title": "HiraiZerdüş \"Göğe Bak Benimle\"",
    "city": "Gaziantep",
    "location": "GAÜN Mavera KSM",
    "dateText": "20 Kasım 2026 20:30",
    "price": "700 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/hiraizerdus.jpg",
    "link": "https://www.bubilet.com.tr/gaziantep/etkinlik/hiraizerdus-gaziantep",
    "category": "Konser"
  },
  {
    "title": "Doğu Demirkol - Stand Up",
    "city": "Gaziantep",
    "location": "Şehitkamil Kongre Merkezi",
    "dateText": "27 Kasım 2026 20:30",
    "price": "900 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/dogu-demirkol.jpg",
    "link": "https://www.bubilet.com.tr/gaziantep/etkinlik/dogu-demirkol-gaziantep",
    "category": "Stand-Up"
  },
  {
    "title": "Evgeny Grinko Konseri",
    "city": "Gaziantep",
    "location": "Şahinbey Kongre ve Sanat Merkezi",
    "dateText": "04 Aralık 2026 20:30",
    "price": "1100 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/evgeny-grinko.jpg",
    "link": "https://www.bubilet.com.tr/gaziantep/etkinlik/evgeny-grinko-gaziantep",
    "category": "Konser"
  },
  {
    "title": "Candles and Echoes - İskenderun",
    "city": "Hatay",
    "location": "İskenderun Belediye Kültür Sarayı",
    "dateText": "11 Kasım 2026 20:30",
    "price": "750 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/candles-and-echoes.jpg",
    "link": "https://www.bubilet.com.tr/hatay/etkinlik/candles-and-echoes-iskenderun",
    "category": "Konser"
  },
  {
    "title": "Melek Mosso Konseri",
    "city": "Hatay",
    "location": "Antakya Sümerler Açıkhava Tiyatrosu",
    "dateText": "23 Ekim 2026 20:30",
    "price": "850 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/melek-mosso.jpg",
    "link": "https://www.bubilet.com.tr/hatay/etkinlik/melek-mosso-hatay",
    "category": "Konser"
  },
  {
    "title": "HiraiZerdüş \"Göğe Bak Benimle\"",
    "city": "Hatay",
    "location": "İskenderun Simya Koleji Açıkhava",
    "dateText": "19 Kasım 2026 20:30",
    "price": "650 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/hiraizerdus.jpg",
    "link": "https://www.bubilet.com.tr/hatay/etkinlik/hiraizerdus-hatay",
    "category": "Konser"
  },
  {
    "title": "Sefa Doğanay - Tek Mi Sandınız?",
    "city": "Hatay",
    "location": "İskenderun Kültür Sarayı",
    "dateText": "22 Kasım 2026 20:00",
    "price": "650 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/sefa-doganay.jpg",
    "link": "https://www.bubilet.com.tr/hatay/etkinlik/sefa-doganay-hatay",
    "category": "Stand-Up"
  },
  {
    "title": "Duman Konseri",
    "city": "Hatay",
    "location": "Antakya Expo Alanı",
    "dateText": "05 Kasım 2026 21:00",
    "price": "900 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/duman.jpg",
    "link": "https://www.bubilet.com.tr/hatay/etkinlik/duman-hatay",
    "category": "Konser"
  },
  {
    "title": "Burak Yeter DJ Performans",
    "city": "Hatay",
    "location": "Arsuz Diva Turka Beach",
    "dateText": "30 Ekim 2026 22:00",
    "price": "800 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/burak-yeter.jpg",
    "link": "https://www.bubilet.com.tr/hatay/etkinlik/burak-yeter-hatay",
    "category": "Konser"
  },
  {
    "title": "Birsen Tezer Konseri",
    "city": "Hatay",
    "location": "İskenderun Açıkhava Tiyatrosu",
    "dateText": "15 Kasım 2026 20:30",
    "price": "750 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/birsen-tezer.jpg",
    "link": "https://www.bubilet.com.tr/hatay/etkinlik/birsen-tezer-hatay",
    "category": "Konser"
  },
  {
    "title": "Candles and Echoes - Kahramanmaraş",
    "city": "Kahramanmaraş",
    "location": "Mehmet Akif Ersoy Kültür Merkezi",
    "dateText": "10 Kasım 2026 20:30",
    "price": "750 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/candles-and-echoes.jpg",
    "link": "https://www.bubilet.com.tr/kahramanmaras/etkinlik/candles-and-echoes-kahramanmaras",
    "category": "Konser"
  },
  {
    "title": "Sagopa Kajmer Konseri",
    "city": "Kahramanmaraş",
    "location": "KAFUM Fuar Alanı",
    "dateText": "07 Kasım 2026 21:00",
    "price": "900 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/sagopa-kajmer.jpg",
    "link": "https://www.bubilet.com.tr/kahramanmaras/etkinlik/sagopa-kajmer-kahramanmaras",
    "category": "Konser"
  },
  {
    "title": "Ölü'n Bizi Ayırana Dek Oyunu",
    "city": "Kahramanmaraş",
    "location": "Necip Fazıl Kısakürek Kültür Merkezi",
    "dateText": "17 Kasım 2026 20:00",
    "price": "600 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/olun-bizi-ayirana-dek.jpg",
    "link": "https://www.bubilet.com.tr/kahramanmaras/etkinlik/olun-bizi-ayirana-dek-kahramanmaras",
    "category": "Tiyatro"
  },
  {
    "title": "Ali Congun - Adliye Çayı Stand Up",
    "city": "Kahramanmaraş",
    "location": "Mehmet Akif Ersoy Kültür Merkezi",
    "dateText": "25 Kasım 2026 20:30",
    "price": "550 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/ali-congun.jpg",
    "link": "https://www.bubilet.com.tr/kahramanmaras/etkinlik/ali-congun-kahramanmaras",
    "category": "Stand-Up"
  },
  {
    "title": "Ayna 30. Yıl Konseri",
    "city": "Kahramanmaraş",
    "location": "KAFUM Kongre Merkezi",
    "dateText": "28 Kasım 2026 20:30",
    "price": "700 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/ayna.jpg",
    "link": "https://www.bubilet.com.tr/kahramanmaras/etkinlik/ayna-30-yil-kahramanmaras",
    "category": "Konser"
  },
  {
    "title": "Çelik Konseri",
    "city": "Kahramanmaraş",
    "location": "Necip Fazıl KM Sahnesi",
    "dateText": "05 Aralık 2026 20:30",
    "price": "650 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/celik.jpg",
    "link": "https://www.bubilet.com.tr/kahramanmaras/etkinlik/celik-kahramanmaras",
    "category": "Konser"
  },
  {
    "title": "Soner Sarıkabadayı Konseri",
    "city": "Kahramanmaraş",
    "location": "KAFUM Fuar ve Kongre Alanı",
    "dateText": "12 Aralık 2026 21:00",
    "price": "800 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/soner-sarikabadayi.jpg",
    "link": "https://www.bubilet.com.tr/kahramanmaras/etkinlik/soner-sarikabadayi-kahramanmaras",
    "category": "Konser"
  },
  {
    "title": "Mahşer-i Cümbüş Oyunu",
    "city": "Osmaniye",
    "location": "Kadirli Devlet Bahçeli Kültür Merkezi",
    "dateText": "05 Kasım 2026 20:30",
    "price": "1400 ₺",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/mahseri-cumbus.jpg",
    "link": "https://www.bubilet.com.tr/osmaniye/etkinlik/mahser-i-cumbus-oyunu",
    "category": "Tiyatro"
  },
  {
    "title": "Ölünce Ara Tiyatro Oyunu",
    "city": "Osmaniye",
    "location": "Kadirli Devlet Bahçeli Kültür Merkezi",
    "dateText": "09 Aralık 2026 20:30",
    "price": "900 ₺'den itibaren",
    "imageUrl": "https://cdn.bubilet.com.tr/cdn-cgi/image/width=600,quality=80/files/Etkinlik/olunce-ara.jpg",
    "link": "https://www.bubilet.com.tr/osmaniye/etkinlik/olunce-ara-tiyatro-oyunu",
    "category": "Tiyatro"
  }
];

function parseDate(dateStr) {
  const months = {
    ocak: 0, subat: 1, mart: 2, nisan: 3, mayis: 4, haziran: 5,
    temmuz: 6, agustos: 7, eylul: 8, ekim: 9, kasim: 10, aralik: 11
  };
  const parts = dateStr.split(/\s+/);
  const day = parseInt(parts[0], 10);
  const monthKey = (parts[1] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  const month = months[monthKey] ?? 9;
  const year = parseInt(parts[2], 10) || 2026;
  const time = parts[3] ? parts[3].split(':') : [20, 0];
  const hour = parseInt(time[0], 10) || 20;
  const min = parseInt(time[1], 10) || 0;
  return new Date(Date.UTC(year, month, day, hour - 3, min));
}

async function run() {
  console.log('🚀 Formatting and saving fresh scraped events...');
  
  const formattedEvents = freshScraped.map((e, idx) => {
    const slug = e.city.toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    
    const hrefSlug = e.link.split('/etkinlik/')[1] || `evt-${idx}`;
    const cleanHrefSlug = hrefSlug.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const dateObj = parseDate(e.dateText);

    return {
      id: `bubilet-${slug}-${cleanHrefSlug}`,
      title: e.title,
      category: e.category,
      city: e.city,
      district: e.location.includes('Kadirli') ? 'Kadirli' : (e.location.includes('İskenderun') ? 'İskenderun' : (e.location.includes('Yenişehir') ? 'Yenişehir' : 'Merkez')),
      location: e.location,
      date: dateObj.toISOString(),
      imageUrl: e.imageUrl,
      price: e.price,
      link: e.link,
      source: 'Bubilet'
    };
  });

  console.log(`✅ Formatted ${formattedEvents.length} events from Bubilet.`);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL missing in backend/.env');
    return;
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database!');

    const res = await client.query('SELECT data FROM city_contents WHERE id = 1');
    if (res.rows.length === 0) {
      throw new Error('city_contents id=1 not found');
    }

    const content = res.rows[0].data || {};
    const existing = content.scrapedEvents || [];
    console.log(`Current DB scrapedEvents count: ${existing.length}`);

    // Merge: unique by id or (title + city)
    const map = new Map();
    // Keep valid future events from existing
    const nowTime = new Date();
    for (const item of existing) {
      if (new Date(item.date) >= nowTime) {
        map.set(`${item.city}-${item.title.toLowerCase()}`, item);
      }
    }
    // Overwrite / add newly scraped fresh events
    for (const item of formattedEvents) {
      map.set(`${item.city}-${item.title.toLowerCase()}`, item);
    }

    const mergedScraped = Array.from(map.values());
    mergedScraped.sort((a, b) => new Date(a.date) - new Date(b.date));

    content.scrapedEvents = mergedScraped;

    await client.query(
      'UPDATE city_contents SET data = $1, updated_at = $2 WHERE id = 1',
      [content, new Date().toISOString()]
    );
    console.log(`🎉 Successfully saved ${mergedScraped.length} merged events into Supabase city_contents!`);

    // Write to root tmp_events.json as well
    const tmpEventsPath = path.resolve(__dirname, '..', 'tmp_events.json');
    fs.writeFileSync(tmpEventsPath, JSON.stringify({
      ok: true,
      fetchedAt: new Date().toISOString(),
      items: mergedScraped
    }, null, 2), 'utf-8');
    console.log(`📁 Updated ${tmpEventsPath} with all current events.`);

  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    await client.end();
  }
}

run();
