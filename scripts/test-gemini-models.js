require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fetch = require('node-fetch');

const models = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log('GEMINI_API_KEY missing');
    process.exit(1);
  }
  console.log('GEMINI_MODEL env:', process.env.GEMINI_MODEL || '(unset)');
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return JSON: {"ok":true}' }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      const text = await res.text();
      console.log(`${model}: ${res.status} ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
    } catch (e) {
      console.log(`${model}: ERR ${e.message}`);
    }
  }
}

main();
