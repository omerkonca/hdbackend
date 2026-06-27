/**
 * Figma Sites landing'i backend/public köküne deploy eder.
 * Gizlilik / iletişim / kullanım koşulları linklerini hdbackend yollarına yönlendirir.
 *
 * Önce: node scripts/mirror-figma-site-full.mjs
 * Sonra: node scripts/deploy-figma-landing.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STAGING = path.resolve(__dirname, '../public/figma-landing-staging');
const PUBLIC = path.resolve(__dirname, '../public');

const COPY_DIRS = ['_runtimes', '_components', '_json', '_woff'];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const APP_STORE_URL =
  'https://apps.apple.com/tr/app/hepsi-d%C3%BCzi%C3%A7i/id6775205369?l=tr';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=net.hepsiduzici.hepsi_duzici';

function patchComponentJs(filePath) {
  let js = fs.readFileSync(filePath, 'utf8');

  js = js.replace(
    '{ href: "#", className: "hover:text-gray-400 transition-colors", children: "Gizlilik" }',
    '{ href: "/gizlilik-politikasi", className: "hover:text-gray-400 transition-colors", children: "Gizlilik" }',
  );
  js = js.replace(
    '{ href: "#", className: "hover:text-gray-400 transition-colors", children: "Koşullar" }',
    '{ href: "/kullanim-kosullari", className: "hover:text-gray-400 transition-colors", children: "Koşullar" }',
  );

  js = js.replace(
    `href: "#download",
                    className: "flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-[#090d18] transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-[#c8a200]/20",
                    style: { background: "#c8a200" },
                    children: [
                      /* @__PURE__ */ e(k, { size: 18 }),
                      "App Store'dan İndir"`,
    `href: "${APP_STORE_URL}",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-[#090d18] transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-[#c8a200]/20",
                    style: { background: "#c8a200" },
                    children: [
                      /* @__PURE__ */ e(k, { size: 18 }),
                      "App Store'dan İndir"`,
  );

  js = js.replace(
    `href: "#",
                      className: "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-[#090d18] text-lg transition-all hover:opacity-90 active:scale-95 shadow-xl shadow-[#c8a200]/25",
                      style: { background: "#c8a200" },
                      children: [
                        /* @__PURE__ */ e(k, { size: 22 }),
                        "App Store"`,
    `href: "${APP_STORE_URL}",
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-[#090d18] text-lg transition-all hover:opacity-90 active:scale-95 shadow-xl shadow-[#c8a200]/25",
                      style: { background: "#c8a200" },
                      children: [
                        /* @__PURE__ */ e(k, { size: 22 }),
                        "App Store"`,
  );

  js = js.replace(
    `href: "#",
                      className: "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-lg border transition-all hover:bg-white/5",
                      style: { borderColor: "rgba(255,255,255,0.20)" },
                      children: [
                        /* @__PURE__ */ e("svg", { viewBox: "0 0 24 24", className: "w-5 h-5 fill-white", children: /* @__PURE__ */ e("path", { d: "M3.18 23.76c.3.17.65.18.97.05l12.43-7.17-2.79-2.79L3.18 23.76zm16.6-10.34L17.2 12l2.58-1.42L5.65.41C5.33.24 4.98.25 4.68.41L16.96 12.73l2.82-2.82.01.01zM1.01 1.02C.39 1.36 0 2.01 0 2.77v18.46c0 .76.39 1.41 1.01 1.75l.08.04 10.34-10.33v-.24L1.09.98l-.08.04zM20.27 10.43l-3.31-1.9-2.84 2.84 2.84 2.85 3.32-1.92c.95-.55.95-1.32-.01-1.87z" }) }),
                        "Google Play"`,
    `href: "${PLAY_STORE_URL}",
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-lg border transition-all hover:bg-white/5",
                      style: { borderColor: "rgba(255,255,255,0.20)" },
                      children: [
                        /* @__PURE__ */ e("svg", { viewBox: "0 0 24 24", className: "w-5 h-5 fill-white", children: /* @__PURE__ */ e("path", { d: "M3.18 23.76c.3.17.65.18.97.05l12.43-7.17-2.79-2.79L3.18 23.76zm16.6-10.34L17.2 12l2.58-1.42L5.65.41C5.33.24 4.98.25 4.68.41L16.96 12.73l2.82-2.82.01.01zM1.01 1.02C.39 1.36 0 2.01 0 2.77v18.46c0 .76.39 1.41 1.01 1.75l.08.04 10.34-10.33v-.24L1.09.98l-.08.04zM20.27 10.43l-3.31-1.9-2.84 2.84 2.84 2.85 3.32-1.92c.95-.55.95-1.32-.01-1.87z" }) }),
                        "Google Play"`,
  );

  const oldCta = '/* @__PURE__ */ e("p", { className: "text-gray-600 text-xs mt-8", children: "iOS 15+ ve Android 9+ gerektirir · Gizlilik Politikası · Kullanım Koşulları" })';
  const newCta =
    '/* @__PURE__ */ a("p", { className: "text-gray-600 text-xs mt-8", children: ["iOS 15+ ve Android 9+ gerektirir · ", /* @__PURE__ */ e("a", { href: "/gizlilik-politikasi", className: "underline hover:text-gray-300", children: "Gizlilik Politikası" }), " · ", /* @__PURE__ */ e("a", { href: "/kullanim-kosullari", className: "underline hover:text-gray-300", children: "Kullanım Koşulları" }), " · ", /* @__PURE__ */ e("a", { href: "/iletisim", className: "underline hover:text-gray-300", children: "İletişim" })] })';

  if (!js.includes(oldCta)) {
    throw new Error('CTA footer snippet not found in component JS');
  }
  js = js.replace(oldCta, newCta);

  // Footer e-posta yanına iletişim sayfası (mailto kalır)
  js = js.replace(
    '/* @__PURE__ */ e("a", { href: "mailto:hepsiduzici@gmail.com", className: "hover:text-gray-400 transition-colors", children: "hepsiduzici@gmail.com" })',
    '/* @__PURE__ */ e("a", { href: "/iletisim", className: "hover:text-gray-400 transition-colors", children: "İletişim" })',
  );

  fs.writeFileSync(filePath, js, 'utf8');
}

function patchIndexHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace('<html lang="en">', '<html lang="tr">');
  html = html.replace(
    '<title id="title-jcntlw">Akıllı şehir uygulaması</title>',
    '<title id="title-jcntlw">Hepsi Düziçi | Akıllı Şehir Uygulaması</title>',
  );
  fs.writeFileSync(filePath, html, 'utf8');
}

function main() {
  if (!fs.existsSync(path.join(STAGING, 'index.html'))) {
    throw new Error('Staging bulunamadı. Önce mirror-figma-site-full.mjs çalıştırın.');
  }

  const legacy = path.join(PUBLIC, 'index-legacy.html');
  const currentIndex = path.join(PUBLIC, 'index.html');
  if (fs.existsSync(currentIndex) && !fs.existsSync(legacy)) {
    fs.copyFileSync(currentIndex, legacy);
    console.log('Yedek:', legacy);
  }

  for (const dir of COPY_DIRS) {
    const src = path.join(STAGING, dir);
    const dest = path.join(PUBLIC, dir);
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    copyDir(src, dest);
    console.log('Kopyalandı:', dir);
  }

  fs.copyFileSync(path.join(STAGING, 'index.html'), currentIndex);
  patchIndexHtml(currentIndex);

  const componentJs = path.join(
    PUBLIC,
    '_components/v2/66900067c3ae029b2fdfb5b594b0f14e3120ecf7.js',
  );
  patchComponentJs(componentJs);

  console.log('Landing deploy tamam. index.html + asset klasörleri güncellendi.');
  console.log('Korunan sayfalar: /gizlilik-politikasi, /iletisim, /kullanim-kosullari, /admin');
}

main();
