const fs = require('fs');
const path = require('path');

const cityContentPath = path.resolve(__dirname, '../data/city_content.json');
const mapCorrectionsPath = path.resolve(__dirname, '../data/map_corrections.json');

const newCategories = [
  {
    id: "wc",
    icon: "wc",
    badge: "WC",
    title: "Umumi Tuvaletler",
    subtitle: "Düziçi genelindeki temiz umumi tuvaletler",
    places: [
      {
        name: "Merkez Çarşı Umumi WC",
        shortDescription: "Merkez çarşı içerisinde yer alan belediye tuvaleti.",
        detail: "Kurtuluş Mahallesi çarşı merkezinde, esnaf ve vatandaşlarımızın kolayca ulaşabileceği belediyeye ait temiz tuvalettir.",
        address: "Kurtuluş Mah., Çarşı İçi, Düziçi",
        tag: "ÇARŞI",
        lat: 37.2395,
        lng: 36.4462,
        image: "assets/images/wc_placeholder.jpg"
      },
      {
        name: "Şehitler Parkı WC",
        shortDescription: "Şehitler Parkı içerisindeki umumi tuvalet.",
        detail: "İrfanlı Mahallesi Şehitler Parkı içerisinde yer alan, engelli erişimine uygun temiz umumi tuvalettir.",
        address: "İrfanlı Mah., Şehitler Parkı İçi, Düziçi",
        tag: "PARK",
        lat: 37.2432,
        lng: 36.4505,
        image: "assets/images/wc_placeholder.jpg"
      },
      {
        name: "Yeni Otogar WC",
        shortDescription: "Düziçi Şehirlerarası Otobüs Terminali tuvaleti.",
        detail: "Yeni otogar binası içerisinde yer alan, transit yolcular ve şoför hemşehrilerimiz için 7/24 açık tuvalettir.",
        address: "Yeşilova Mah., Yeni Otogar İçi, Düziçi",
        tag: "OTOGAR",
        lat: 37.2335,
        lng: 36.4480,
        image: "assets/images/wc_placeholder.jpg"
      },
      {
        name: "Demokrasi Parkı WC",
        shortDescription: "Demokrasi Parkı içerisindeki engelsiz tuvalet.",
        detail: "İrfanlı Mahallesi Demokrasi Parkı içerisinde yer alan, belediye tarafından işletilen temiz umumi tuvalettir.",
        address: "İrfanlı Mah., Demokrasi Parkı İçi, Düziçi",
        tag: "PARK",
        lat: 37.2405,
        lng: 36.4520,
        image: "assets/images/wc_placeholder.jpg"
      },
      {
        name: "Belediye Yanı Park WC",
        shortDescription: "Belediye binası yanındaki park içi tuvalet.",
        detail: "Cumhuriyet Mahallesi Belediye binası yanındaki yeşil alanda bulunan, vatandaşlarımıza hizmet veren umumi WC.",
        address: "Cumhuriyet Mah., Belediye Yanı Parkı, Düziçi",
        tag: "BELEDİYE",
        lat: 37.2448,
        lng: 36.4515,
        image: "assets/images/wc_placeholder.jpg"
      }
    ]
  },
  {
    id: "supermarket",
    icon: "shopping_cart",
    badge: "Market",
    title: "Marketler",
    subtitle: "Düziçi'ndeki büyük süpermarket şubeleri",
    places: [
      {
        name: "A101 İrfanlı Şubesi",
        shortDescription: "İrfanlı Mahallesi'ndeki büyük A101 market şubesi.",
        detail: "Haftalık indirimler ve temel gıda ihtiyaçları için İrfanlı caddesi üzerinde hizmet veren zincir market şubesidir.",
        address: "İrfanlı Mah., Atatürk Cad., Düziçi",
        tag: "ZİNCİR",
        lat: 37.2412,
        lng: 36.4485,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "BİM Çarşı Şubesi",
        shortDescription: "Merkez çarşıda yer alan BİM market şubesi.",
        detail: "Kurtuluş Mahallesi çarşı merkezinde esnaf ve halkımızın sıklıkla tercih ettiği süpermarket zinciri şubesidir.",
        address: "Kurtuluş Mah., Çarşı Girişi, Düziçi",
        tag: "ZİNCİR",
        lat: 37.2392,
        lng: 36.4455,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "Şok Yeşilova Şubesi",
        shortDescription: "Yeşilova Mahallesi Şok market şubesi.",
        detail: "Yeşilova Mahallesi otogar yolu üzerinde, geniş ürün yelpazesi ile hizmet sunan perakende market şubesidir.",
        address: "Yeşilova Mah., Otogar Yolu, Düziçi",
        tag: "ZİNCİR",
        lat: 37.2460,
        lng: 36.4530,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "Tarım Kredi Kooperatif Market",
        shortDescription: "Doğal ve uygun fiyatlı kooperatif ürünleri marketi.",
        detail: "Belediye binası yakınında, yerli üreticilerden alınan doğal ürünleri uygun fiyatlarla sunan devlet kooperatif marketidir.",
        address: "Cumhuriyet Mah., Refik Cesur Bulvarı, Düziçi",
        tag: "KOOPERATİF",
        lat: 37.2425,
        lng: 36.4490,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "Düziçi M Migros",
        shortDescription: "Refik Cesur Bulvarı üzerindeki büyük M Migros şubesi.",
        detail: "Hürriyet Mahallesi Refik Cesur Bulvarı üzerinde zengin ürün çeşidi, taze reyonları ve Migros kalitesiyle hizmet veren süpermarkettir.",
        address: "Hürriyet Mah., Refik Cesur Bulvarı No:654, Düziçi",
        tag: "MİGROS",
        lat: 37.2430,
        lng: 36.4555,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "BİM Abdurrahman Gazi Şubesi",
        shortDescription: "Uzunbanı Mahallesi BİM market şubesi.",
        detail: "Uzunbanı Mahallesi Şehit Komiser Mustafa Sarı Caddesi üzerinde hizmet sunan BİM indirim marketi şubesidir.",
        address: "Uzunbanı Mah., Şehit Komiser Mustafa Sarı Cad., Düziçi",
        tag: "ZİNCİR",
        lat: 37.2485,
        lng: 36.4415,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "Şok Cumhuriyet Şubesi",
        shortDescription: "Cumhuriyet Mahallesi Şok market şubesi.",
        detail: "Cumhuriyet Mahallesi'nde vatandaşlarımızın günlük market ihtiyaçları için hizmet veren perakende zincir şubesidir.",
        address: "Cumhuriyet Mah., Şehit Komiser Mustafa Sarı Cad., Düziçi",
        tag: "ZİNCİR",
        lat: 37.2410,
        lng: 36.4525,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "A101 Asaf Namlı Şubesi",
        shortDescription: "Karşıyaka Mahallesi A101 market şubesi.",
        detail: "Karşıyaka Mahallesi Asaf Namlı Caddesi üzerinde yer alan zincir süpermarket şubesidir.",
        address: "Karşıyaka Mah., Asaf Namlı Cad. No:7, Düziçi",
        tag: "ZİNCİR",
        lat: 37.2350,
        lng: 36.4590,
        image: "assets/images/market_placeholder.jpg"
      },
      {
        name: "Gözde Süpermarket",
        shortDescription: "Kurtuluş Mahallesi yerel süpermarketi.",
        detail: "Kurtuluş Mahallesi'nde yıllardır Düziçi halkına güler yüzlü esnaf kültürü ve taze sebze-meyve reyonuyla hizmet veren yerel markettir.",
        address: "Kurtuluş Mah., Çarşı İçi, Düziçi",
        tag: "YEREL",
        lat: 37.2385,
        lng: 36.4475,
        image: "assets/images/market_placeholder.jpg"
      }
    ]
  },
  {
    id: "parking",
    icon: "local_parking",
    badge: "Otopark",
    title: "Otoparklar",
    subtitle: "Düziçi genelindeki açık ve kapalı otopark alanları",
    places: [
      {
        name: "Belediye Kapalı Otoparkı",
        shortDescription: "Belediye binası altındaki çok katlı kapalı otopark.",
        detail: "İlçe merkezindeki trafik yoğunluğunu azaltmak amacıyla hizmet veren, 7/24 kameralarla izlenen güvenli kapalı otoparktır.",
        address: "Cumhuriyet Mah., Belediye Binası Altı, Düziçi",
        tag: "KAPALI",
        lat: 37.2445,
        lng: 36.4510,
        image: "assets/images/parking_placeholder.jpg"
      },
      {
        name: "Çarşı Merkez Açık Otoparkı",
        shortDescription: "Kurtuluş Mahallesi açık otopark alanı.",
        detail: "Eski pazar yeri meydanında yer alan, çarşı alışverişine gelen hemşehrilerimizin kullandığı açık otopark alanıdır.",
        address: "Kurtuluş Mah., Eski Pazar Yeri, Düziçi",
        tag: "AÇIK",
        lat: 37.2390,
        lng: 36.4460,
        image: "assets/images/parking_placeholder.jpg"
      },
      {
        name: "Devlet Hastanesi Otoparkı",
        shortDescription: "Düziçi Devlet Hastanesi ücretsiz otoparkı.",
        detail: "Hastane ziyaretçileri ve hastalarımız için tasarlanmış geniş kapasiteli açık otopark alanıdır.",
        address: "Karlıca Mah., Hastane Caddesi, Düziçi",
        tag: "ÜCRETSİZ",
        lat: 37.2510,
        lng: 36.4350,
        image: "assets/images/parking_placeholder.jpg"
      },
      {
        name: "Hürriyet Mahallesi Otopark Alanı",
        shortDescription: "Refik Cesur Bulvarı arkası belediye açık otoparkı.",
        detail: "Hürriyet Mahallesi'ndeki ticari alanların yakınında bulunan ve park yeri ihtiyacını karşılayan geniş açık otopark sahasıdır.",
        address: "Hürriyet Mah., Refik Cesur Bulvarı Arkası, Düziçi",
        tag: "AÇIK",
        lat: 37.2420,
        lng: 36.4602,
        image: "assets/images/parking_placeholder.jpg"
      },
      {
        name: "RTE Bulvarı Yol Üstü Otoparkı",
        shortDescription: "RTE Bulvarı üzerindeki cepli otopark yerleri.",
        detail: "Recep Tayyip Erdoğan Bulvarı boyunca kısa süreli duraklama ve park etme için düzenlenmiş yol üstü otopark alanlarıdır.",
        address: "Refik Cesur Bulvarı, Düziçi",
        tag: "YOL ÜSTÜ",
        lat: 37.2370,
        lng: 36.4485,
        image: "assets/images/parking_placeholder.jpg"
      }
    ]
  },
  {
    id: "ev_charge",
    icon: "ev_station",
    badge: "Şarj",
    title: "Elektrikli Araç Şarj İstasyonları",
    subtitle: "Elektrikli araçlarınız için şarj noktaları",
    places: [
      {
        name: "ZES Şarj İstasyonu (Belediye)",
        shortDescription: "Belediye binası önündeki elektrikli şarj ünitesi.",
        detail: "Zorlu Energy Solutions (ZES) altyapısı ile hizmet veren hızlı şarj (DC) istasyonudur. Aynı anda iki aracı şarj edebilir.",
        address: "Cumhuriyet Mah., Belediye Meydanı, Düziçi",
        tag: "DC HIZLI",
        lat: 37.2442,
        lng: 36.4514,
        image: "assets/images/ev_placeholder.jpg"
      },
      {
        name: "Trugo Şarj İstasyonu (Dinlenme Tesis)",
        shortDescription: "Otoban girişi dinlenme tesisindeki Trugo hızlı şarj noktası.",
        detail: "Togg ve diğer tüm elektrikli araçları çok kısa sürede şarj edebilen yüksek hızlı (180 kW DC) şarj istasyonudur.",
        address: "Yarbaşı Otoban Girişi, Dinlenme Tesisleri, Düziçi",
        tag: "DC HIGHPOWER",
        lat: 37.2220,
        lng: 36.4310,
        image: "assets/images/ev_placeholder.jpg"
      },
      {
        name: "Eşarj İstasyonu (Çarşı)",
        shortDescription: "Çarşı merkezindeki AC şarj ünitesi.",
        detail: "Alışveriş yaparken aracınızı şarj edebileceğiniz 22 kW gücünde AC şarj noktasıdır.",
        address: "Kurtuluş Mah., Atatürk Caddesi, Düziçi",
        tag: "AC NORMAL",
        lat: 37.2402,
        lng: 36.4470,
        image: "assets/images/ev_placeholder.jpg"
      },
      {
        name: "Trugo Şarj İstasyonu (RTE Bulvarı)",
        shortDescription: "RTE Bulvarı üzerindeki elektrikli araç şarj ünitesi.",
        detail: "Recep Tayyip Erdoğan Bulvarı üzerindeki dinlenme ve otopark cebinde Trugo altyapısı ile hizmet veren DC şarj noktasıdır.",
        address: "RTE Bulvarı Dinlenme Alanı, Düziçi",
        tag: "DC HIZLI",
        lat: 37.2415,
        lng: 36.4560,
        image: "assets/images/ev_placeholder.jpg"
      }
    ]
  },
  {
    id: "school",
    icon: "school",
    badge: "Okul",
    title: "Eğitim Kurumları",
    subtitle: "Düziçi'ndeki liseler, ortaokullar ve ilkokullar",
    places: [
      {
        name: "Düziçi Fen Lisesi",
        shortDescription: "Tarihi enstitü kampüsünde yer alan fen lisemiz.",
        detail: "Tarihi Haruniye Köy Enstitüsü binalarının da yer aldığı köklü kampüste eğitim veren, ilçemizin en başarılı ortaöğretim kurumudur.",
        address: "Haruniye Beldesi, Fen Lisesi Caddesi, Düziçi",
        tag: "LİSE",
        lat: 37.3810,
        lng: 36.4920,
        image: "assets/images/school_placeholder.jpg"
      },
      {
        name: "Düziçi Anadolu Lisesi",
        shortDescription: "İrfanlı Mahallesi'nin köklü anadolu lisesi.",
        detail: "Geniş spor alanları ve modern laboratuvarları ile yüzlerce gencimizi geleceğe hazırlayan köklü lisemizdir.",
        address: "İrfanlı Mah., Lise Sokak, Düziçi",
        tag: "LİSE",
        lat: 37.2480,
        lng: 36.4560,
        image: "assets/images/school_placeholder.jpg"
      },
      {
        name: "Cumhuriyet İlkokulu",
        shortDescription: "Düziçi ilçe merkezinin en eski ilkokulu.",
        detail: "Cumhuriyetin ilk yıllarından bu yana eğitim veren, ilçe merkezinde yer alan tarihi ve köklü ilkokulumuzdur.",
        address: "Cumhuriyet Mah., Çarşı Yolu, Düziçi",
        tag: "İLKOKUL",
        lat: 37.2415,
        lng: 36.4495,
        image: "assets/images/school_placeholder.jpg"
      },
      {
        name: "Düziçi Mesleki ve Teknik Anadolu Lisesi",
        shortDescription: "Mesleki eğitim veren köklü teknik lise.",
        detail: "İlçemizde sanayi, bilişim ve teknik alanlarda nitelikli iş gücü yetiştiren, atölyeleri gelişmiş meslek lisemizdir.",
        address: "Kurtuluş Mah., İstasyon Yolu, Düziçi",
        tag: "TEKNİK LİSE",
        lat: 37.2340,
        lng: 36.4410,
        image: "assets/images/school_placeholder.jpg"
      },
      {
        name: "Karacaoğlan Ortaokulu",
        shortDescription: "İlçe merkezindeki başarılı ortaöğretim okulu.",
        detail: "Cumhuriyet Mahallesi'nde yer alan, akademik ve sportif başarıları ile öne çıkan ilçe merkezindeki ortaokulumuzdur.",
        address: "Cumhuriyet Mah., Karacaoğlan Sokak, Düziçi",
        tag: "ORTAOKUL",
        lat: 37.2430,
        lng: 36.4470,
        image: "assets/images/school_placeholder.jpg"
      }
    ]
  },
  {
    id: "library",
    icon: "local_library",
    badge: "Kütüphane",
    title: "Kütüphaneler",
    subtitle: "Kitap okuma ve sessiz çalışma alanları",
    places: [
      {
        name: "Düziçi İlçe Halk Kütüphanesi",
        shortDescription: "Sessiz çalışma odaları ve geniş kitap arşivi olan kütüphane.",
        detail: "İrfanlı caddesinde yer alan kütüphane; öğrenciler için internet ve bilgisayar erişimi, sessiz çalışma odaları ve binlerce kaynak kitap sunar.",
        address: "İrfanlı Mah., Kütüphane Sokak, Düziçi",
        tag: "KAMU",
        lat: 37.2470,
        lng: 36.4460,
        image: "assets/images/library_placeholder.jpg"
      },
      {
        name: "Köy Enstitüsü Arşiv Kütüphanesi",
        shortDescription: "Tarihi köy enstitüsü belgeleri ve arşiv kütüphanesi.",
        detail: "Müze kompleksi içerisinde yer alan, 1940'lardan kalma eğitim materyalleri ve arşiv kitaplarını barındıran tarihi kütüphanedir.",
        address: "Haruniye Beldesi, Köy Enstitüsü Müzesi İçi, Düziçi",
        tag: "TARİHİ",
        lat: 37.3812,
        lng: 36.4922,
        image: "assets/images/library_placeholder.jpg"
      },
      {
        name: "Düziçi Gençlik Merkezi Kütüphanesi",
        shortDescription: "Gençlik Merkezi bünyesindeki sessiz çalışma salonu.",
        detail: "Gençlik ve Spor Bakanlığı Gençlik Merkezi içinde yer alan, çay-kahve ikramı eşliğinde ders çalışılabilen kütüphane alanıdır.",
        address: "İrfanlı Mah., Gençlik Merkezi İçi, Düziçi",
        tag: "GENÇLİK",
        lat: 37.2460,
        lng: 36.4550,
        image: "assets/images/library_placeholder.jpg"
      }
    ]
  },
  {
    id: "police",
    icon: "shield",
    badge: "Karakol",
    title: "Karakollar ve Emniyet",
    subtitle: "Düziçi güvenlik birimleri ve karakolları",
    places: [
      {
        name: "Düziçi İlçe Emniyet Müdürlüğü",
        shortDescription: "İlçe emniyet ve polis merkezi binası.",
        detail: "Düziçi ilçe merkezinin huzur ve güvenliğinden sorumlu ana emniyet müdürlüğü kampüsüdür.",
        address: "Cumhuriyet Mah., Atatürk Caddesi, Düziçi",
        tag: "POLİS",
        lat: 37.2420,
        lng: 36.4515,
        image: "assets/images/police_placeholder.jpg"
      },
      {
        name: "Haruniye Polis Merkezi Amirliği",
        shortDescription: "Haruniye bölgesindeki emniyet karakolu.",
        detail: "Haruniye ve çevre mahallelerin asayiş kontrolünden sorumlu emniyet birimidir.",
        address: "Haruniye Beldesi, Cumhuriyet Cad., Düziçi",
        tag: "POLİS",
        lat: 37.3805,
        lng: 36.4905,
        image: "assets/images/police_placeholder.jpg"
      },
      {
        name: "Düziçi İlçe Jandarma Komutanlığı",
        shortDescription: "Kırsal alan ve köylerimizin güvenliğinden sorumlu jandarma binası.",
        detail: "Yarbaşı, Ellek beldeleri ve Düziçi'ne bağlı tüm köylerin asayişinden sorumlu ilçe jandarma komutanlığı karargahıdır.",
        address: "İstiklal Mah., Refik Cesur Bulvarı, Düziçi",
        tag: "JANDARMA",
        lat: 37.2402,
        lng: 36.4550,
        image: "assets/images/police_placeholder.jpg"
      },
      {
        name: "Düziçi Trafik Denetleme Büro Amirliği",
        shortDescription: "Trafik tescil ve denetleme birimi karakolu.",
        detail: "İlçe genelindeki trafik güvenliği, ehliyet tescil ve trafik akışını düzenleyen emniyet alt birimidir.",
        address: "Kurtuluş Mah., Atatürk Caddesi, Düziçi",
        tag: "TRAFİK",
        lat: 37.2390,
        lng: 36.4490,
        image: "assets/images/police_placeholder.jpg"
      }
    ]
  },
  {
    id: "restaurant",
    icon: "restaurant",
    badge: "Yemek",
    title: "Restoranlar",
    subtitle: "Kebap, döner ve yöresel lezzet restoranları",
    places: [
      {
        name: "Düziçi Çarşı Kebapçısı",
        shortDescription: "Geleneksel zırh kıyması Adana kebabı salonu.",
        detail: "Merkez çarşıda esnafın ve ziyaretçilerin vazgeçilmez durağı olan, zırh kıyması kebapları ile meşhur tarihi kebap salonudur.",
        address: "Kurtuluş Mah., Kebapçılar Caddesi, Düziçi",
        tag: "KEBAP",
        lat: 37.2395,
        lng: 36.4465,
        image: "assets/images/restaurant_placeholder.jpg"
      },
      {
        name: "Sabun Çayı Alabalık Tesisleri",
        shortDescription: "Sabun çayı üzerinde nehir kenarında taze alabalık.",
        detail: "Sabun çayının buz gibi suları üzerine kurulmuş tahtlarda, taze kiremitte alabalık ve yöresel mezeler sunan doğa restoranıdır.",
        address: "Sabun Çayı Turizm Yolu, Düziçi",
        tag: "DOĞA",
        lat: 37.2840,
        lng: 36.4680,
        image: "assets/images/restaurant_placeholder.jpg"
      },
      {
        name: "Haruniye Lezzet Sofrası",
        shortDescription: "Ev yemekleri ve yöresel sac kavurma salonu.",
        detail: "Haruniye merkezinde yer alan, anne eli değmiş lezzette ev yemekleri ve meşhur Haruniye sac kavurması yapan lokantadır.",
        address: "Haruniye Beldesi, Merkez Meydanı, Düziçi",
        tag: "YÖRESEL",
        lat: 37.3810,
        lng: 36.4915,
        image: "assets/images/restaurant_placeholder.jpg"
      },
      {
        name: "Harmanyeri Restaurant",
        shortDescription: "Geniş ızgara çeşitleri ve şık aile restoranı.",
        detail: "Düziçi'nde ailelerin sıklıkla tercih ettiği, ızgara çeşitleri, kebaplar ve mezeleriyle ünlü popüler bir akşam yemeği restoranıdır.",
        address: "İrfanlı Mah., Çevre Yolu Mevkii, Düziçi",
        tag: "IZGARA",
        lat: 37.2360,
        lng: 36.4490,
        image: "assets/images/restaurant_placeholder.jpg"
      },
      {
        name: "Şafak Lokantası",
        shortDescription: "Kebap ve sıcak ev yemekleri sunan köklü lokanta.",
        detail: "Kurtuluş Mahallesi çarşı merkezinde, çorba çeşitleri, taze sulu yemekler ve lezzetli kebapları ile bilinen ünlü esnaf lokantasıdır.",
        address: "Kurtuluş Mah., Çarşı İçi, Düziçi",
        tag: "ESNAF",
        lat: 37.2398,
        lng: 36.4462,
        image: "assets/images/restaurant_placeholder.jpg"
      },
      {
        name: "Esentepe Aile Restaurant",
        shortDescription: "Düziçi manzaralı tepede doğa ve ızgara lokantası.",
        detail: "Düziçi ilçesine yüksekten bakan Esentepe mevkisinde kurulu, doğa içinde semaver çayı ve ızgara et sunan manzaralı aile restoranıdır.",
        address: "Esentepe Mahallesi, Manzara Yolu, Düziçi",
        tag: "MANZARALI",
        lat: 37.2550,
        lng: 36.4380,
        image: "assets/images/restaurant_placeholder.jpg"
      }
    ]
  },
  {
    id: "cafe",
    icon: "coffee",
    badge: "Kafe",
    title: "Kafeler",
    subtitle: "Kahve ve çay eşliğinde hoşça vakit geçirebileceğiniz kafeler",
    places: [
      {
        name: "Cadde Saray Cafe",
        shortDescription: "Geniş oturma alanı ve zengin menüsü olan popüler kafe.",
        detail: "İrfanlı Mahallesi stadyum caddesi üzerinde, Düziçi gençliğinin ve ailelerin okey oynamak, kahve içmek ve sohbet etmek için tercih ettiği en büyük kafedir.",
        address: "İrfanlı Mah., Stadyum Caddesi, Düziçi",
        tag: "EĞLENCE",
        lat: 37.2450,
        lng: 36.4520,
        image: "assets/images/cafe_placeholder.jpg"
      },
      {
        name: "Tarihi Çınar Kafe",
        shortDescription: "Asırlık çınarlar altında çay ve kahvaltı keyfi.",
        detail: "Uzunbanı Mahallesi'nde yer alan, asırlık çınar ağaçlarının gölgesinde, kuş sesleri eşliğinde çayınızı yudumlayabileceğiniz huzurlu bir bahçedir.",
        address: "Uzunbanı Mah., Çınar Yolu, Düziçi",
        tag: "DOĞAL",
        lat: 37.2462,
        lng: 36.4402,
        image: "assets/images/cafe_placeholder.jpg"
      },
      {
        name: "Belediye Park Kafe & Bistro",
        shortDescription: "Şehitler Parkı içerisindeki belediye sosyal tesisi.",
        detail: "Belediyemize ait, ailelerin güvenle gelip uygun fiyatlı çay, kahve içip aperatif yemekler yiyebileceği modern sosyal tesistir.",
        address: "İrfanlı Mah., Şehitler Parkı İçi, Düziçi",
        tag: "SOSYAL",
        lat: 37.2435,
        lng: 36.4502,
        image: "assets/images/cafe_placeholder.jpg"
      },
      {
        name: "Story House Cafe",
        shortDescription: "Özel kahve, tatlı ve waffle sunan butik kafe.",
        detail: "İrfanlı Mahallesi'nde modern tasarımı, geniş kahve menüsü, lezzetli waffle ve pastaları ile bilinen şık bir konsept kafedir.",
        address: "İrfanlı Mah., Atatürk Caddesi, Düziçi",
        tag: "MODERN",
        lat: 37.2458,
        lng: 36.4532,
        image: "assets/images/cafe_placeholder.jpg"
      },
      {
        name: "Kafe De Keyf",
        shortDescription: "Sıcak atmosferi ve canlı müzik akşamları ile ünlü kafe.",
        detail: "İstiklal Mahallesi çevre yolu civarında yer alan, gençlerin akustik gitar dinletileri ve sıcak içecekler için toplandığı popüler kafedir.",
        address: "İstiklal Mah., Park Sokak, Düziçi",
        tag: "CANLI MÜZİK",
        lat: 37.2405,
        lng: 36.4585,
        image: "assets/images/cafe_placeholder.jpg"
      },
      {
        name: "Çavuşoğlu N'Fess Cafe",
        shortDescription: "Çarşı içinde leziz tatlılar ve kahve durağı.",
        detail: "Kurtuluş Mahallesi çarşı merkezinde, alışveriş arasında kahve molası vermek ve enfes cup tatlıları denemek için harika bir butik mekan.",
        address: "Kurtuluş Mah., Çarşı İçi, Düziçi",
        tag: "BUTİK",
        lat: 37.2380,
        lng: 36.4470,
        image: "assets/images/cafe_placeholder.jpg"
      }
    ]
  },
  {
    id: "hotels",
    icon: "hotel",
    badge: "Otel",
    title: "Oteller",
    subtitle: "Düziçi genelinde konaklayabileceğiniz oteller ve pansiyonlar",
    places: [
      {
        name: "Karacaoğlan Otel",
        shortDescription: "Düziçi ilçe merkezinde konforlu konaklama hizmeti.",
        detail: "İlçe merkezinde, çarşıya ve resmi kurumlara yürüme mesafesinde yer alan temiz ve konforlu mahalle otelidir.",
        address: "Kurtuluş Mahallesi, Refik Cesur Bulvarı, Düziçi",
        tag: "MERKEZ",
        lat: 37.2405,
        lng: 36.4475,
        image: "assets/images/hotel_placeholder.jpg"
      },
      {
        name: "Düziçi Termal Otel",
        shortDescription: "Haruniye Kaplıcaları bünyesinde şifalı termal otel.",
        detail: "Düziçi'nin en önemli turizm noktası olan Haruniye Kaplıcaları içerisinde, şifalı kaplıca suları ve doğa manzarası eşliğinde konaklama imkanı.",
        address: "Haruniye Kaplıcaları Mevkii, Düziçi",
        tag: "KAPLICA",
        lat: 37.3820,
        lng: 36.4910,
        image: "assets/images/hotel_placeholder.jpg"
      },
      {
        name: "Düziçi Öğretmenevi",
        shortDescription: "Merkezi konumda, güvenilir kamu otel hizmeti.",
        detail: "İlçe merkezinde yer alan, öğretmenlerimizin ve tüm vatandaşlarımızın konaklayabileceği, temiz oda ve kahvaltı imkanı sunan resmi tesistir.",
        address: "İrfanlı Mah., Refik Cesur Bulvarı, Düziçi",
        tag: "KAMU",
        lat: 37.2422,
        lng: 36.4530,
        image: "assets/images/hotel_placeholder.jpg"
      },
      {
        name: "Mina Otel",
        shortDescription: "Cumhuriyet Mahallesi'nde modern ilçe oteli.",
        detail: "Cumhuriyet Mahallesi'nde yer alan, iş seyahatleri ve aile ziyaretleri için klimalı, modern odalara sahip güvenli bir oteldir.",
        address: "Cumhuriyet Mah., Otel Yolu, Düziçi",
        tag: "MODERN",
        lat: 37.2410,
        lng: 36.4505,
        image: "assets/images/hotel_placeholder.jpg"
      },
      {
        name: "Göllüoğlu Apart",
        shortDescription: "Hürriyet Mahallesi'nde günlük kiralık mutfaklı apart daireler.",
        detail: "Hürriyet Mahallesi'nde, kendi yemeğinizi hazırlayabileceğiniz eşyalı, temiz apart konaklama seçeneğidir.",
        address: "Hürriyet Mah., Apart Sokak, Düziçi",
        tag: "APART",
        lat: 37.2440,
        lng: 36.4570,
        image: "assets/images/hotel_placeholder.jpg"
      }
    ]
  },
  {
    id: "cinema",
    icon: "movie",
    badge: "Sinema",
    title: "Sinemalar ve Kültür",
    subtitle: "Sinema salonu ve tiyatro etkinlik merkezleri",
    places: [
      {
        name: "Belediye Kültür & Sinema Salonu",
        shortDescription: "Kültür merkezi bünyesinde sinema ve tiyatro salonu.",
        detail: "Belediye kültür merkezinde yer alan, güncel filmlerin vizyona girdiği, çocuk tiyatroları ve konferansların düzenlendiği modern sinema salonudur.",
        address: "Cumhuriyet Mah., Belediye Kültür Merkezi, Düziçi",
        tag: "SİNEMA",
        lat: 37.2444,
        lng: 36.4512,
        image: "assets/images/cinema_placeholder.jpg"
      }
    ]
  },
  {
    id: "sports",
    icon: "sports_soccer",
    badge: "Spor",
    title: "Spor Tesisleri",
    subtitle: "Stadyumlar, spor salonları ve halı sahalar",
    places: [
      {
        name: "Düziçi İlçe Stadyumu",
        shortDescription: "Profesyonel futbol müsabakalarının yapıldığı ilçe stadı.",
        detail: "İrfanlı Mahallesi'nde bulunan, etrafında yürüyüş parkurları ve tenis kortları da barındıran Düziçi'nin en büyük spor kompleksidir.",
        address: "İrfanlı Mah., Stadyum Caddesi, Düziçi",
        tag: "STADYUM",
        lat: 37.2465,
        lng: 36.4545,
        image: "assets/images/sports_placeholder.jpg"
      },
      {
        name: "Karacaoğlan Kapalı Spor Salonu",
        shortDescription: "Basketbol ve voleybol müsabakalarına uygun kapalı spor salonu.",
        detail: "Gençlik Spor İlçe Müdürlüğü bünyesinde yer alan, voleybol, basketbol, güreş ve jimnastik eğitimlerinin verildiği kapalı spor salonudur.",
        address: "İrfanlı Mah., Stadyum Yanı, Düziçi",
        tag: "SALON",
        lat: 37.2458,
        lng: 36.4538,
        image: "assets/images/sports_placeholder.jpg"
      },
      {
        name: "Belediye Olimpik Halı Saha",
        shortDescription: "Haftalık arkadaş maçları için kiralanabilen sentetik saha.",
        detail: "Suni çim zeminli, aydınlatmalı ve soyunma odaları bulunan belediyeye ait kiralık halı saha tesisidir.",
        address: "İstiklal Mah., Çevre Yolu Üzeri, Düziçi",
        tag: "HALI SAHA",
        lat: 37.2405,
        lng: 36.4580,
        image: "assets/images/sports_placeholder.jpg"
      }
    ]
  }
];

