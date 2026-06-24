const supabase = require('../utils/supabaseClient');
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
  }

  async getLatestBriefing() {
    const { data, error } = await supabase
      .from('daily_news_briefings')
      .select('*')
      .order('briefing_date', { ascending: false })
      .limit(1);

    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  async getBriefingByDate(briefingDate) {
    const { data, error } = await supabase
      .from('daily_news_briefings')
      .select('*')
      .eq('briefing_date', briefingDate)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async collectDuziciNews() {
    let items = [];
    try {
      items = await newsService.getNews({ forceRefresh: false, max: 200 });
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
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const todayNews = duzici.filter((item) => {
      const ts = new Date(item.createdAt).getTime();
      return Number.isFinite(ts) && now - ts <= dayMs;
    });

    const weekNews = duzici.filter((item) => {
      const ts = new Date(item.createdAt).getTime();
      return Number.isFinite(ts) && now - ts <= 7 * dayMs;
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

Görev:
- Sadece verilen haber listesine dayan; uydurma.
- Düziçi sakinlerine samimi, net ve kısa Türkçe özet yaz.
- today_title: tek satır çarpıcı başlık (max 60 karakter)
- today_summary: bugün Düziçi'de ne oldu (2-4 cümle)
- week_summary: bu haftanın özeti (3-5 cümle)
- highlights: en önemli 3 madde (kısa string dizisi)

JSON formatı:
{
  "today_title": "...",
  "today_summary": "...",
  "week_summary": "...",
  "highlights": ["...", "...", "..."]
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

    const { todayNews, weekNews } = await this.collectDuziciNews();
    const systemPrompt =
      'Sen Düziçi yerel haber editörüsün. Yalnızca verilen haber listesinden özet çıkarırsın. ' +
      'Spekülasyon yapmaz, kişisel görüş eklemezsin. Yanıtın yalnızca geçerli JSON olmalı.';

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

    const { data: saved, error } = await supabase
      .from('daily_news_briefings')
      .upsert(row, { onConflict: 'briefing_date' })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    console.log(`[daily-briefing] ${targetDate} özeti kaydedildi (${todayNews.length} bugünkü haber, model: ${model})`);
    return saved;
  }

  async generateIfDue({ force = false } = {}) {
    const tr = turkeyDateParts();

    if (!force) {
      if (tr.hour < SCHEDULE_HOUR_TR) return null;
      if (this._lastAttemptDate === tr.date) return null;

      const existing = await this.getBriefingByDate(tr.date);
      if (existing) {
        this._lastAttemptDate = tr.date;
        return existing;
      }
    }

    if (this._generating) return null;
    this._generating = true;
    this._lastAttemptDate = tr.date;

    try {
      return await this.generateBriefing({ force, briefingDate: tr.date });
    } finally {
      this._generating = false;
    }
  }

  /** Bugünkü özet yoksa üretir (saat kısıtı yok — deploy / ilk açılış için). */
  async ensureTodayBriefing() {
    const tr = turkeyDateParts();
    const existing = await this.getBriefingByDate(tr.date);
    if (existing) return existing;
    if (!aiClient.isConfigured()) {
      console.warn('[daily-briefing] AI anahtarı yok, özet üretilemedi.');
      return null;
    }
    if (this._generating) return null;
    return this.generateBriefing({ force: false, briefingDate: tr.date });
  }
}

module.exports = new DailyBriefingService();
