const { fetchEarthquakes } = require('./earthquakeService');
const { isFcmConfigured, sendToTopic } = require('./fcmService');
const { logPush } = require('./pushTokenService');
const { wasEarthquakeAlerted, markEarthquakeAlerted } = require('../utils/earthquakePushLog');

let isFirstRun = true;
let cronTimer = null;

// Maksimum bildirim gönderilme yaşı (15 dakika).
// 15 dakikadan eski depremler (örn. dün gerçekleşmiş veya saatler önce olmuş) ASLA bildirim tetiklemez!
const MAX_ALERT_AGE_MS = 15 * 60 * 1000;

/**
 * 15 saniyelik Döngü: Yeni Deprem Kontrolü ve Otomatik FCM Push Bildirimi.
 *
 * Güvenlik ve Doğruluk Önlemleri:
 * 1. ZAMAN SINIRI: Deprem oluş saati 15 dakikadan eskiyse KESİNLİKLE bildirim atılmaz (gece veya saatler sonra bildirim düşmesini %100 engeller).
 * 2. UZAMSAL-ZAMANSAL TEKİLLEŞTİRME (Revizyon Koruması): Kandilli revizyon yaptığında veya AFAD/Kandilli aynı depremi bildirdiğinde (farklı ID ile gelse dahi) koordinat ve zaman kontrolüyle aynı sarsıntı olduğu anlaşılır ve mükerrer bildirim engellenir.
 * 3. KALICI DİSK KAYDI (earthquake_push_log.json): Render sunucusu uyusa veya yeniden başlasa bile önceki bildirimler diske yazıldığı için hiçbir zaman hafıza kaybı yaşanmaz.
 */
async function checkNewEarthquakesAndNotify() {
  try {
    const earthquakes = await fetchEarthquakes(true);
    if (!earthquakes || earthquakes.length === 0) return;

    if (isFirstRun) {
      // Sunucu ilk açıldığında halihazırda listede olan eski depremleri hafızaya sessizce al
      for (const q of earthquakes) {
        const ageMs = Date.now() - (q.timestamp || 0);
        if (ageMs > MAX_ALERT_AGE_MS) {
          await markEarthquakeAlerted(q);
        }
      }
      isFirstRun = false;
      console.log(`[earthquakeCron] Başlatıldı. Mevcut sismik veriler senkronize edildi.`);
      return;
    }

    const now = Date.now();

    for (const quake of earthquakes) {
      const qTime = Number(quake.timestamp || 0);
      const ageMs = now - qTime;

      // 1. ZAMAN KONTROLÜ: 15 dakikadan eski veya geleceğe ait hatalı kayıtlar atlanır
      if (ageMs > MAX_ALERT_AGE_MS || ageMs < -60 * 1000) {
        continue;
      }

      // 2. KRİTER KONTROLÜ:
      // Düziçi'ne 150 km'den yakın VE Büyüklük ≥ 3.0 VEYA Türkiye genelinde Büyüklük ≥ 5.0
      const isNear = quake.distanceKm <= 150 && quake.magnitude >= 3.0;
      const isMajorTurkey = quake.magnitude >= 5.0;

      if (!isNear && !isMajorTurkey) {
        continue;
      }

      // 3. MÜKERRER & REVİZYON KONTROLÜ:
      // Bu deprem (veya Kandilli revizesi / AFAD karşılığı) daha önce bildirildi mi?
      const alreadyAlerted = await wasEarthquakeAlerted(quake);
      if (alreadyAlerted) {
        continue;
      }

      // 4. BİLDİRİM GÖNDER
      if (isFcmConfigured()) {
        const isNearDuzici = quake.distanceKm <= 150;
        const title = isNearDuzici
          ? `🚨 DÜZİÇİ YAKINLARINDA DEPREM (M ${quake.magnitude.toFixed(1)})`
          : `🚨 DEPREM BİLDİRİMİ (M ${quake.magnitude.toFixed(1)})`;
        const distText = quake.distanceKm <= 200 ? `${quake.distanceKm} km uzaklıkta` : 'Türkiye Geneli';
        const providerText = quake.provider ? ` [${quake.provider}]` : '';
        const body = `${quake.location} (${distText})\nBüyüklük: M ${quake.magnitude.toFixed(1)} | Derinlik: ${quake.depth} km${providerText}`;

        console.log(`[earthquakeCron] 🔔 YENİ DEPREM TESPİT EDİLDİ: ${title} - ${body}`);

        try {
          const pushResult = await sendToTopic('earthquake_alerts', {
            title,
            body,
            data: {
              target: 'screen:earthquake',
              route: 'screen:earthquake',
              quakeId: String(quake.id),
              magnitude: String(quake.magnitude),
              distanceKm: String(quake.distanceKm),
              location: String(quake.location),
            },
          });

          // Diske ve belleğe anında işle (server yeniden başlasa bile asla tekrar atmaz!)
          await markEarthquakeAlerted(quake);

          await logPush({
            title,
            body,
            target: 'earthquake_alert',
            sent: pushResult.success ? 1 : 0,
            failed: pushResult.success ? 0 : 1,
          });

          console.log(`[earthquakeCron] Topic push (earthquake_alerts): ${pushResult.success ? 'başarılı' : 'başarısız (' + pushResult.error + ')'}`);
        } catch (pushErr) {
          console.error('[earthquakeCron] Push gönderimi sırasında hata:', pushErr.message);
        }
      } else {
        // FCM yapılandırılmamışsa bile mükerrer işlemeyi engellemek için kaydet
        await markEarthquakeAlerted(quake);
      }
    }
  } catch (err) {
    console.warn('[earthquakeCron] Kontrol döngüsünde hata:', err.message);
  }
}

function startEarthquakeCron() {
  if (cronTimer) return;
  // İlk kontrol 5 sn sonra, ardından 15 saniyede bir
  setTimeout(checkNewEarthquakesAndNotify, 5000);
  cronTimer = setInterval(checkNewEarthquakesAndNotify, 15000);
  console.log('⚡ [earthquakeCron] Anlık Deprem Taraması (15 sn - AFAD + Kandilli Hibrit) aktif.');
}

function stopEarthquakeCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
}

module.exports = {
  startEarthquakeCron,
  stopEarthquakeCron,
};
