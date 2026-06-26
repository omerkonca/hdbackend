const supabase = require('../utils/supabaseClient');
const { requireSupabaseAdmin } = require('../utils/supabaseAdmin');
const newsService = require('./newsService');
const aiClient = require('./aiClient');
const { normalizeForCompare } = require('../utils/helpers');

const SCHEDULE_HOUR_TR = Number(process.env.DAILY_BRIEFING_HOUR_TR || 20);
const TZ = 'Europe/Istanbul';

function turkeyDateParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function turkeyCalendarDayKey(date) {
  return turkeyDateParts(new Date(date)).date;
}

function calendarDaysBetween(olderKey, newerKey) {
  const older = new Date(`${olderKey}T12:00:00Z`).getTime();
  const newer = new Date(`${newerKey}T12:00:00Z`).getTime();
  return Math.round((newer - older) / (24 * 60 * 60 * 1000));
}

function needsEveningRegeneration(existing, tr) {
  if (!existing) return true;
  if (existing.briefing_date !== tr.date) return false;

  const genTr = turkeyDateParts(new Date(existing.generated_at));
  if (genTr.date < tr.date) return true;
  if (genTr.date === tr.date && genTr.hour < SCHEDULE_HOUR_TR && tr.hour >= SCHEDULE_HOUR_TR) {
    return true;
  }
  return false;
}

function isDuziciNews(item) {
  const category = String(item.category || '').toLowerCase();
  if (category.includes('duzici') || category.includes('düziçi')) return true;
  const text = normalizeForCompare(`${item.title || ''} ${item.summary || ''}`);
  return /duzici|yarbasi|ellek|atalan|duldul/.test(text);
}

function formatNewsLine(item, index) {
  const when = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 16) : '';
  const summary = String(item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  return `${index + 1}. [${when}] ${item.title}${summary ? ` — ${summary}` : ''} (${item.sourceName || 'kaynak'})`;
}

class DailyBriefingService {
  constructor() {
    this._generating = false;
    this._lastAttemptDate = null;
    this._readCache = { trDate: null, row: null };
  }

  _setReadCache(row) {
    this._readCache = { trDate: turkeyDateParts().date, row: row || null };
  }