function run() {
  console.log('🔄 Loading city_content.json...');
  const content = JSON.parse(fs.readFileSync(cityContentPath, 'utf8'));

  if (!content.explore) content.explore = {};
  if (!content.explore.categories) content.explore.categories = [];

  for (const cat of newCategories) {
    const existingIndex = content.explore.categories.findIndex(c => c.id === cat.id);
    const categoryData = {
      id: cat.id,
      icon: cat.icon,
      badge: cat.badge,
      title: cat.title,
      subtitle: cat.subtitle,
      places: cat.places.map(p => ({
        name: p.name,
        shortDescription: p.shortDescription,
        detail: p.detail,
        address: p.address,
        tag: p.tag,
        image: p.image,
        lat: p.lat,
        lng: p.lng,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
      }))
    };

    if (existingIndex !== -1) {
      content.explore.categories[existingIndex] = categoryData;
      console.log(`✅ Updated existing ${cat.id} category.`);
    } else {
      content.explore.categories.push(categoryData);
      console.log(`✅ Added new ${cat.id} category.`);
    }
  }

  // Save changes to city_content.json
  fs.writeFileSync(cityContentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log('✅ city_content.json updated successfully with all categories!');

  // Update map_corrections.json
  console.log('🔄 Loading map_corrections.json...');
  const corrections = JSON.parse(fs.readFileSync(mapCorrectionsPath, 'utf8'));
  if (!corrections.places) corrections.places = {};

  for (const cat of newCategories) {
    for (const p of cat.places) {
      corrections.places[p.name] = {
        lat: p.lat,
        lng: p.lng,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
      };
    }
  }

  fs.writeFileSync(mapCorrectionsPath, JSON.stringify(corrections, null, 2) + '\n', 'utf8');
  console.log('✅ map_corrections.json updated successfully!');
}

run();
