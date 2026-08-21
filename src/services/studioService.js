const aiClient = require('./aiClient');
const supabase = require('../utils/supabaseClient');

/**
 * Başlığı ve metni profesyonel BPT haber diline dönüştüren yerel akıllı motor.
 */
function smartLocalFormat(rawTitle, rawContent, location = 'DÜZİÇİ') {
  let text = `${rawTitle || ''} ${rawContent || ''}`.replace(/["'“”]+/g, ' ').replace(/\s+/g, ' ').trim();
  let upper = text.toUpperCase();

  let headline = 'Düziçi Gündemi:';
  let quote = 'Düziçi ve çevresindeki son gelişmeler yakından takip ediliyor.';
  let theme = 'night';
  let loc = location || 'DÜZİÇİ';

  if (upper.includes('ELLEK')) loc = 'ELLEK';
  else if (upper.includes('YARBAŞI')) loc = 'YARBAŞI';
  else if (upper.includes('OSMANİYE')) loc = 'OSMANİYE';
  else if (upper.includes('BÖCEKLİ')) loc = 'BÖCEKLİ';

  if (upper.includes('YANGIN') || upper.includes('ALEV')) {
    theme = 'ruby';
    headline = `${loc === 'DÜZİÇİ' ? "Düziçi'nde" : loc + "'te"} Yangın Paniği:`;
    quote = `${loc} bölgesinde aniden yükselen alevler çevrede kısa süreli paniğe neden olurken, itfaiye ve kurtarma ekipleri yangına hızla müdahale etti.`;
  } else if (upper.includes('KAZA') || upper.includes('TRAFİK')) {
    theme = 'ruby';
    headline = `${loc === 'DÜZİÇİ' ? "Düziçi'nde" : loc + "'te"} Trafik Kazası:`;
    quote = `${loc} mevkiinde meydana gelen trafik kazası sonrası olay yerine sağlık ve güvenlik ekipleri sevk edildi.`;
  } else if (upper.includes('DEPREM') || upper.includes('SARSINTI')) {
    theme = 'ruby';
    headline = `${loc === 'DÜZİÇİ' ? "Düziçi'nde" : loc + "'te"} Hissedilen Sarsıntı:`;
    quote = `Bölgede meydana gelen sarsıntı kısa süreli endişe yaratırken, yetkililerden saha tarama açıklaması bekleniyor.`;
  } else if (upper.includes('KESİNTİ') || upper.includes('SU KESİNTİ') || upper.includes('ELEKTRİK')) {
    theme = 'gold';
    headline = `${loc === 'DÜZİÇİ' ? "Düziçi'nde" : loc + "'te"} Planlı Kesinti Duyurusu:`;
    quote = `Bakım ve onarım çalışmaları kapsamında ilgili mahallelerde geçici süreyle hizmet kesintisi uygulanacağı bildirildi.`;
  } else if (upper.includes('YOL') || upper.includes('ASFALT') || upper.includes('GENİŞLETME') || upper.includes('PROJE')) {
    theme = 'gold';
    headline = `${loc === 'DÜZİÇİ' ? "Düziçi'nde" : loc + "'te"} Altyapı ve Yol Çalışması:`;
    quote = `Ulaşım kalitesini ve yol güvenliğini artırmak amacıyla bölgede başlatılan genişletme ve yenileme çalışmaları hız kesmeden sürüyor.`;
  } else if (upper.includes('BAŞKAN') || upper.includes('BELEDİYE') || upper.includes('ZİYARET')) {
    theme = 'gold';
    headline = `${loc} Belediyesi Saha İncelemesi:`;
    quote = `İlçede devam eden yatırımlar yerinde incelenerek vatandaşların talep ve beklentileri doğrultusunda adımlar atıldı.`;
  } else if (text.length > 5) {
    // Genel metin başlıklandırma
    const words = text.split(' ');
    const titleWords = words.slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    headline = titleWords.endsWith(':') ? titleWords : `${titleWords}:`;
    quote = text.charAt(0).toUpperCase() + text.slice(1);
    if (!quote.endsWith('.')) quote += '.';
  }

  return {
    ok: true,
    headline,
    quote,
    location: loc,
    socialCaption: `${headline.replace(':', '')} ✨\n\n${quote}\n\n📱 Detaylar Hepsi Düziçi Mobil Uygulamasında!\n#${loc} #Düziçi #Osmaniye #HepsiDüziçi #SonDakika`,
    suggestedTheme: theme,
  };
}

/**
 * AI ile herhangi bir metni veya haberi BPT / Instagram gönderi formatına dönüştürür.
 */
async function aiFormatStory({ title, content, location = 'DÜZİÇİ' }) {
  const systemPrompt = `Sen Türkiye'nin en popüler haber ve sosyal medya hesaplarından biri olan BPT (Bir Parça Tuhaf) baş editörüsün.
Görevin: Verilen karmaşık, kısa, ham veya uzun haberi/metni profesyonel bir BPT Instagram gönderi kartına dönüştürmek.

KURALLAR:
1. "headline": En fazla 1-2 satırlık, büyük harfle başlayan, tok, vurucu, sansasyonel olmayan ama merak uyandıran net bir ana başlık (Örn: "Düziçi Ellek'te Yangın Paniği:" veya "Başkan Aksoy:")
2. "quote": Haberin en kritik, akıcı ve anlamlı özeti (1-2 cümle, kesinlikle tırnaksız ver). Ham veya yetersiz metin verilmişse bile bunu haber diline uygun akıcı ve anlamlı bir cümleye genişlet.
3. "location": Haberin geçtiği yer ("DÜZİÇİ", "OSMANİYE", "YARBAŞI", "ELLEK", "TÜRKİYE").
4. "socialCaption": Instagram ve X için hazır, emojili, 2-3 paragraflık tam paylaşım metni ve en altta etiketler (#Düziçi #Osmaniye #HepsiDüziçi #SonDakika).
5. "suggestedTheme": Haberin konusuna göre ("ruby" -> yangın/kaza/acil, "gold" -> proje/başarı/resmi, "night" -> genel/gündem, "emerald" -> doğa/kültür, "purple" -> teknoloji/özel).

JSON Formatı:
{
  "headline": "...",
  "quote": "...",
  "location": "...",
  "socialCaption": "...",
  "suggestedTheme": "ruby|gold|night|emerald|purple"
}`;

  const userPrompt = `Gelen Ham Veri:
Başlık: ${title || ''}
İçerik: ${content || ''}
Varsayılan Konum: ${location || 'DÜZİÇİ'}`;

  try {
    const aiResult = await aiClient.generateJson({
      systemPrompt,
      userPrompt,
    });

    const parsed = aiResult?.data;
    if (parsed && (parsed.headline || parsed.quote)) {
      const cleanHeadline = String(parsed.headline || '').replace(/^["'“”]+|["'“”]+$/g, '').trim();
      const cleanQuote = String(parsed.quote || '').replace(/^["'“”]+|["'“”]+$/g, '').trim();

      return {
        ok: true,
        headline: cleanHeadline.endsWith(':') ? cleanHeadline : `${cleanHeadline}:`,
        quote: cleanQuote,
        location: (parsed.location || location || 'DÜZİÇİ').toUpperCase(),
        socialCaption: parsed.socialCaption || '',
        suggestedTheme: parsed.suggestedTheme || 'night',
      };
    }
  } catch (err) {
    console.warn('[studioService] AI format hatası (yerel akıllı motora geçiliyor):', err.message);
  }

  // Akıllı Yerel Dönüştürücü Fallback
  return smartLocalFormat(title, content, location);
}

/**
 * Son eklenen haberleri stüdyo için listeler.
 */
async function getRecentNews(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, summary, content, image_url, source_url, created_at, category')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('[studioService] getRecentNews hatası:', err.message);
    return [];
  }
}

module.exports = {
  aiFormatStory,
  getRecentNews,
};
