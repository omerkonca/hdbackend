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

/** Google'ın tamamen kaldırdığı eski modeller */
const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-1.0-pro',
  'gemini-pro',
  'gemini-pro-vision',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
]);

let _discoveredGeminiModels = null;

async function discoverActiveGeminiModels(apiKey) {
  if (_discoveredGeminiModels && _discoveredGeminiModels.length > 0) {
    return _discoveredGeminiModels;
  }
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(listUrl, { timeout: 8000 });
    if (res.ok) {
      const data = await res.json();
      const models = data?.models
        ?.filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        ?.map((m) => m.name.replace('models/', ''))
        ?.filter((name) => !DEPRECATED_GEMINI_MODELS.has(name) && !name.includes('image') && !name.includes('tts') && !name.includes('robotics') && !name.includes('computer-use')) || [];
      if (models.length > 0) {
        _discoveredGeminiModels = models;
        return models;
      }
    }
  } catch (_) {}
  return [];
}

function geminiModelCandidates() {
  const preferred = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-2.5-pro',
  ];

  const primary = String(process.env.GEMINI_MODEL || '').trim();
  const ordered = [];
  const pushUnique = (m) => {
    const id = String(m || '').trim();
    if (!id || DEPRECATED_GEMINI_MODELS.has(id) || ordered.includes(id)) return;
    ordered.push(id);
  };

  if (primary && !DEPRECATED_GEMINI_MODELS.has(primary)) pushUnique(primary);
  for (const f of preferred) pushUnique(f);
  if (_discoveredGeminiModels) {
    for (const d of _discoveredGeminiModels) pushUnique(d);
  }
  return ordered.length ? ordered : ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
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

let _lastGeminiError = null;

async function generateWithGemini({ systemPrompt, userPrompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  let candidates = geminiModelCandidates();
  let lastError = null;

  for (let round = 0; round < 2; round++) {
    for (const model of candidates) {
      try {
        const res = await generateWithGeminiModel({ apiKey, model, systemPrompt, userPrompt });
        _lastGeminiError = null;
        return res;
      } catch (err) {
        lastError = err;
        _lastGeminiError = err.message;
        if (isGeminiQuotaError(err)) {
          console.warn(`[ai] ${model} kota/rate limit — sıradaki Gemini yedek modeline geçiliyor...`);
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        const gone = isGeminiModelGoneError(err);
        console.warn(
          `[ai] ${model} başarısız${gone ? ' (model kalkmış)' : ''}: ${err.message}`,
        );
      }
    }

    // İlk turda modeller başarısız olduysa Google API'den canlı modelleri keşfet
    if (round === 0) {
      const discovered = await discoverActiveGeminiModels(apiKey);
      const newModels = discovered.filter((m) => !candidates.includes(m));
      if (newModels.length > 0) {
        candidates = newModels;
        continue;
      }
    }
    break;
  }

  console.warn('[ai] Tüm Gemini modelleri başarısız oldu:', lastError?.message || 'bilinmeyen');
  if (lastError) {
    _lastGeminiError = lastError.message;
    if (!process.env.OPENAI_API_KEY) {
      throw lastError;
    }
  }
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
  getLastError: () => _lastGeminiError,
  getGeminiModelCandidates: geminiModelCandidates,
  DEPRECATED_GEMINI_MODELS: [...DEPRECATED_GEMINI_MODELS],
};
