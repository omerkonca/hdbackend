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
