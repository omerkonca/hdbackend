const { fetchEarthquakes } = require('./earthquakeService');
const { isFcmConfigured, sendMulticast } = require('./fcmService');
const { fetchMarketingTokens, logPush } = require('./pushTokenService');

let knownQuakeIds = new Set();
let isFirstRun = true;
let cronTimer = null;

/**
 * 15 saniyelik Döngü: Yeni Deprem Kontrolü ve Otomatik FCM Push Bildirimi
 */
async function checkNewEarthquakesAndNotify() {
  try {
    const earthquakes = await fetchEarthquakes(true);
    if (!earthquakes || earthquakes.length === 0) return;

    if (isFirstRun) {
      // İlk çalışmada mevcut 100 depremi hafızaya al ki eski depremler bildirim atmasın
      earthquakes.forEach(q => knownQuakeIds.add(q.id));
      isFirstRun = false;
      console.log(`[earthquakeCron] Başlatıldı. Hafızaya alınan deprem sayısı: ${knownQuakeIds.size}`);
      return;
    }

    // Yeni olan depremleri tespit et
    const newQuakes = earthquakes.filter(q => !knownQuakeIds.has(q.id));

    for (const quake of newQuakes) {
      knownQuakeIds.add(quake.id);

      // Kriter: Düziçi'ne 150 km'den yakın VE Büyüklük ≥ 3.0 VEYA Türkiye genelinde Büyüklük ≥ 5.0
      const shouldNotify = (quake.isNearDuzici && quake.magnitude >= 3.0) || (quake.magnitude >= 5.0);

      if (shouldNotify && isFcmConfigured()) {
        const title = `🚨 DEPREM BİLDİRİMİ (M ${quake.magnitude.toFixed(1)})`;
        const distText = quake.distanceKm <= 200 ? `${quake.distanceKm} km uzaklıkta` : 'Türkiye Geneli';
        const body = `${quake.location} (${distText})\nBüyüklük: M ${quake.magnitude.toFixed(1)} | Derinlik: ${quake.depth} km`;

        console.log(`[earthquakeCron] 🔔 YENİ DEPREM DETEKTED: ${title} - ${body}`);

        try {
          const tokens = await fetchMarketingTokens();
          if (tokens && tokens.length > 0) {
            const pushResult = await sendMulticast(tokens, {
              title,
              body,
              data: {
                target: 'screen:earthquake',
                quakeId: String(quake.id),
                magnitude: String(quake.magnitude),
                distanceKm: String(quake.distanceKm),
                location: String(quake.location),
              },
            });

            await logPush({
              title,
              body,
              target: 'earthquake_alert',
              sent: pushResult.sent,
              failed: pushResult.failed,
            });

            console.log(`[earthquakeCron] Push gönderildi: ${pushResult.sent} başarılı, ${pushResult.failed} başarısız.`);
          }
        } catch (pushErr) {
          console.error('[earthquakeCron] Push gönderimi sırasında hata:', pushErr.message);
        }
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
  console.log('⚡ [earthquakeCron] Anlık Deprem Taraması (15 sn) aktif.');
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
