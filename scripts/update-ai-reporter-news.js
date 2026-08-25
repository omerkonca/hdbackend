const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://duehxbdlpwvbpqfjyjai.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching latest AI Reporter news items...');
  const { data: newsItems, error } = await supabase
    .from('news_items')
    .select('*')
    .ilike('id', 'news-ai-reporter%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching AI news:', error);
    return;
  }

  console.log(`Found ${newsItems.length} AI Reporter articles.`);

  const properTitle = "Düziçi'de Günün Özeti: İlçe Gündemi, Kesintiler ve Önemli Gelişmeler";
  const properSummary = "Düziçi'de bugün yaşanan yerel gelişmeler, Toroslar EDAŞ elektrik kesintileri, yarının hava durumu ve nöbetçi eczane bilgileriyle günün tüm özeti derlendi.";
  
  const properFullText = `Değerli Düziçililer, herkese huzurlu ve bereketli bir akşam dileriz. Bugün ilçemizde yerel yönetimden altyapıya, eğitimden asayişe kadar gün boyu yaşanan tüm gelişmeleri sizler için tek bir bültende derledik.

GÜNÜN ÖNE ÇIKAN YEREL GELİŞMELERİ
Düziçi genelinde gün boyunca esnaf ziyaretleri, sivil toplum buluşmaları ve mahalle muhtarlıklarıyla koordinasyon çalışmaları sürdürüldü. İlçemizde yerel basına yansıyan haberlerde, kamu kurumlarının kış hazırlıkları, ilçe kongre süreçleri ve tarımsal sulama birliklerinin faaliyetleri gündemin üst sıralarında yer aldı. Düziçi Belediyesi ekipleri ise ilçe merkezindeki çevre düzenleme ve temizlik çalışmalarına aralıksız devam etti.

ALTYAPI VE ELEKTRİK KESİNTİSİ DURUMU
Toroslar EDAŞ verilerine göre bugün ilçemiz genelinde bazı mahallelerde şebeke arızaları nedeniyle geçici elektrik kesintileri yaşandı. Ekiplerin arızalara müdahalesi sürerken, 25-30 Ağustos tarihleri arasında Yarbaşı, Ellek, Atalan ve merkez mahallelerde yapılacak planlı bakım ve trafo yenileme çalışmalarının takvimi duyuruldu. Vatandaşlarımızın kesinti saatlerine karşı tedbirli olmaları önemle hatırlatıldı.

HAVA DURUMU VE YARINA DAİR NOTLAR
İlçemizde bugün mevsim normallerinde seyreden hava sıcaklıklarının yarın da etkisini sürdürmesi bekleniyor. Yarın Düziçi'nde gündüz en yüksek sıcaklığın 34°C, gece ise 21°C civarında olması öngörülüyor. Gün ortasında sıcak hava nedeniyle özellikle yaşlı ve kronik rahatsızlığı olan vatandaşlarımızın dikkatli olmaları öneriliyor.

NÖBETÇİ ECZANE VE ŞEHİR REHBERİ
Bu gece ilçemizde sağlık ihtiyaçlarınız için Aydın Eczanesi (Yeşilova Mahallesi, Aydınlar Sokak No:40 - 7/24) nöbetçi olarak hizmet verecektir.

Tüm Düziçili hemşehrilerimize sağlıklı, huzurlu ve iyi bir akşam dileriz.`;

  for (const item of newsItems) {
    console.log(`Updating item ${item.id}: "${item.title}" -> "${properTitle}"`);
    const { error: updateError } = await supabase
      .from('news_items')
      .update({
        title: properTitle,
        summary: properSummary,
        full_text: properFullText,
        source_name: 'Hepsi Düziçi',
        category: 'Günün Özeti',
      })
      .eq('id', item.id);

    if (updateError) {
      console.error(`Update failed for ${item.id}:`, updateError.message);
    } else {
      console.log(`Successfully updated ${item.id}!`);
    }
  }

  console.log('All done!');
}

run();
