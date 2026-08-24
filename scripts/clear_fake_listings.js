require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const backendJsonPath = path.resolve(__dirname, '../data/city_content.json');
const assetsJsonPath = path.resolve(__dirname, '../../assets/data/city_content.json');

function cleanListings(data) {
  let modified = false;

  // 1. Root level
  if (data.privateTutors && data.privateTutors.length > 0) {
    console.log(`🧹 ${data.privateTutors.length} adet privateTutors temizleniyor.`);
    data.privateTutors = [];
    modified = true;
  }
  if (data.customEvents && data.customEvents.length > 0) {
    console.log(`🧹 ${data.customEvents.length} adet customEvents temizleniyor.`);
    data.customEvents = [];
    modified = true;
  }

  // 2. explore level
  const exp = data.explore || data;
  if (exp.realEstates && exp.realEstates.length > 0) {
    console.log(`🧹 ${exp.realEstates.length} adet realEstates temizleniyor.`);
    exp.realEstates = [];
    modified = true;
  }
  if (exp.autoVehicles && exp.autoVehicles.length > 0) {
    console.log(`🧹 ${exp.autoVehicles.length} adet autoVehicles temizleniyor.`);
    exp.autoVehicles = [];
    modified = true;
  }
  if (exp.localProducts && exp.localProducts.length > 0) {
    console.log(`🧹 ${exp.localProducts.length} adet localProducts temizleniyor.`);
    exp.localProducts = [];
    modified = true;
  }
  if (data.localProducts && data.localProducts.length > 0) {
    data.localProducts = [];
    modified = true;
  }
  if (exp.jobListings && exp.jobListings.length > 0) {
    console.log(`🧹 ${exp.jobListings.length} adet jobListings temizleniyor.`);
    exp.jobListings = [];
    modified = true;
  }
  if (exp.lostFound && exp.lostFound.length > 0) {
    console.log(`🧹 ${exp.lostFound.length} adet lostFound temizleniyor.`);
    exp.lostFound = [];
    modified = true;
  }
  if (exp.cityDeals && exp.cityDeals.length > 0) {
    console.log(`🧹 ${exp.cityDeals.length} adet cityDeals temizleniyor.`);
    exp.cityDeals = [];
    modified = true;
  }

  // 3. cityServices directoryData temizliği (Emlak & Oto Galeri & Yöresel Pazar altındaki sahte yerler)
  if (Array.isArray(exp.cityServices)) {
    for (const svc of exp.cityServices) {
      if (['real_estate', 'auto_gallery', 'local_products', 'local_market'].includes(svc.id) && svc.directoryData && svc.directoryData.length > 0) {
        console.log(`🧹 cityServices ${svc.id} directoryData temizlendi.`);
        svc.directoryData = [];
        modified = true;
      }
    }
  }

  return { data, modified };
}

async function main() {
  console.log('🚀 Fake ilan ve sahte içerikleri temizleme işlemi başladı...\n');

  // A. Backend JSON dosyasını temizle
  if (fs.existsSync(backendJsonPath)) {
    const raw = fs.readFileSync(backendJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const { data: cleaned } = cleanListings(parsed);
    fs.writeFileSync(backendJsonPath, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log('✅ backend/data/city_content.json temizlendi ve kaydedildi.');
  }

  // B. Assets JSON dosyasını temizle
  if (fs.existsSync(assetsJsonPath)) {
    const raw = fs.readFileSync(assetsJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const { data: cleaned } = cleanListings(parsed);
    fs.writeFileSync(assetsJsonPath, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log('✅ assets/data/city_content.json temizlendi ve kaydedildi.');
  }

  // C. Supabase veritabanındaki city_contents tablosunu güncelle
  try {
    const { requireSupabaseAdmin } = require('../src/utils/supabaseAdmin');
    const supabase = requireSupabaseAdmin();
    const { data: row, error: fetchErr } = await supabase
      .from('city_contents')
      .select('id, data')
      .eq('id', 1)
      .maybeSingle();

    if (fetchErr) {
      console.error('❌ Supabase okuma hatası:', fetchErr.message);
    } else if (row && row.data) {
      const { data: cleanedDbData } = cleanListings(row.data);
      const { error: updateErr } = await supabase
        .from('city_contents')
        .update({ data: cleanedDbData, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (updateErr) {
        console.error('❌ Supabase güncelleme hatası:', updateErr.message);
      } else {
        console.log('✅ Supabase city_contents (id: 1) veritabanı başarıyla temizlendi ve güncellendi!');
      }
    }
  } catch (err) {
    console.error('❌ Supabase işlemi başarısız:', err.message);
  }

  console.log('\n🎉 Tüm sahte ilanlar (özel ders, emlak, kayıp eşya, iş ilanları vb.) kalıcı olarak temizlendi!');
}

main().catch(err => {
  console.error('❌ Hata oluştu:', err);
  process.exit(1);
});
