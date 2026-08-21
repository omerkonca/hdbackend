const aiClient = require('./aiClient');
const supabase = require('../utils/supabaseClient');

/**
 * AI ile herhangi bir metni veya haberi BPT / Instagram gönderi formatına dönüştürür.
 */
async function aiFormatStory({ title, content, location = 'DÜZİÇİ' }) {
  const systemPrompt = `Sen Türkiye'nin en popüler haber ve sosyal medya hesaplarından biri olan BPT (Bir Parça Tuhaf) editörüsün.
Görevin: Verilen haberi veya metni Instagram 4:5 gönderi kartı için en vurucu, en çok etkileşim alacak BPT formatına dönüştürmek.

KURALLAR:
1. "headline": En fazla 1-2 satırlık, büyük harfle başlayan, tok, vurucu ve net bir ana başlık (Örn: "Düziçi'nde Karayolu Genişletme Çalışması Başladı:" veya "Başkan Aksoy:")
2. "quote": Haberin en kritik, merak uyandırıcı ve anlamlı cümlesi (1-2 cümle, tırnaksız ver). Haberin özünü anlatmalı.
3. "location": Haberin geçtiği yer. Düziçi ile ilgiliyse "DÜZİÇİ", Osmaniye ise "OSMANİYE", genel ise "TÜRKİYE".
4. "socialCaption": Instagram, WhatsApp ve X için hazır, emojili, 2-3 paragraflık tam paylaşım metni ve en altta hashtagler (#Düziçi #Osmaniye #HepsiDüziçi).
5. "suggestedTheme": Haberin havasına göre "gold", "night", "purple", "emerald", "ruby" değerlerinden biri.

Yanıtını kesinlikle sadece JSON formatında ver.`;

  const userPrompt = `Haber Başlığı: ${title || ''}
Haber İçeriği: ${content || ''}
Varsayılan Konum: ${location || 'DÜZİÇİ'}`;

  try {
    const aiResult = await aiClient.generateAiJson({
      systemPrompt,
      userPrompt,
    });

    if (aiResult && aiResult.headline) {
      return {
        ok: true,
        headline: aiResult.headline,
        quote: aiResult.quote,
        location: aiResult.location || location,
        socialCaption: aiResult.socialCaption || '',
        suggestedTheme: aiResult.suggestedTheme || 'night',
      };
    }
  } catch (err) {
    console.warn('[studioService] AI format hatası:', err.message);
  }

  // Fallback (AI çalışmazsa yerel kural bazlı çözüm)
  const cleanTitle = (title || '').trim();
  const cleanContent = (content || '').trim();
  const firstSentence = cleanContent.split(/[.!?]/)[0]?.trim() || cleanTitle;

  return {
    ok: true,
    headline: cleanTitle ? `${cleanTitle}:` : 'Düziçi Gündemi:',
    quote: firstSentence,
    location: location || 'DÜZİÇİ',
    socialCaption: `${cleanTitle}\n\n${cleanContent}\n\n✨ Detaylar Hepsi Düziçi Uygulamasında!\n#Düziçi #Osmaniye #HepsiDüziçi`,
    suggestedTheme: 'gold',
  };
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
