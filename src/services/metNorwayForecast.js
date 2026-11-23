/**
 * MET Norway (api.met.no) tahminini Open-Meteo yanıt biçimine çevirir.
 *
 * Open-Meteo, Render'ın paylaşılan IP'sinden sık sık 429 döndüğü için Çiftçi Paketi'nin
 * yedek kaynağıdır. Ücretsizdir, anahtar istemez; tek şartı uygulamayı tanıtan bir
 * User-Agent göndermektir. İlk ~60 saat saatlik, sonrası 6 saatlik adımlarla gelir:
 * 6 saatlik adımlar saatlere yayılır. Buharlaşma (ET0) Hargreaves formülüyle hesaplanır,
 * toprak sıcaklığı bu kaynakta yoktur (null).
 */
const { fetchWithTimeout } = require('../utils/helpers');

const USER_AGENT = 'HepsiDuzici/1.0 (+https://hdbackend-vo99.onrender.com)';
const TR_OFFSET_H = 3; // Türkiye yaz saati uygulamıyor: her zaman UTC+3

function symbolToWmo(symbol) {
  const s = String(symbol || '').replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 95;
  const map = {
    clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
    lightrain: 61, rain: 63, heavyrain: 65,
    lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
    lightsleet: 66, sleet: 67, heavysleet: 67,
    lightsleetshowers: 85, sleetshowers: 85, heavysleetshowers: 86,
    lightsnow: 71, snow: 73, heavysnow: 75,
    lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86,
  };
  return map[s] ?? 3;
}

/** Yerel (TR) saat dizgisi: "YYYY-MM-DDTHH:00". */
function localHour(isoUtc, plusHours = 0) {
  const d = new Date(isoUtc);
  d.setUTCHours(d.getUTCHours() + TR_OFFSET_H + plusHours);
  return d.toISOString().slice(0, 13) + ':00';
}

/** Hargreaves ET0 (mm/gün). */
function hargreavesEt0(dateStr, tmin, tmax, latDeg) {
  const doy = Math.floor((Date.parse(`${dateStr}T00:00:00Z`) - Date.parse(`${dateStr.slice(0, 4)}-01-01T00:00:00Z`)) / 86400000) + 1;
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  const ra = ((24 * 60) / Math.PI) * 0.082 * dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  const raMm = ra * 0.408;
  const tmean = (tmin + tmax) / 2;
  return Math.max(0, 0.0023 * raMm * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)));
}

async function fetchMetNorwayAsOpenMeteo(lat, lng) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lng}`;
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }, 15000);
  if (!res.ok) throw new Error(`MET Norway HTTP ${res.status}`);
  const json = await res.json();
  const series = json?.properties?.timeseries || [];
  if (!series.length) throw new Error('MET Norway boş yanıt');

  const hourly = {
    time: [], temperature_2m: [], precipitation: [], precipitation_probability: [],
    wind_speed_10m: [], wind_gusts_10m: [], weather_code: [], relative_humidity_2m: [], soil_temperature_6cm: [],
  };
  const push = (time, v) => {
    if (hourly.time.length && hourly.time[hourly.time.length - 1] >= time) return;
    hourly.time.push(time);
    for (const [k, val] of Object.entries(v)) hourly[k].push(val);
  };

  for (const step of series) {
    const inst = step.data?.instant?.details || {};
    const n1 = step.data?.next_1_hours;
    const n6 = step.data?.next_6_hours;
    const wind = (inst.wind_speed ?? 0) * 3.6;
    const gust = inst.wind_speed_of_gust != null ? inst.wind_speed_of_gust * 3.6 : wind * 1.5;
    const base = {
      temperature_2m: inst.air_temperature ?? null,
      wind_speed_10m: Math.round(wind * 10) / 10,
      wind_gusts_10m: Math.round(gust * 10) / 10,
      relative_humidity_2m: inst.relative_humidity ?? null,
      soil_temperature_6cm: null,
    };
    if (n1) {
      const p = n1.details?.precipitation_amount ?? 0;
      push(localHour(step.time), {
        ...base,
        precipitation: p,
        precipitation_probability: n1.details?.probability_of_precipitation ?? (p > 0.1 ? 70 : 10),
        weather_code: symbolToWmo(n1.summary?.symbol_code),
      });
    } else if (n6) {
      // 6 saatlik adımı saatlere yay (yağış eşit bölünür).
      const p = (n6.details?.precipitation_amount ?? 0) / 6;
      const code = symbolToWmo(n6.summary?.symbol_code);
      const prob = n6.details?.probability_of_precipitation ?? (p > 0.05 ? 70 : 10);
      for (let k = 0; k < 6; k++) {
        push(localHour(step.time, k), { ...base, precipitation: p, precipitation_probability: prob, weather_code: code });
      }
    }
  }

  // Günlük özet (yerel güne göre)
  const byDate = new Map();
  hourly.time.forEach((t, i) => {
    const date = t.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(i);
  });
  const daily = {
    time: [], temperature_2m_min: [], temperature_2m_max: [], precipitation_sum: [],
    precipitation_probability_max: [], wind_gusts_10m_max: [], weather_code: [],
    sunrise: [], sunset: [], et0_fao_evapotranspiration: [],
  };
  const severity = (c) => (c >= 95 ? 9 : c >= 80 ? 7 : c >= 71 ? 6 : c >= 61 ? 5 : c >= 51 ? 4 : c === 45 ? 2 : c);
  const firstDate = byDate.keys().next().value;
  for (const [date, idx] of byDate) {
    // Bugün kaç saati kalmış olursa olsun tutulur; yalnızca sondaki yarım gün atlanır.
    if ((idx.length < 4 && date !== firstDate) || daily.time.length >= 7) continue;
    const temps = idx.map((i) => hourly.temperature_2m[i]).filter((v) => v != null);
    const tmin = Math.min(...temps);
    const tmax = Math.max(...temps);
    const codes = idx.map((i) => hourly.weather_code[i]);
    daily.time.push(date);
    daily.temperature_2m_min.push(tmin);
    daily.temperature_2m_max.push(tmax);
    daily.precipitation_sum.push(Math.round(idx.reduce((s, i) => s + (hourly.precipitation[i] || 0), 0) * 10) / 10);
    daily.precipitation_probability_max.push(Math.max(...idx.map((i) => hourly.precipitation_probability[i] || 0)));
    daily.wind_gusts_10m_max.push(Math.max(...idx.map((i) => hourly.wind_gusts_10m[i] || 0)));
    daily.weather_code.push(codes.reduce((a, b) => (severity(b) > severity(a) ? b : a), codes[0]));
    daily.sunrise.push(null);
    daily.sunset.push(null);
    daily.et0_fao_evapotranspiration.push(Math.round(hargreavesEt0(date, tmin, tmax, lat) * 10) / 10);
  }

  const nowHour = localHour(new Date().toISOString());
  let ci = hourly.time.indexOf(nowHour);
  if (ci < 0) ci = 0;
  const current = {
    time: hourly.time[ci],
    temperature_2m: hourly.temperature_2m[ci],
    relative_humidity_2m: hourly.relative_humidity_2m[ci],
    wind_speed_10m: hourly.wind_speed_10m[ci],
    weather_code: hourly.weather_code[ci],
  };
  return { current, hourly, daily };
}

module.exports = { fetchMetNorwayAsOpenMeteo };
