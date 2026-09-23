const specialEvents = {
  '01-01': {
    title: "Yeni yılın ilk günü: 2026'ya merhaba! 🎆",
    summary: "Yeni bir yıl, yeni umutlar ve yeni başlangıçlar. Dünyanın dört bir yanında milyonlarca insan yeni yılı coşkuyla karşıladı.",
    imageUrl: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=1200&q=80',
  },
  '01-03': {
    title: 'Quadrantid meteor yağmuru gökyüzünde zirve yapıyor 🌠',
    summary: "Yılın ilk büyük gökyüzü olayı gerçekleşiyor. Saatte 100'e yakın göktaşı kayması çıplak gözle izlenebilecek.",
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
  },
  '02-14': {
    title: 'Bugün 14 Şubat Sevgililer Günü ❤️',
    summary: 'Tüm dünyada sevginin ve bağlılığın kutlandığı Sevgililer Günü kutlanıyor.',
    imageUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1200&q=80',
  },
  '02-19': {
    title: 'İlk cemre havaya düştü: Baharın ilk müjdecisi geldi 🌾',
    summary: 'Halk takvimine göre baharın müjdecisi olan birinci cemre havaya düştü. Havaların kademeli olarak ısınması bekleniyor.',
    imageUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1200&q=80',
  },
  '02-26': {
    title: 'İkinci cemre suya düştü: Sular ısınmaya başlıyor 💧',
    summary: 'Doğanın canlanma sürecinde ikinci cemre suya düştü. Denizlerde ve akarsularda sıcaklıklar yükselişe geçiyor.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  '03-05': {
    title: 'Üçüncü cemre toprağa düştü: Cemreler tamamlandı, doğa uyanıyor 🌱',
    summary: 'Son cemrenin toprağa düşmesiyle birlikte kışın son izleri siliniyor, bahar resmi olarak hayat buluyor.',
    imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
  },
  '03-08': {
    title: 'Bugün 8 Mart Dünya Kadınlar Günü 🌷',
    summary: 'Hayatın her alanına değer katan, emeğiyle dünyayı güzelleştiren tüm kadınların Dünya Kadınlar Günü kutlu olsun.',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
  },
  '03-21': {
    title: 'Bugün İlkbahar Ekinoksu: Gece ile gündüz eşitlendi, bahar resmen başladı 🌸',
    summary: "21 Mart Ekinoksu ile birlikte Güneş ışınları Ekvator'a dik açıyla ulaştı. Kuzey Yarımküre'de gündüzler gecelerden daha uzun olmaya başlıyor.",
    imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80',
  },
  '04-01': {
    title: 'Bugün 1 Nisan: Dünyanın en köklü şaka geleneği günü 🎭',
    summary: 'Yüzlerce yıldır süregelen 1 Nisan şaka geleneği tüm dünyada eğlenceli anlara sahne oluyor. Dikkatli olun!',
    imageUrl: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=1200&q=80',
  },
  '04-23': {
    title: 'Bugün 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı 🇹🇷',
    summary: "Gazi Mustafa Kemal Atatürk'ün dünya çocuklarına armağan ettiği 23 Nisan tüm yurtta ve dünyada gururla kutlanıyor.",
    imageUrl: 'https://images.unsplash.com/photo-1569974498991-d3c12a504f95?auto=format&fit=crop&w=1200&q=80',
  },
  '05-05': {
    title: 'Bu gece Hıdırellez: Baharın ve dileklerin gecesi kutlanıyor 🔥',
    summary: 'Hızır ve İlyas peygamberlerin yeryüzünde buluştuğuna inanılan Hıdırellez gecesi; ateşler yakılarak ve gül ağaçlarına dilekler asılarak karşılanıyor.',
    imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
  },
  '05-06': {
    title: 'Bugün Hıdırellez: Bahar bayramı ve yeni umutlar 🌱',
    summary: 'Baharın gelişini müjdeleyen kadim Hıdırellez bayramı tüm yurtta bereket ve sağlık dilekleriyle kutlanıyor.',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
  },
  '05-19': {
    title: "Bugün 19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı 🇹🇷",
    summary: "Kurtuluş mücadelemizin meşalesinin Samsun'da yakıldığı tarihi günün yıl dönümü coşkuyla kutlanıyor.",
    imageUrl: 'https://images.unsplash.com/photo-1569974498991-d3c12a504f95?auto=format&fit=crop&w=1200&q=80',
  },
  '06-21': {
    title: 'Bugün yılın en uzun günü: Yaz mevsimi resmen başladı ☀️',
    summary: "21 Haziran Yaz Gündönümü gerçekleşiyor. Türkiye'de yaklaşık 15 saatlik gündüz süresiyle yılın en aydınlık günü yaşanıyor.",
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  '08-12': {
    title: 'Görkemli gökyüzü şöleni: Perseid meteor yağmuru bu gece zirvede 🌠',
    summary: "Yılın en yoğun meteor yağmurlarından Perseid bu gece gökyüzünü aydınlatacak. Işıksız alanlarda saatte 60'tan fazla meteor gözlemlenebilecek.",
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
  },
  '08-13': {
    title: 'Perseid meteor yağmuru gökyüzünü büyülemeye devam ediyor 🌠',
    summary: 'Gökyüzü meraklıları gece boyunca binlerce göktaşının atmosferdeki büyüleyici izlerini fotoğrafladı.',
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
  },
  '08-30': {
    title: 'Bugün 30 Ağustos Zafer Bayramı: Bağımsızlığımızın 104. yılı 🇹🇷',
    summary: "Büyük Taarruz'un zaferle taçlandığı tarihi günün gururunu milletçe yaşıyoruz. Tüm kahramanlarımızı minnetle anıyoruz.",
    imageUrl: 'https://images.unsplash.com/photo-1569974498991-d3c12a504f95?auto=format&fit=crop&w=1200&q=80',
  },
  '09-23': {
    title: 'Bugün gece ve gündüz eşitleniyor: Yaz mevsimi resmen bitti, sonbahar başladı 🍂',
    summary: "23 Eylül Sonbahar Ekinoksu gerçekleşiyor. Güneş ışınları Ekvator'a dik açıyla ulaştı. Bugünden itibaren Kuzey Yarımküre'de geceler gündüzlerden daha uzun olmaya başlayacak.",
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  '10-01': {
    title: 'Bugün 1 Ekim Dünya Kahve Günü: Kahveseverler kutluyor ☕',
    summary: 'Güne kahveyle başlayan milyonlarca insanın özel günü. Kahve, sudan sonra dünyada en çok tüketilen ikinci içecek konumunda.',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
  },
  '10-04': {
    title: 'Bugün 4 Ekim Dünya Hayvanları Koruma Günü 🐾',
    summary: 'Sokaktaki ve doğadaki tüm can dostlarımızın yaşam hakkını korumak ve farkındalık yaratmak için kutlanıyor.',
    imageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=1200&q=80',
  },
  '10-29': {
    title: 'Cumhuriyet 103 yaşında! 29 Ekim Cumhuriyet Bayramımız kutlu olsun 🇹🇷',
    summary: 'Gazi Mustafa Kemal Atatürk ve silah arkadaşlarının milletimize emanet ettiği Cumhuriyetimiz 103 yaşında gururla kutlanıyor.',
    imageUrl: 'https://images.unsplash.com/photo-1569974498991-d3c12a504f95?auto=format&fit=crop&w=1200&q=80',
  },
  '11-10': {
    title: "Büyük Önder Mustafa Kemal Atatürk'ü saygı, sevgi ve özlemle anıyoruz 🇹🇷",
    summary: "Türkiye Cumhuriyeti'nin kurucusu Gazi Mustafa Kemal Atatürk, ebediyete intikalinin yıl dönümünde milletçe anılıyor.",
    imageUrl: 'https://images.unsplash.com/photo-1569974498991-d3c12a504f95?auto=format&fit=crop&w=1200&q=80',
  },
  '11-24': {
    title: 'Bugün 24 Kasım Öğretmenler Günü 📚',
    summary: 'Geleceğe ışık tutan, fedakarlıkla nesiller yetiştiren tüm öğretmenlerimizin Öğretmenler Günü kutlu olsun.',
    imageUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
  },
  '12-05': {
    title: 'Bugün 5 Aralık Dünya Türk Kahvesi Günü ☕',
    summary: 'UNESCO Somut Olmayan Kültürel Miras listesinde yer alan 500 yıllık eşsiz lezzetimiz Dünya Türk Kahvesi Günü kutlanıyor.',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=80',
  },
  '12-13': {
    title: 'Geminid meteor yağmuru gökyüzünü aydınlatıyor 🌠',
    summary: "Yılın en güçlü göktaşı yağmurlarından Geminid (İkizler) zirve yapıyor. Saatte 120'den fazla meteor izlenebilecek.",
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
  },
  '12-21': {
    title: 'Bugün yılın en uzun gecesi: Kış mevsimi resmen başladı ❄️',
    summary: '21 Aralık Kış Gündönümü gerçekleşiyor. Türkiye\'de yaklaşık 15 saatlik gece süresiyle yılın en uzun karanlığı yaşanacak.',
    imageUrl: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=1200&q=80',
  },
  '12-31': {
    title: 'Yılın son günü: Bu gece yeni bir yıla adım atıyoruz 🎆',
    summary: '2026 yılının son saatlerini geride bırakıyoruz. Yeni yılın tüm insanlığa sağlık, huzur ve mutluluk getirmesi dileğiyle.',
    imageUrl: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=1200&q=80',
  },
};

function getTodaySpecialNews() {
  const now = new Date();
  // Turkey timezone date
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).formatToParts(now);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const key = `${partMap.month}-${partMap.day}`;

  const event = specialEvents[key];
  if (!event) return null;

  return {
    id: `almanac-${key}-${partMap.year}`,
    title: event.title,
    summary: event.summary,
    fullText: `${event.title}\n\n${event.summary}\n\nDetaylar ve daha fazlası Hepsi Düziçi uygulamasında!`,
    imageUrl: event.imageUrl,
    images: [event.imageUrl],
    createdAt: now.toISOString(),
    sourceName: 'Günün Gelişmesi 🌟',
    sourceUrl: 'https://hepsiduzici.netlify.app/',
    category: 'Türkiye',
    verified: true,
    isAiGenerated: true,
    isAiOptimized: true,
  };
}

module.exports = {
  getTodaySpecialNews,
};
