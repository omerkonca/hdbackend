const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const allVillages = [
  {
    id: "koy_cerciooglu",
    name: "Çerçioğlu Köyü",
    distanceKm: 18,
    population: 955,
    headmanName: "Ömer Kirkit",
    headmanPhone: "0541 547 19 39",
    description: "Düziçi'nin kuzeybatısında, Aslantaş Barajı gölü havzasında yer alan Çerçioğlu Köyü; bakir doğası, meşhur Yeşil Şelalesi ve yemyeşil kanyon vadileriyle doğaseverlerin gözde uğrak noktasıdır.",
    imageUrl: "assets/images/yesil_selalesi.jpg",
    latitude: 37.345,
    longitude: 36.385,
    highlights: [
      "Yeşil Şelalesi (Saklı Cennet)",
      "Aslantaş Barajı Manzarası",
      "Kanyon & Doğa Yürüyüş Rotaları",
      "Doğal Köy Ürünleri"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Çerçioğlu",
        departureTimes: ["07:30", "11:30", "15:30", "17:30"],
        driverPhone: "0541 547 19 39",
        driverName: "Çerçioğlu Birlik Dolmuşu",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "23°C",
    weatherCondition: "Ferah Kanyon Esintisi 🌿",
    gallery: [
      "assets/images/yesil_selalesi.jpg",
      "assets/images/villages/gokcayir.jpg"
    ]
  },
  {
    id: "koy_pirsultanli",
    name: "Pirsultanlı Köyü",
    distanceKm: 10,
    population: 1100,
    headmanName: "Ahmet Bozaslan",
    headmanPhone: "0544 287 23 32",
    description: "Horasan'dan Çukurova'ya uzanan köklü Türkmen mirasının, imece kültürünün ve misafirperverliğin simgesi olan Pirsultanlı Köyü; asırlık zeytinlikleri ve bereketli topraklarıyla bilinir.",
    imageUrl: "assets/images/villages/pirsultanli.jpg",
    latitude: 37.24,
    longitude: 36.39,
    highlights: [
      "Tarihi İmece Kültürü",
      "Köklü Türkmen Mirası",
      "Asırlık Zeytinlikler",
      "Doğal Dağ Köyü"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Pirsultanlı",
        departureTimes: ["07:45", "12:15", "16:45"],
        driverPhone: "0544 287 23 32",
        driverName: "Hüseyin P.",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "24°C",
    weatherCondition: "Açık Dağ Havası ☀️",
    gallery: [
      "assets/images/villages/pirsultanli.jpg",
      "assets/images/villages/alibozlu.jpg"
    ]
  },
  {
    id: "koy_kuscu",
    name: "Kuşçu Köyü",
    distanceKm: 15,
    population: 1450,
    headmanName: "Ali Göbelek",
    headmanPhone: "0542 520 88 56",
    description: "Düziçi'nin kuzeyinde yer alan Kuşçu Köyü, Harun Reşit dönemine uzanan köklü geçmişe sahiptir. Sınırları içerisindeki Haruniye Kaplıcaları 43°C şifalı kükürtlü suyuyla bölgenin sağlık ve turizm merkezidir.",
    imageUrl: "assets/images/villages/kuscu.jpg",
    latitude: 37.332,
    longitude: 36.485,
    highlights: [
      "Tarihi Haruniye Kaplıcaları",
      "Düldül Dağı Etekleri",
      "43°C Şifalı Termal Su",
      "Narenciye Bahçeleri"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Kuşçu Köyü",
        departureTimes: ["07:30", "10:30", "13:30", "16:30"],
        driverPhone: "0542 520 88 56",
        driverName: "Mehmet K.",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "23°C",
    weatherCondition: "Ilık Kaplıca Havaları ♨️",
    gallery: [
      "assets/images/villages/kuscu.jpg",
      "assets/images/villages/gokcayir.jpg"
    ]
  },
  {
    id: "koy_gokcayir",
    name: "Gökçayır Köyü",
    distanceKm: 8.5,
    population: 2100,
    headmanName: "Ergün İşi",
    headmanPhone: "0543 695 03 68",
    description: "Toroslar'ın eteklerinde kurulan Gökçayır Köyü, köklü Yörük aşiretlerinin yerleşimidir. Çam ormanları, serin yaylaları ve kaliteli kekik balıyla tanınır.",
    imageUrl: "assets/images/villages/gokcayir.jpg",
    latitude: 37.285,
    longitude: 36.421,
    highlights: [
      "Gökçayır Çam Ormanları",
      "Tarihi Yörük Yaylası",
      "Doğal Bal & Arıcılık",
      "Kaynak Suları"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Gökçayır Köyü",
        departureTimes: ["07:00", "09:00", "11:30", "14:00", "17:00"],
        driverPhone: "0543 695 03 68",
        driverName: "Ali Y.",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "20°C",
    weatherCondition: "Serin Çam Kokulu Yayla 🌲",
    gallery: [
      "assets/images/villages/gokcayir.jpg",
      "assets/images/villages/kuscu.jpg"
    ]
  },
  {
    id: "koy_catak",
    name: "Çatak Köyü",
    distanceKm: 12,
    population: 980,
    headmanName: "Bekir Çam",
    headmanPhone: "0544 773 19 82",
    description: "Sabun Çayı kanyon vadisinin üst kısımlarında kurulan Çatak Köyü, tarihi Kaşıntı Pınarı şifalı su kaynağı ve yemyeşil vadileriyle meşhurdur.",
    imageUrl: "assets/images/villages/catak.jpg",
    latitude: 37.31,
    longitude: 36.502,
    highlights: [
      "Şifalı Kaşıntı Pınarı",
      "Sabun Çayı Kanyonu",
      "Ceviz & Nar Bahçeleri",
      "Dağ Yürüyüş Rotaları"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Çatak Köyü",
        departureTimes: ["08:00", "12:00", "16:00"],
        driverPhone: "0544 773 19 82",
        driverName: "Hasan Ç.",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "22°C",
    weatherCondition: "Ferah Kanyon Havası 💧",
    gallery: [
      "assets/images/villages/catak.jpg",
      "assets/images/villages/kuscu.jpg"
    ]
  },
  {
    id: "koy_alibozlu",
    name: "Alibozlu Köyü",
    distanceKm: 9,
    population: 1650,
    headmanName: "İsa Uludağ",
    headmanPhone: "0545 229 20 81",
    description: "Zeytinciliği ve kaliteli zeytinyağıyla öne çıkan Alibozlu Köyü, asırlık zeytin ağaçları, nar bahçeleri ve bereketli tarım arazilerine sahiptir.",
    imageUrl: "assets/images/villages/alibozlu.jpg",
    latitude: 37.215,
    longitude: 36.41,
    highlights: [
      "Asırlık Zeytin Ağaçları",
      "Soğuk Sıkım Zeytinyağı",
      "Zengin Nar Üretimi",
      "Tarihi Değirmen İzi"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Alibozlu",
        departureTimes: ["07:15", "11:00", "15:30", "17:45"],
        driverPhone: "0545 229 20 81",
        driverName: "İbrahim A.",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "25°C",
    weatherCondition: "Açık & Güneşli ☀️",
    gallery: [
      "assets/images/villages/alibozlu.jpg",
      "assets/images/villages/yarbasi.jpg"
    ]
  },
  {
    id: "koy_citli",
    name: "Çitli Köyü",
    distanceKm: 14,
    population: 820,
    headmanName: "Mehmet Nam",
    headmanPhone: "0542 598 74 27",
    description: "Düldül Dağı yamaçlarında yer alan Çitli Köyü; serin Çitli Yaylası, şelaleleri, çam ormanları ve berrak kaynak sularıyla doğa tutkunlarının kaçış noktasıdır.",
    imageUrl: "assets/images/villages/citli.jpg",
    latitude: 37.325,
    longitude: 36.46,
    highlights: [
      "Çitli Yaylası",
      "Çitli Şelalesi",
      "Dağ Kekiği & Yayla Balı",
      "Yüksek Toros Manzarası"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Çitli Köyü",
        departureTimes: ["07:45", "12:30", "16:30"],
        driverPhone: "0542 598 74 27",
        driverName: "Mehmet N.",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "19°C",
    weatherCondition: "Serin Yayla Esintisi 🌲",
    gallery: [
      "assets/images/villages/gokcayir.jpg",
      "assets/images/villages/kuscu.jpg"
    ]
  },
  {
    id: "koy_akcakoyunlu",
    name: "Akçakoyunlu Köyü",
    distanceKm: 11,
    population: 780,
    headmanName: "Serkan Özdemir",
    headmanPhone: "0541 604 81 80",
    description: "Düziçi ovasının güney ucunda yer alan Akçakoyunlu Köyü, köklü Türkmen Yörük geleneklerini yaşatan, tarım ve hayvancılıkla geçinen şirin bir ovaköyüdür.",
    imageUrl: "assets/images/villages/atalan.jpg",
    latitude: 37.185,
    longitude: 36.42,
    highlights: [
      "Verimli Ova Tarımı",
      "Büyükbaş & Küçükbaş Hayvancılık",
      "Yöresel Köy Pazarı",
      "Sakin Köy Yaşamı"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Akçakoyunlu",
        departureTimes: ["08:00", "13:00", "17:00"],
        driverPhone: "0541 604 81 80",
        driverName: "Mustafa A.",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "26°C",
    weatherCondition: "Ilık Ova Güneşi 🌾",
    gallery: [
      "assets/images/villages/atalan.jpg",
      "assets/images/villages/alibozlu.jpg"
    ]
  },
  {
    id: "koy_bayindirli",
    name: "Bayındırlı Köyü",
    distanceKm: 9.5,
    population: 890,
    headmanName: "İsmail Kınaş",
    headmanPhone: "0546 920 12 39",
    description: "Tarihi Bayındır boyundan ismini alan Bayındırlı Köyü, zeytinlikleri, fıstık tarlaları ve sıcak komşuluk ilişkileriyle Düziçi'nin kadim yerleşimlerindendir.",
    imageUrl: "assets/images/villages/alibozlu.jpg",
    latitude: 37.228,
    longitude: 36.435,
    highlights: [
      "Bayındır Boyu Mirası",
      "Zeytin & Fıstık Bahçeleri",
      "Huzurlu Köy Meydanı",
      "Doğal Bahçe Ürünleri"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Bayındırlı",
        departureTimes: ["07:30", "11:30", "16:00"],
        driverPhone: "0546 920 12 39",
        driverName: "Ahmet K.",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "25°C",
    weatherCondition: "Güneşli ☀️",
    gallery: ["assets/images/villages/alibozlu.jpg"]
  },
  {
    id: "koy_bostanlar",
    name: "Bostanlar Köyü",
    distanceKm: 6.5,
    population: 1320,
    headmanName: "Erdal Avan",
    headmanPhone: "0541 505 99 97",
    description: "İlçe merkezine yakın konumuyla Bostanlar Köyü, sebze ve bostan tarımının merkezidir. Taze köy sebzeleri ve organik ürünleriyle tanınır.",
    imageUrl: "assets/images/villages/bocekli.jpg",
    latitude: 37.252,
    longitude: 36.442,
    highlights: [
      "Organik Bostan Tarımı",
      "Merkeze Yakın Ulaşım",
      "Zeytin & Mısır Tarlaları",
      "Yöresel Köy Ekmekleri"
    ],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Bostanlar",
        departureTimes: ["07:00", "09:30", "12:00", "14:30", "17:00", "18:30"],
        driverPhone: "0541 505 99 97",
        driverName: "Kemal B.",
        fee: "15 ₺"
      }
    ],
    weatherTemp: "25°C",
    weatherCondition: "Açık ve Ferah ☀️",
    gallery: ["assets/images/villages/bocekli.jpg"]
  },
  {
    id: "koy_cotlu",
    name: "Çotlu Köyü",
    distanceKm: 13,
    population: 670,
    headmanName: "Ergen Çıplak",
    headmanPhone: "0538 310 51 80",
    description: "Doğu vadilerinde ormanla iç içe yaşayan Çotlu Köyü, sakinliği, zeytin tarımı ve hayvancılığı ile bilinen tipik bir Toros köyüdür.",
    imageUrl: "assets/images/villages/catak.jpg",
    latitude: 37.275,
    longitude: 36.495,
    highlights: ["Sakin Doğa Yaşamı", "Geleneksel Zeytincilik", "Meşe Ormanları", "Temiz Kaynak Suyu"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Çotlu",
        departureTimes: ["08:00", "13:30", "17:00"],
        driverPhone: "0538 310 51 80",
        driverName: "Çotlu Dolmuşu",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "23°C",
    weatherCondition: "Hafif Rüzgarlı 🍃",
    gallery: ["assets/images/villages/catak.jpg"]
  },
  {
    id: "koy_elbeyli",
    name: "Elbeyli Köyü",
    distanceKm: 8,
    population: 910,
    headmanName: "Mehmet Karabaş",
    headmanPhone: "0531 848 38 85",
    description: "İlçe merkezine komşu olan Elbeyli Köyü, verimli bahçeleri, zeytinlikleri ve tarihi köy kültürüyle Düziçi'nin sevilen yerleşimlerindendir.",
    imageUrl: "assets/images/villages/yarbasi.jpg",
    latitude: 37.218,
    longitude: 36.448,
    highlights: ["Zeytin & Nar Üretimi", "Kolay Ulaşım", "Köy Kahvesi Sohbetleri", "Doğal Yaşam"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Elbeyli",
        departureTimes: ["07:30", "10:30", "13:30", "16:30", "18:00"],
        driverPhone: "0531 848 38 85",
        driverName: "Elbeyli Birlik",
        fee: "15 ₺"
      }
    ],
    weatherTemp: "25°C",
    weatherCondition: "Güneşli ☀️",
    gallery: ["assets/images/villages/yarbasi.jpg"]
  },
  {
    id: "koy_farsak",
    name: "Farsak Köyü",
    distanceKm: 16,
    population: 580,
    headmanName: "Kadir İçyer",
    headmanPhone: "0541 878 75 76",
    description: "Varsak Türkmenlerinin kadim yerleşimi olan Farsak Köyü, dağ eteklerinde zengin kekik, yayla balı ve geleneksel hayvancılıkla uğraşır.",
    imageUrl: "assets/images/villages/gokcayir.jpg",
    latitude: 37.338,
    longitude: 36.435,
    highlights: ["Varsak Türkmen Kültürü", "Yayla Kekiği ve Balı", "Yüksek Rakım Temiz Hava", "Doğal Pınarlar"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Farsak",
        departureTimes: ["08:00", "12:30", "16:30"],
        driverPhone: "0541 878 75 76",
        driverName: "Farsak Kooperatifi",
        fee: "30 ₺"
      }
    ],
    weatherTemp: "20°C",
    weatherCondition: "Serin Dağ Havası 🏔️",
    gallery: ["assets/images/villages/gokcayir.jpg"]
  },
  {
    id: "koy_gumus",
    name: "Gümüş Köyü",
    distanceKm: 12.5,
    population: 720,
    headmanName: "Ramazan Yakut",
    headmanPhone: "0543 599 06 20",
    description: "Tarihi maden ve pınar yataklarıyla bilinen Gümüş Köyü, Toros dağlarının eteklerinde zeytincilik ve ceviz yetiştiriciliğiyle meşhurdur.",
    imageUrl: "assets/images/villages/catak.jpg",
    latitude: 37.295,
    longitude: 36.515,
    highlights: ["Ceviz & Zeytin Bahçeleri", "Tarihi Gümüş Vadisi", "Doğal Kaynaklar", "Temiz Doğa"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Gümüş Köyü",
        departureTimes: ["07:45", "12:00", "16:15"],
        driverPhone: "0543 599 06 20",
        driverName: "Ramazan Y.",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "22°C",
    weatherCondition: "Ilık Vadi İklimi 🍃",
    gallery: ["assets/images/villages/catak.jpg"]
  },
  {
    id: "koy_guzelyurt",
    name: "Güzelyurt Köyü",
    distanceKm: 10,
    population: 850,
    headmanName: "Mustafa Karaman",
    headmanPhone: "0543 566 25 74",
    description: "Adı gibi güzel doğası ve bereketli bağlarıyla bilinen Güzelyurt Köyü, Düziçi'nin sakin, huzurlu ve zeytini bol köylerindendir.",
    imageUrl: "assets/images/villages/alibozlu.jpg",
    latitude: 37.235,
    longitude: 36.425,
    highlights: ["Bağcılık & Zeytin", "Güzelyurt Manzarası", "Organik Bahçe Tarımı", "Huzurlu Yaşam"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Güzelyurt",
        departureTimes: ["07:30", "11:30", "15:30"],
        driverPhone: "0543 566 25 74",
        driverName: "Güzelyurt Hattı",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "24°C",
    weatherCondition: "Güneşli ☀️",
    gallery: ["assets/images/villages/alibozlu.jpg"]
  },
  {
    id: "koy_karagedik",
    name: "Karagedik Köyü",
    distanceKm: 13.5,
    population: 640,
    headmanName: "Nuri Matuğan",
    headmanPhone: "0546 245 59 37",
    description: "Torosların yüksek gediklerinde kurulu Karagedik Köyü; serin havası, yayla hayvancılığı ve doğal köy peynirleriyle bilinir.",
    imageUrl: "assets/images/villages/sogutlugol.jpg",
    latitude: 37.315,
    longitude: 36.41,
    highlights: ["Yayla Hayvancılığı", "Doğal Köy Peyniri & Tereyağı", "Dağ Manzarası", "Sakin Atmosfer"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Karagedik",
        departureTimes: ["08:00", "13:00", "16:45"],
        driverPhone: "0546 245 59 37",
        driverName: "Karagedik Seferi",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "21°C",
    weatherCondition: "Serin Dağ Rüzgarı 💨",
    gallery: ["assets/images/villages/sogutlugol.jpg"]
  },
  {
    id: "koy_karaguz",
    name: "Karaguz Köyü",
    distanceKm: 15,
    population: 590,
    headmanName: "Mehmet Kuşçuoğlu",
    headmanPhone: "0544 811 07 81",
    description: "Orman içi yerleşimiyle Karaguz Köyü, meşe ve çam ormanları arasında avcılık, arıcılık ve organik tarımla uğraşan geleneksel bir dağ köyüdür.",
    imageUrl: "assets/images/villages/kuscu.jpg",
    latitude: 37.34,
    longitude: 36.47,
    highlights: ["Orman İçi Sakinlik", "Karakovan Balı", "Zengin Flora", "Yürüyüş Parkurları"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Karaguz",
        departureTimes: ["08:15", "13:15", "16:30"],
        driverPhone: "0544 811 07 81",
        driverName: "Mehmet K.",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "20°C",
    weatherCondition: "Orman Havası 🌲",
    gallery: ["assets/images/villages/kuscu.jpg"]
  },
  {
    id: "koy_oluklu",
    name: "Oluklu Köyü",
    distanceKm: 7.5,
    population: 940,
    headmanName: "İlyas Kütük",
    headmanPhone: "0555 299 33 55",
    description: "Tarihi pınar oluklarıyla anılan Oluklu Köyü, Düziçi merkezine yakınlığı ve sulak tarım arazileriyle taze meyve ve sebze üretir.",
    imageUrl: "assets/images/villages/bocekli.jpg",
    latitude: 37.265,
    longitude: 36.455,
    highlights: ["Tarihi Su Olukları", "Meyve Bahçeleri", "Kolay Ulaşım", "Köy İçi Yürüyüş"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Oluklu",
        departureTimes: ["07:15", "10:15", "13:15", "16:15", "18:00"],
        driverPhone: "0555 299 33 55",
        driverName: "Oluklu Birlik",
        fee: "15 ₺"
      }
    ],
    weatherTemp: "25°C",
    weatherCondition: "Açık ve Güneşli ☀️",
    gallery: ["assets/images/villages/bocekli.jpg"]
  },
  {
    id: "koy_selverler",
    name: "Selverler Köyü",
    distanceKm: 11,
    population: 710,
    headmanName: "İlyas Açık",
    headmanPhone: "0543 949 41 69",
    description: "Düziçi'nin güneybatısında yer alan Selverler Köyü, zeytin, buğday ve pamuk tarımıyla bölge ekonomisine katkı sağlayan köklü bir yerleşimdir.",
    imageUrl: "assets/images/villages/atalan.jpg",
    latitude: 37.195,
    longitude: 36.395,
    highlights: ["Geniş Tarım Arazileri", "Zeytinlikler", "Sıcak Köy İnsanları", "Geleneksel Yaşam"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Selverler",
        departureTimes: ["07:45", "12:15", "16:30"],
        driverPhone: "0543 949 41 69",
        driverName: "Selverler Dolmuşu",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "26°C",
    weatherCondition: "Ova Güneşi 🌾",
    gallery: ["assets/images/villages/atalan.jpg"]
  },
  {
    id: "koy_sogutlugol",
    name: "Söğütlügöl Köyü",
    distanceKm: 16.5,
    population: 750,
    headmanName: "Selami Kurman",
    headmanPhone: "0542 399 21 17",
    description: "Toros Dağları'nın üst kısımlarında gölet ve doğal pınarların bulunduğu Söğütlügöl Köyü, yüksek yaylacılık kültürünü sürdüren serin bir dağ yerleşimidir.",
    imageUrl: "assets/images/villages/sogutlugol.jpg",
    latitude: 37.35,
    longitude: 36.52,
    highlights: ["Söğütlügöl Yaylası", "Organik Dağ Balı", "Ceviz Ağaçları", "Serin Yayla İklimi"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Söğütlügöl",
        departureTimes: ["08:00", "13:00", "17:00"],
        driverPhone: "0542 399 21 17",
        driverName: "Kadir S.",
        fee: "30 ₺"
      }
    ],
    weatherTemp: "18°C",
    weatherCondition: "Serin Yüksek Dağ İklimi 🏔️",
    gallery: [
      "assets/images/villages/sogutlugol.jpg",
      "assets/images/villages/gokcayir.jpg"
    ]
  },
  {
    id: "koy_yazlamazli",
    name: "Yazlamazlı Köyü",
    distanceKm: 10.5,
    population: 880,
    headmanName: "Nuri Curuk",
    headmanPhone: "0542 786 18 49",
    description: "Düziçi ovası ile dağ eteği arasında geçiş noktasında kurulu Yazlamazlı Köyü; bağları, bahçeleri ve zeytinlikleriyle meşhurdur.",
    imageUrl: "assets/images/villages/alibozlu.jpg",
    latitude: 37.21,
    longitude: 36.465,
    highlights: ["Yazlamazlı Bahçeleri", "Zeytincilik", "Geniş Ova Manzarası", "Doğal Yaşam"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Yazlamazlı",
        departureTimes: ["07:30", "11:30", "15:30", "17:30"],
        driverPhone: "0542 786 18 49",
        driverName: "Yazlamazlı Seferi",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "25°C",
    weatherCondition: "Güneşli ☀️",
    gallery: ["assets/images/villages/alibozlu.jpg"]
  },
  {
    id: "koy_yenifarsak",
    name: "Yenifarsak Köyü",
    distanceKm: 17,
    population: 620,
    headmanName: "Ali Baz",
    headmanPhone: "0533 313 26 27",
    description: "Düldül dağının yüksek yamaçlarında kurulu Yenifarsak Köyü; kekik kokulu dağları, arıcılık ve yayla kültürüyle öne çıkar.",
    imageUrl: "assets/images/villages/gokcayir.jpg",
    latitude: 37.345,
    longitude: 36.445,
    highlights: ["Yenifarsak Yaylaları", "Karakovan Balı", "Yaban Hayatı & Doğa", "Soğuk Pınar Suları"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Yenifarsak",
        departureTimes: ["08:00", "12:30", "16:30"],
        driverPhone: "0533 313 26 27",
        driverName: "Ali B.",
        fee: "30 ₺"
      }
    ],
    weatherTemp: "19°C",
    weatherCondition: "Serin Yayla Havası 🏔️",
    gallery: ["assets/images/villages/gokcayir.jpg"]
  },
  {
    id: "koy_yesildere",
    name: "Yeşildere Köyü",
    distanceKm: 14,
    population: 530,
    headmanName: "Yusuf Torun",
    headmanPhone: "0544 768 98 28",
    description: "Dere kenarında yeşillikler içerisinde saklı Yeşildere Köyü, gür su kaynakları, çınar ağaçları ve alabalık potansiyeliyle eşsiz bir doğaya sahiptir.",
    imageUrl: "assets/images/villages/catak.jpg",
    latitude: 37.32,
    longitude: 36.51,
    highlights: ["Yeşildere Kanyonu", "Asırlık Çınar Ağaçları", "Berrak Akarsu", "Doğal Kamp Alanları"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Yeşildere",
        departureTimes: ["08:00", "13:00", "16:45"],
        driverPhone: "0544 768 98 28",
        driverName: "Yeşildere Birlik",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "21°C",
    weatherCondition: "Akarsu Serinliği 💧",
    gallery: ["assets/images/villages/catak.jpg"]
  },
  {
    id: "koy_yesilkoy",
    name: "Yeşilköy",
    distanceKm: 12,
    population: 860,
    headmanName: "Orhan Çolak",
    headmanPhone: "0541 509 92 33",
    description: "Yemyeşil doğası, meyve bahçeleri ve zeytinlikleriyle Yeşilköy, Düziçi'nin adını yeşilinden alan huzur dolu bir köyüdür.",
    imageUrl: "assets/images/villages/alibozlu.jpg",
    latitude: 37.28,
    longitude: 36.46,
    highlights: ["Yemyeşil Doğa Dokusu", "Zeytin ve Nar", "Organik Tarım", "Köy Misafirperverliği"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Yeşilköy",
        departureTimes: ["07:30", "11:30", "15:30", "17:30"],
        driverPhone: "0541 509 92 33",
        driverName: "Orhan Ç.",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "24°C",
    weatherCondition: "Ferah ve Açık 🍃",
    gallery: ["assets/images/villages/alibozlu.jpg"]
  },
  {
    id: "koy_yesilyurt",
    name: "Yeşilyurt Köyü",
    distanceKm: 9,
    population: 1150,
    headmanName: "İsmail Yutkal",
    headmanPhone: "0555 143 12 92",
    description: "Verimli Çukurova ovasının başlangıcında yer alan Yeşilyurt Köyü; fıstık, mısır ve narenciye üretimiyle bölgenin en canlı tarım köylerindendir.",
    imageUrl: "assets/images/villages/bocekli.jpg",
    latitude: 37.255,
    longitude: 36.42,
    highlights: ["Osmaniye Yerfıstığı", "Mısır & Narenciye", "Geniş Ova Tarlaları", "Modern Tarım"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Yeşilyurt",
        departureTimes: ["07:00", "09:30", "12:00", "14:30", "17:00"],
        driverPhone: "0555 143 12 92",
        driverName: "Yeşilyurt Birlik",
        fee: "15 ₺"
      }
    ],
    weatherTemp: "26°C",
    weatherCondition: "Güneşli Ova İklimi ☀️",
    gallery: ["assets/images/villages/bocekli.jpg"]
  },
  {
    id: "koy_bocekli",
    name: "Böcekli Beldesi / Köyü",
    distanceKm: 6,
    population: 3800,
    headmanName: "Mustafa Karaman",
    headmanPhone: "0543 566 25 74",
    description: "Atalan, Yeşilyurt ve Dümbürdek yerleşimlerinin birleşimiyle belde olan Böcekli, Roma dönemi su kemerleri kalıntılarına ev sahipliği yapar. Düziçi'nin en geniş sulak tarım arazilerine sahiptir.",
    imageUrl: "assets/images/villages/bocekli.jpg",
    latitude: 37.26,
    longitude: 36.43,
    highlights: ["Roma Su Kemerleri İzi", "Sulak Tarım Arazileri", "Modern Zeytinyağı Fabrikaları", "Mısır & Yerfıstığı"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Böcekli",
        departureTimes: ["07:00", "08:30", "10:00", "12:00", "14:00", "16:00", "18:00"],
        driverPhone: "0532 888 77 66",
        driverName: "Mustafa B.",
        fee: "15 ₺"
      }
    ],
    weatherTemp: "26°C",
    weatherCondition: "Ilık Ova İklimi 🌾",
    gallery: ["assets/images/villages/bocekli.jpg", "assets/images/villages/atalan.jpg"]
  },
  {
    id: "koy_ellek",
    name: "Ellek Beldesi / Köyü",
    distanceKm: 11,
    population: 6500,
    headmanName: "Ergen Çıplak",
    headmanPhone: "0538 310 51 80",
    description: "1969 yılında kurulan Ellek Beldesi, Peçenek Türk boylarının yerleşim mirasını taşır. Tarihi taş ve ahşap dokulu evleri ile Çukurova mimarisinin örneklerini sunar.",
    imageUrl: "assets/images/villages/ellek.jpg",
    latitude: 37.288,
    longitude: 36.48,
    highlights: ["Tarihi Peçenek Dokusu", "Ahşap & Taş Evler", "S.S. 130 Kooperatifi", "Zeytin & Bağcılık"],
    minibusRoutes: [
      {
        route: "Düziçi Otogar - Ellek",
        departureTimes: ["06:30", "07:30", "08:30", "10:00", "12:00", "14:00", "16:00", "17:30", "19:00"],
        driverPhone: "0328 882 75 74",
        driverName: "S.S. 130 Kooperatifi",
        fee: "20 ₺"
      }
    ],
    weatherTemp: "24°C",
    weatherCondition: "Açık Güneşli ☀️",
    gallery: ["assets/images/villages/ellek.jpg", "assets/images/villages/yarbasi.jpg"]
  },
  {
    id: "koy_yarbasi",
    name: "Yarbaşı Beldesi / Köyü",
    distanceKm: 7,
    population: 3600,
    headmanName: "Mehmet Karabaş",
    headmanPhone: "0531 848 38 85",
    description: "Karaçarlı ve Atatürk mahallelerinin birleşimiyle belde olan Yarbaşı, Çukurova efsanelerindeki Karacaoğlan şiir mirasını ve anı alanını yaşatan önemli bir kültür merkezidir.",
    imageUrl: "assets/images/villages/yarbasi.jpg",
    latitude: 37.199,
    longitude: 36.43,
    highlights: ["Karacaoğlan Anı Alanı", "Kültür & Sanat Parkı", "Tarihi Tren İstasyonu Hattı", "Bahçe Tarımı"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Yarbaşı",
        departureTimes: ["07:00", "08:00", "09:30", "11:00", "13:00", "15:00", "17:00", "18:30"],
        driverPhone: "0543 299 61 31",
        driverName: "Ahmet Y.",
        fee: "15 ₺"
      }
    ],
    weatherTemp: "25°C",
    weatherCondition: "Açık Bahçe Havası 🍃",
    gallery: ["assets/images/villages/yarbasi.jpg", "assets/images/villages/ellek.jpg"]
  },
  {
    id: "koy_atalan",
    name: "Atalan Beldesi / Köyü",
    distanceKm: 14,
    population: 1200,
    headmanName: "Serkan Özdemir",
    headmanPhone: "0541 604 81 80",
    description: "Ceyhan ve Sabun Çayı sulama havzasındaki verimli ovada yer alan Atalan Köyü, pamuk, mısır ve dokumacılık geleneğine sahip bereketli ova yerleşimlerindendir.",
    imageUrl: "assets/images/villages/atalan.jpg",
    latitude: 37.17,
    longitude: 36.415,
    highlights: ["Sulak Pamuk & Mısır Tarlaları", "Geniş Ova Ağaçları", "Büyükbaş Hayvancılık", "Verimli Araziler"],
    minibusRoutes: [
      {
        route: "Düziçi Çarşı - Atalan",
        departureTimes: ["07:30", "11:30", "15:30"],
        driverPhone: "0535 777 88 99",
        driverName: "Süleyman A.",
        fee: "25 ₺"
      }
    ],
    weatherTemp: "27°C",
    weatherCondition: "Güneşli Ova Havası ☀️",
    gallery: ["assets/images/villages/atalan.jpg", "assets/images/villages/bocekli.jpg"]
  }
];

async function updateAll() {
  console.log(`Total villages to populate: ${allVillages.length}`);

  // 1. Update backend/data/city_content.json
  const backendJsonPath = path.join(__dirname, '../data/city_content.json');
  const backendContent = JSON.parse(fs.readFileSync(backendJsonPath, 'utf8'));

  // Ensure villages is at index 0 in cityServices
  if (backendContent.explore && Array.isArray(backendContent.explore.cityServices)) {
    const sList = backendContent.explore.cityServices;
    const vIdx = sList.indexWhere ? sList.indexWhere(s => s.id === 'villages') : sList.findIndex(s => s.id === 'villages');
    if (vIdx > 0) {
      const vItem = sList.splice(vIdx, 1)[0];
      sList.unshift(vItem);
    }
  }

  // Update villages in backendContent
  if (!backendContent.explore) backendContent.explore = {};
  backendContent.explore.villages = allVillages;
  backendContent.villages = allVillages;

  fs.writeFileSync(backendJsonPath, JSON.stringify(backendContent, null, 2), 'utf8');
  console.log('Updated backend/data/city_content.json');

  // 2. Update assets/data/city_content.json
  const assetsJsonPath = path.join(__dirname, '../../assets/data/city_content.json');
  fs.writeFileSync(assetsJsonPath, JSON.stringify(backendContent, null, 2), 'utf8');
  console.log('Updated assets/data/city_content.json');

  // 3. Update Supabase Database
  if (process.env.DATABASE_URL) {
    try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      console.log('Connected to Supabase Postgres...');

      const res = await client.query(
        "UPDATE city_contents SET content = $1 WHERE id = 'default' OR id = '1' RETURNING id",
        [JSON.stringify(backendContent)]
      );
      console.log('Supabase city_contents updated, rows affected:', res.rowCount);
      await client.end();
    } catch (e) {
      console.error('Supabase update error:', e.message);
    }
  }
}

updateAll().catch(console.error);
