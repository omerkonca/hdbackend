/**
 * Mirror a Figma Sites published URL into backend/public for self-hosting.
 * Usage: node scripts/mirror-figma-site-full.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://rake-gloss-51236258.figma.site';
const OUT = path.resolve(__dirname, '../public/figma-landing-staging');

const queue = new Set([BASE + '/']);
const done = new Set();

function localPath(url) {
  const u = new URL(url);
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  if (rel === '/index.html') rel = '/index.html';
  return path.join(OUT, rel);
}

function extractUrls(text, baseUrl) {
  const found = new Set();
  const patterns = [
    /\/(?:_runtimes|_components|_json|_woff|_assets|_videos)[^\s"'`)<>]*/g,
    /https:\/\/rake-gloss-51236258\.figma\.site[^\s"'`)<>]*/g,
  ];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      let p = m[0].split(/[\s'"`\\]/)[0];
      if (p.startsWith('http')) {
        found.add(p);
      } else {
        found.add(new URL(p, baseUrl).href);
      }
    }
  }
  return found;
}

async function fetchBinary(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HepsiDuzici-Mirror/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  return { buf, ct };
}

async function save(url) {
  if (done.has(url)) return;
  done.add(url);

  const dest = localPath(url);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  try {
    const { buf, ct } = await fetchBinary(url);
    fs.writeFileSync(dest, buf);
    console.log('OK', url, `(${buf.length}b)`);

    if (/\.(html|js|css|json|mjs)$/i.test(url) || ct.includes('javascript') || ct.includes('json') || ct.includes('html')) {
      const text = buf.toString('utf8');
      for (const next of extractUrls(text, url)) {
        if (!done.has(next)) queue.add(next);
      }
    }
  } catch (e) {
    console.warn('SKIP', url, e.message);
  }
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  while (queue.size) {
    const batch = [...queue];
    queue.clear();
    for (const url of batch) {
      await save(url);
    }
    if (done.size > 500) break;
  }

  console.log(`Done: ${done.size} files -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
