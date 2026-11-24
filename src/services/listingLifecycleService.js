/**
 * Ücretli ilan yaşam döngüsü:
 *  - Süresi dolan ilanları (expiresAt) uygulamaya göndermez.
 *  - Admin yeni ilan yayınlayınca "listings_new" konusuna TOPLU ve SINIRLI bildirim gönderir.
 *  - Günde bir kez, 3 gün içinde süresi dolacak ilanları admine e-postayla bildirir.
 */
const fcmService = require('./fcmService');
const emailService = require('./emailService');

const TOPIC = 'listings_new';
const DEBOUNCE_MS = 3 * 60 * 1000; // son kayıttan 3 dk sonra tek bildirim
const DAILY_PUSH_CAP = 6;
const EXPIRY_WARN_DAYS = 3;

const KINDS = {
  realEstates: { label: 'emlak', single: 'Yeni emlak ilanı 🏠', route: 'screen:real_estate' },
  autoVehicles: { label: 'araç', single: 'Yeni araç ilanı 🚗', route: 'screen:auto_gallery' },
  jobListings: { label: 'iş', single: 'Yeni iş ilanı 💼', route: 'screen:job_listings' },
  handyman: { label: 'usta', single: 'Yeni usta eklendi 🔧', route: 'screen:handyman' },
};

function isExpired(item, now = Date.now()) {
  if (!item || !item.expiresAt) return false;
  const t = Date.parse(item.expiresAt);
  return Number.isFinite(t) && t < now;
}

function isLive(item, now = Date.now()) {
  return item && item.isActive !== false && !isExpired(item, now);
}

function getHandymanEntries(content) {
  const services = content?.explore?.cityServices || content?.cityServices || [];
  const svc = services.find((s) => s && (s.id === 'handyman' || s.id === 'ustalar'));
  return Array.isArray(svc?.directoryData) ? svc.directoryData : [];
}

/** Her ilan türü için { key -> item } haritası (yalnızca yayında olanlar). */
function collectLive(content) {
  const out = {};
  const explore = content?.explore || {};
  for (const kind of ['realEstates', 'autoVehicles', 'jobListings']) {
    const arr = Array.isArray(explore[kind]) ? explore[kind] : [];
    out[kind] = new Map(arr.filter((x) => isLive(x) && x.id).map((x) => [String(x.id), x]));
  }
  out.handyman = new Map(
    getHandymanEntries(content)
      .filter((x) => x && x.name)
      .map((x) => [`${x.name}|${String(x.phone || '').replace(/\D/g, '')}`, x]),
  );
  return out;
}

/** Yeni kayıtta öncekinde olmayan ilanları döndürür: [{ kind, item }]. */
function diffNewListings(oldContent, newContent) {
  const before = collectLive(oldContent || {});
  const after = collectLive(newContent || {});
  const beforeTotal = Object.values(before).reduce((n, m) => n + m.size, 0);
  const added = [];
  for (const [kind, map] of Object.entries(after)) {
    for (const [key, item] of map) {
      if (!before[kind].has(key)) added.push({ kind, item });
    }
  }
  // Eski içerik okunamadıysa (boş) her şeyi "yeni" sanıp toplu bildirim atma.
  if (beforeTotal === 0 && added.length > 5) return [];
  return added;
}

// ---- Toplu bildirim kuyruğu (bellek içi) ----
const pending = new Map();
let timer = null;
let dayKey = '';
let sentToday = 0;

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

function buildMessage(items) {
  if (items.length === 1) {
    const { kind, item } = items[0];
    const meta = KINDS[kind];
    const title = item.title || item.name || 'Yeni ilan';
    const price = item.price ? ` · ${item.price}${/₺|tl/i.test(String(item.price)) ? '' : ' ₺'}` : '';
    const body = kind === 'handyman'
      ? `${title} artık Ustalar listesinde.`
      : kind === 'jobListings'
        ? `${item.companyName ? `${item.companyName}: ` : ''}${title}`
        : `${title}${price}`;
    return { title: meta.single, body, route: meta.route };
  }
  const counts = {};
  for (const { kind } of items) counts[kind] = (counts[kind] || 0) + 1;
  const parts = Object.entries(counts).map(([kind, n]) => `${n} ${KINDS[kind].label}`);
  return {
    title: `Düziçi'de ${items.length} yeni ilan`,
    body: `${parts.join(', ')} ilanı eklendi. Göz atmak için dokun.`,
    route: 'screen:listings',
  };
}