  async getLatestBriefing() {
    const tr = turkeyDateParts();
    if (
      this._readCache.trDate === tr.date &&
      this._readCache.row &&
      !needsEveningRegeneration(this._readCache.row, tr)
    ) {
      return this._readCache.row;
    }

    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('daily_news_briefings')
      .select('*')
      .order('briefing_date', { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);
    const row = data?.[0] || null;
    this._setReadCache(row);
    return row;
  }

  async getBriefingByDate(briefingDate) {
    const tr = turkeyDateParts();
    if (
      this._readCache.trDate === tr.date &&
      this._readCache.row?.briefing_date === briefingDate &&
      !needsEveningRegeneration(this._readCache.row, tr)
    ) {
      return this._readCache.row;
    }

    const db = requireSupabaseAdmin();
    const { data, error } = await db
      .from('daily_news_briefings')
      .select('*')
      .eq('briefing_date', briefingDate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = data || null;
    if (row && briefingDate === tr.date) {
      this._setReadCache(row);
    }
    return row;
  }

  async collectDuziciNews({ forceRefresh = false, briefingDate } = {}) {
    let items = [];
    try {
      items = await newsService.getNews({ forceRefresh, max: 200 });
    } catch (_) {
      const { data } = await supabase
        .from('news_items')
        .select('id, title, summary, created_at, source_name, category')
        .order('created_at', { ascending: false })
        .limit(200);
      items = (data || []).map((row) => ({
        title: row.title,
        summary: row.summary,
        createdAt: row.created_at,
        sourceName: row.source_name,
        category: row.category,
      }));
    }

    const duzici = items.filter(isDuziciNews);
    const tr = turkeyDateParts();
    const todayKey = briefingDate || tr.date;

    const todayNews = duzici.filter((item) => turkeyCalendarDayKey(item.createdAt) === todayKey);

    const weekNews = duzici.filter((item) => {
      const itemKey = turkeyCalendarDayKey(item.createdAt);
      const diff = calendarDaysBetween(itemKey, todayKey);
      return diff >= 0 && diff <= 6;
    });

    return { todayNews, weekNews };
  }

  buildPrompt({ briefingDate, todayNews, weekNews }) {
    const todayLines = todayNews.slice(0, 40).map(formatNewsLine).join('\n');
    const weekLines = weekNews.slice(0, 80).map(formatNewsLine).join('\n');

    return `Tarih: ${briefingDate}
Konum: Düziçi / Osmaniye

BUGÜNÜN HABERLERİ (${todayNews.length} kayıt):
${todayLines || '(bugün Düziçi ile ilgili kayıtlı haber yok)'}

BU HAFTANIN HABERLERİ (${weekNews.length} kayıt):
${weekLines || '(bu hafta Düziçi ile ilgili kayıtlı haber yok)'}

GÖREV TALİMATLARI:
1. Haber özetlerini doğrudan ve akıcı bir anlatımla yaz. Cümleler birbirine mantıklı bir şekilde bağlansın.
2. KRİTİK KURAL: Asla "Bugün Düziçi'nde hareketli bir gün yaşandı" veya "Bu hafta Düziçi'nde çeşitli etkinlikler gerçekleştirildi" gibi yapay zeka jenerik/dolgu giriş cümleleri kullanma! Doğrudan günün en önemli, somut olayına değinerek başla (Örn: "Karne şenliğinde itfaiyenin su sürpriziyle serinleyen Düziçili çocuklar eğlenceli anlar yaşadı.").
3. today_title: Günün en önemli olayını yansıtan, merak uyandırıcı, profesyonel bir gazete manşeti başlığı (en fazla 70 karakter). Başlıkta jenerik kelimelerden kaçın.
4. today_summary: Bugünün gelişmelerini özetleyen samimi, net ve bilgi dolu 2-4 cümle.
5. week_summary: Haftalık gelişmeleri toparlayan, olaylar arası bağlantı kuran 3-5 cümle.
6. highlights: Öne çıkan en önemli 3 farklı somut gelişmeyi özetleyen kısa cümleler dizisi (her biri en fazla 85 karakter). Bullet listesinde jenerik ifadeler kullanma, net bilgi ver.
7. Değerlerin hiçbirinde markdown biçimlendirmesi (kalın yazı, eğik yazı vb.) veya HTML kullanma.

JSON FORMATI:
{
  "today_title": "...",
  "today_summary": "...",
  "week_summary": "...",
  "highlights": [
    "...",
    "...",
    "..."
  ]
}`;
  }

  async generateBriefing({ force = false, briefingDate } = {}) {
    const tr = turkeyDateParts();
    const targetDate = briefingDate || tr.date;

    if (!force) {
      const existing = await this.getBriefingByDate(targetDate);
      if (existing) return existing;
    }

    if (!aiClient.isConfigured()) {
      throw new Error('AI anahtarı yapılandırılmamış (GEMINI_API_KEY veya OPENAI_API_KEY)');
    }

    const { todayNews, weekNews } = await this.collectDuziciNews({
      forceRefresh: force,
      briefingDate: targetDate,
    });
    const systemPrompt =
      'Sen Düziçi ve Osmaniye bölgesinde yayın yapan, son derece profesyonel, samimi ve güvenilir bir yerel haber baş editörüsün. ' +
      'Görevin, günlük haberleri analiz ederek Düziçi halkına anlaşılır, akıcı ve ilgi çekici özetler hazırlamaktır. ' +
      'Sadece verilen haber kaynaklarına dayanmalı, asla bilgi uydurmamalı, spekülasyon veya kişisel yorum eklememelisin. ' +
      'Yanıtın yalnızca geçerli bir JSON objesi olmalıdır.';

    const userPrompt = this.buildPrompt({
      briefingDate: targetDate,
      todayNews,
      weekNews,
    });

    const { data, model } = await aiClient.generateJson({ systemPrompt, userPrompt });

    const row = {
      briefing_date: targetDate,
      today_title: String(data.today_title || 'Düziçi gün özeti').slice(0, 120),
      today_summary: String(data.today_summary || '').trim(),
      week_summary: String(data.week_summary || '').trim(),
      highlights: Array.isArray(data.highlights)
        ? data.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 6)
        : [],
      source_news_count: todayNews.length,
      model,
      generated_at: new Date().toISOString(),
    };

    const db = requireSupabaseAdmin();
    const { data: saved, error } = await db
      .from('daily_news_briefings')
      .upsert(row, { onConflict: 'briefing_date' })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    console.log(`[daily-briefing] ${targetDate} özeti kaydedildi (${todayNews.length} bugünkü haber, model: ${model})`);
    this._setReadCache(saved);
    return saved;
  }

  async generateIfDue({ force = false } = {}) {
    const tr = turkeyDateParts();

    if (!force) {
      if (tr.hour < SCHEDULE_HOUR_TR) return null;

      const existing = await this.getBriefingByDate(tr.date);
      if (existing && !needsEveningRegeneration(existing, tr)) {
        return existing;
      }
    }

    if (this._generating) return null;
    this._generating = true;

    try {
      this._readCache = { trDate: null, row: null };
      return await this.generateBriefing({ force: true, briefingDate: tr.date });
    } finally {
      this._generating = false;
    }
  }
}

module.exports = new DailyBriefingService();
