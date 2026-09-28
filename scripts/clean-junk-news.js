const { getDbPool } = require('../src/utils/dbPool');
const { normalizeForCompare } = require('../src/utils/helpers');
require('dotenv').config();

function isJunkContent(title = '', summary = '') {
  const raw = `${title || ''} ${summary || ''}`;
  const text = normalizeForCompare(raw);

  // 1. Yemek, hamur işi, tatlı, turşu, konserve, pasta, börek tarifleri ve mutfak spam'i
  const hasFoodContext =
    /\b(hamur|hamuru|hamur isi|tatli|borek|corek|kek|pasta|kurabiye|corba|yemek|kofte|tursu|konserve|salata|recel|menemen|kahvalti|lezzet|puf noktasi|puf noktalari|pisir|firin|tava|tencere|kislik|sofra|biber|fasulye|domates|patates|tavuk|sarma|baklava|mihlama|kombe|kahve|ikram)\b/.test(
      text,
    );

  const hasRecipePattern =
    /\b(tarif|tarifi|tarifler|tarifleri|pratik tarif|lezzetli tarif|enfes tarif|nefis tarif|kolay tarif|citir tarif)\b/.test(
      text,
    );

  if (hasFoodContext && hasRecipePattern && !/\b(kamera|yapay zeka|algoritma|yazilim)\b/.test(text)) {
    return true;
  }

  if (
    /\b(hamur|hamuru|hamur isi|ev baklavasi|biskuvi pasta|irmikli borek|ispanakli kis|kapya biber konservesi|tursu hazirlayacaklara|sarma sevenlere|sogan tursusu|el acmasi|havuc toplari|et kofte|kislik menemen|ev yapimi menemen|kislik hazirlik.*konserve)\b/.test(
      text,
    )
  ) {
    return true;
  }

  if (
    /\b(kahvalti sofralarina|sofralara yakisacak|sofralari senlendiren|cay saatlerinin vazgecilmezi|cay saatine|cayin yanina \d+ malzemeli|sofralarin klasigi|ne ikram edilir)\b/.test(
      text,
    )
  ) {
    return true;
  }

  if (
    /\b(nasil pisirilir|yapmanin puf noktalari|dagilmayan sarmanin|taze fasulye kislik nasil|kislik domates boyle|kislik saksuka boyle|cayi yeniden isitmak|kavruluyor)\b/.test(
      text,
    )
  ) {
    return true;
  }

  // 2. Aktüel market indirim / katalog spam'i (A101, BİM, ŞOK, Migros vb.)
  if (
    /\b(a101|bim|sok|migros)\b.*\b(aktuel|katalog|katalogu|indirim|raflarda|raflarina|kacta kapaniyor|kacta aciliyor|urunleri belli oldu|urunleri neler)\b/.test(
      text,
    ) ||
    /\b(aktuel urunler|aktuel urunleri|aktuel katalogu|indirimli urunler|aktuel raflarda)\b/.test(
      text,
    )
  ) {
    return true;
  }

  // 3. Bitkisel kür / vitamin / şifalı ot / gıda ve sağlık clickbait'i
  if (
    /\b(biotin|avokado yagi|sari kantaron|kantaron yagi|biberiye hangi etlerle|toz zencefil|taze mi toz zencefil|lor peyniri tuketenler|ahududu tuketenler|cay tuketenleri ilgilendiriyor|kekik cayi faydalari|ihlamur cayi faydalari|kalsiyumun faydalari|soguk sikim zeytinyagi nedir)\b/.test(
      text,
    ) ||
    /\b(ne ise yarar|faydalari ve riskleri|faydalari ve zararlari|neye iyi gelir|faydalari nelerdir|faydalari neler|zararli mi|zararlari neler|bagisiklik zayifligina dikkat)\b/.test(
      text,
    )
  ) {
    return true;
  }

  // 4. Ev temizliği, leke çıkarma ve dekorasyon clickbait'i
  if (
    /\b(halidan yag lekesi|leke nasil cikar|yesil koltukla hangi hali|koltukla hangi hali|evde temizlik yapanlara|limonlari degerlendirmenin pratik)\b/.test(
      text,
    )
  ) {
    return true;
  }

  // 5. Astroloji, burç, tarot, fal
  if (
    /\b(burc|burclar|burclari|astroloji|tarot|fal|yukselen burc|gunluk burc|dolunay etkisi|yeniay)\b/.test(
      text,
    )
  ) {
    return true;
  }

  // 6. Test, anket, ucuz magazin clickbait
  if (
    /\b(testi coz|senin para yonetim|hangi karakter|testini coz|bikinili|bikini|dekolte|frikik|pisti|ifsa|aldatti)\b/.test(
      text,
    )
  ) {
    return true;
  }

  // 7. Sahte yerelleştirilmiş ulusal SEO spam'i (iPhone satışta mı, saatler geri alınacak mı, banka promosyonu)
  if (
    /\b(iphone \d+ satisa cikti|saatler geri alinacak mi|akbank promosyonu \d+|en ucuz isinma hangisi|butun kedileri.*nereyi secerdi)\b/.test(
      text,
    )
  ) {
    return true;
  }

  // 8. Boş clickbait soru kalıpları
  if (
    /\b(oyle bir sey yapti ki|agizlari acik birakti|gorenler inanamadi|bakin kime ne dedi|bakin ne oldu|saskina cevirdi)\b/.test(
      text,
    )
  ) {
    return true;
  }

  return false;
}

async function cleanJunkFromDb() {
  const pool = getDbPool();
  if (!pool) {
    console.error('No database pool available.');
    process.exit(1);
  }

  const res = await pool.query('SELECT id, title, summary, category, source_name FROM news_items');
  console.log(`Analyzing ${res.rows.length} total news items in DB...`);

  const junkIds = [];
  for (const r of res.rows) {
    if (isJunkContent(r.title, r.summary)) {
      junkIds.push(r.id);
      console.log(`[DELETE CANDIDATE] [${r.category}] [${r.source_name}] ${r.title}`);
    }
  }

  console.log(`\nFound ${junkIds.length} junk news items to delete.`);

  if (junkIds.length > 0) {
    const delRes = await pool.query('DELETE FROM news_items WHERE id = ANY($1::text[])', [junkIds]);
    console.log(`✅ Successfully deleted ${delRes.rowCount} junk news items from PostgreSQL.`);

    try {
      const { requireSupabaseAdmin } = require('../src/utils/supabaseAdmin');
      const db = requireSupabaseAdmin();
      const { error } = await db.from('news_items').delete().in('id', junkIds);
      if (error) {
        console.warn('⚠️ Supabase admin delete error:', error.message);
      } else {
        console.log('✅ Successfully deleted junk news items from Supabase as well.');
      }
    } catch (sbErr) {
      console.warn('⚠️ Supabase sync deletion skipped:', sbErr.message);
    }
  }

  process.exit(0);
}

cleanJunkFromDb().catch((err) => {
  console.error('❌ Error during cleanup:', err);
  process.exit(1);
});