async function flush() {
  timer = null;
  const items = [...pending.values()];
  pending.clear();
  if (!items.length) return;

  if (dayKey !== todayKey()) {
    dayKey = todayKey();
    sentToday = 0;
  }
  if (sentToday >= DAILY_PUSH_CAP) {
    console.log(`[listings] Günlük bildirim sınırı (${DAILY_PUSH_CAP}) doldu, ${items.length} ilan için push atlanıyor.`);
    return;
  }

  const msg = buildMessage(items);
  const result = await fcmService.sendToTopic(TOPIC, {
    title: msg.title,
    body: msg.body,
    data: { route: msg.route },
    collapseKey: 'listings_new',
  });
  if (result.success) {
    sentToday += 1;
    console.log(`[listings] "${msg.title}" bildirimi gönderildi (${items.length} ilan).`);
  } else {
    console.warn('[listings] Bildirim gönderilemedi:', result.error);
  }
}

/** Admin city-content kaydından sonra çağrılır. Hata fırlatmaz. */
function onCityContentSaved(oldContent, newContent) {
  try {
    const added = diffNewListings(oldContent, newContent);
    if (!added.length) return;
    for (const entry of added) {
      const key = `${entry.kind}:${entry.item.id || entry.item.name}`;
      pending.set(key, entry);
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      flush().catch((e) => console.warn('[listings] flush hatası:', e.message));
    }, DEBOUNCE_MS);
    if (typeof timer.unref === 'function') timer.unref();
  } catch (e) {
    console.warn('[listings] Yeni ilan tespiti başarısız:', e.message);
  }
}

/** Uygulamaya giden içerikten süresi dolmuş ilanları çıkarır. */
function filterExpiredListings(data) {
  if (!data || typeof data !== 'object') return data;
  const now = Date.now();
  const keys = ['realEstates', 'autoVehicles', 'autoGallery', 'jobListings', 'localProducts', 'privateTutors'];
  for (const target of [data, data.explore]) {
    if (!target || typeof target !== 'object') continue;
    for (const k of keys) {
      if (Array.isArray(target[k])) target[k] = target[k].filter((x) => !isExpired(x, now));
    }
  }
  return data;
}

/** EXPIRY_WARN_DAYS içinde süresi dolacak (henüz dolmamış) ilanlar. */
function findExpiringSoon(content, now = Date.now()) {
  const limit = now + EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000;
  const explore = content?.explore || {};
  const out = [];
  const labels = { realEstates: 'Emlak', autoVehicles: 'Araç', jobListings: 'İş İlanı' };
  for (const [kind, label] of Object.entries(labels)) {
    for (const item of Array.isArray(explore[kind]) ? explore[kind] : []) {
      if (!item || item.isActive === false || !item.expiresAt) continue;
      const t = Date.parse(item.expiresAt);
      if (Number.isFinite(t) && t >= now && t <= limit) {
        out.push({ kind: label, title: item.title || '-', contact: item.contact || item.whatsapp || '', seller: item.sellerName || item.companyName || '', expiresAt: item.expiresAt });
      }
    }
  }
  return out.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

let lastDigestDay = '';

async function runExpiryDigest(readContent) {
  const key = todayKey();
  if (lastDigestDay === key) return;
  const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false }));
  if (hour < 9) return; // sabah 09:00'dan sonra gönder
  lastDigestDay = key;
  try {
    const content = await readContent();
    const items = findExpiringSoon(content);
    if (!items.length) return;
    const r = await emailService.sendListingExpiryDigestEmail(items);
    if (!r?.ok) console.warn('[listings] Süre bitimi e-postası gönderilemedi:', r?.reason);
  } catch (e) {
    console.warn('[listings] Süre bitimi kontrolü başarısız:', e.message);
  }
}

function startExpiryDigestCron(readContent) {
  const tick = () => runExpiryDigest(readContent).catch(() => {});
  setTimeout(tick, 60 * 1000).unref?.();
  setInterval(tick, 60 * 60 * 1000).unref?.();
}

module.exports = {
  TOPIC,
  isExpired,
  diffNewListings,
  buildMessage,
  onCityContentSaved,
  filterExpiredListings,
  findExpiringSoon,
  startExpiryDigestCron,
};
