/**
 * Hepsi Düziçi — Gmail ihbar bildirimi (Google Apps Script)
 *
 * Kurulum:
 * 1. https://script.google.com → Yeni proje
 * 2. Bu dosyanın içeriğini yapıştır
 * 3. WEBHOOK_SECRET değerini kendin belirle (ör. rastgele 32 karakter)
 * 4. Dağıt → Yeni dağıtım → Tür: Web uygulaması
 *    - Çalıştır: Ben
 *    - Erişim: Herkes
 * 5. URL'yi Render'a GMAIL_WEBHOOK_URL olarak ekle
 * 6. WEBHOOK_SECRET'i Render'a GMAIL_WEBHOOK_SECRET olarak ekle
 */

const WEBHOOK_SECRET = 'BURAYA_GIZLI_ANAHTAR_YAZ';
const TO_EMAIL = 'hepsiduzici@gmail.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    if (data.secret !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, message: 'Yetkisiz' });
    }

    const to = data.to || TO_EMAIL;
    const subject = data.subject || 'Hepsi Duzici bildirimi';
    const text = data.text || '';
    const html = data.html || '';
    const replyTo = data.replyTo || '';

    MailApp.sendEmail({
      to,
      subject,
      body: text,
      htmlBody: html || undefined,
      replyTo: replyTo || undefined,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
