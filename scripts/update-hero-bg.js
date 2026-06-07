const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fileService = require('../src/services/fileService');

async function main() {
  const newBg = process.argv[2];
  if (!newBg) {
    console.error('❌ Hata: Lütfen yeni resim linkini veya dosya yolunu belirtin.');
    console.log('Kullanım: node scripts/update-hero-bg.js <resim_url_veya_dosya_yolu>');
    console.log('Örnek: node scripts/update-hero-bg.js https://example.com/resim.jpg');
    console.log('Örnek: node scripts/update-hero-bg.js assets/images/yesil_selalesi.jpg');
    process.exit(1);
  }

  try {
    console.log('🔄 City content verisi okunuyor...');
    const content = await fileService.readCityContent();
    
    if (!content.branding) {
      content.branding = {};
    }
    
    content.branding.heroCardBg = newBg;
    console.log(`💾 heroCardBg '${newBg}' olarak güncelleniyor...`);
    
    await fileService.writeCityContent(content);
    console.log('✅ Supabase ve yerel JSON dosyası başarıyla güncellendi!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Güncelleme hatası:', error.message);
    process.exit(1);
  }
}

main();
