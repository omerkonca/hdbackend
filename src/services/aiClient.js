const fetch = require('node-fetch');

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/** Google'ın tamamen kaldırdığı eski v1 modeller */
const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-1.0-pro',
  'gemini-pro',
  'gemini-pro-vision',
]);

function geminiModelCandidates() {
  const primary = String(process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const fallbacks = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'];
  const ordered = [];
  const pushUnique = (m) => {
    const id = String(m || '').trim();
    if (!id || DEPRECATED_GEMINI_MODELS.has(id) || ordered.includes(id)) return;
    ordered.push(id);
  };
  pushUnique(primary);
  for (const f of fallbacks) pushUnique(f);
  return ordered.length ? ordered : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
}

function isGeminiModelGoneError(err) {
  const msg = String(err?.message || err || '');
  return (
    /no longer available/i.test(msg) ||
    (/404/.test(msg) && /models\//i.test(msg)) ||
    /NOT_FOUND/i.test(msg)
  );
}

function isGeminiQuotaError(err) {
  const msg = String(err?.message || err || '');
  return /429/.test(msg) || /quota/i.test(msg) || /rate.?limit/i.test(msg) || /RESOURCE_EXHAUSTED/i.test(msg);
}

async function generateWithGeminiModel({ apiKey, model, systemPrompt, userPrompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${model} ${res.status}: ${errText.slice(0, 280)}`);
  }

  const data = await res.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini ${model} güvenlik filtresi: ${blockReason}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text.trim()) {
    throw new Error(
      `Gemini ${model} boş yanıt döndü` +
        (finishReason ? ` (finishReason=${finishReason})` : ''),
    );
  }
  return { text, model: `gemini:${model}` };
}

async function generateWithGemini({ systemPrompt, userPrompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  let lastError = null;
  for (const model of geminiModelCandidates()) {
    try {
      return await generateWithGeminiModel({ apiKey, model, systemPrompt, userPrompt });
    } catch (err) {
      lastError = err;
      if (isGeminiQuotaError(err)) {
        console.warn(`[ai] ${model} kota/rate limit — sıradaki Gemini yedek modeline geçiliyor...`);
        // Kısa bir bekleme vererek burst rate-limit'e takılmayı önle
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      const gone = isGeminiModelGoneError(err);
      console.warn(
        `[ai] ${model} başarısız${gone ? ' (model kalkmış)' : ''}: ${err.message}`,
      );
    }
  }
  console.warn('[ai] Tüm Gemini modelleri başarısız oldu:', lastError?.message || 'bilinmeyen');
  return null;
}

async function generateWithOpenAI({ systemPrompt, userPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 280)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return { text, model: `openai:${model}` };
}

async function generateJson({ systemPrompt, userPrompt }) {
  const providers = [generateWithGemini, generateWithOpenAI];
  let lastError = null;

  for (const provider of providers) {
    try {
      const result = await provider({ systemPrompt, userPrompt });
      if (!result) continue;
      const parsed = extractJsonObject(result.text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI yanıtı geçerli JSON değil');
      }
      return { data: parsed, model: result.model };
    } catch (err) {
      lastError = err;
      console.warn(`[ai] provider failed: ${err.message}`);
    }
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('GEMINI_API_KEY veya OPENAI_API_KEY tanımlı değil');
  }
  if (lastError && isGeminiQuotaError(lastError) && !process.env.OPENAI_API_KEY) {
    throw new Error(
      'Gemini API kotası doldu. Render ortamına OPENAI_API_KEY ekleyin veya Google AI kotasını yükseltin.',
    );
  }
  throw lastError || new Error('AI üretimi başarısız');
}

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

module.exports = {
  generateJson,
  isConfigured,
  getGeminiModelCandidates: geminiModelCandidates,
  DEPRECATED_GEMINI_MODELS: [...DEPRECATED_GEMINI_MODELS],
};
