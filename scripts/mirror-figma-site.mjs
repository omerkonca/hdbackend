import scrape from 'website-scraper';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/figma-landing-staging');

const base = 'https://rake-gloss-51236258.figma.site';

await scrape({
  urls: [base + '/'],
  directory: outDir,
  sources: [
    { selector: 'img', attr: 'src' },
    { selector: 'link[rel="stylesheet"]', attr: 'href' },
    { selector: 'script', attr: 'src' },
    { selector: 'link[rel="preload"]', attr: 'href' },
  ],
  urlFilter: (url) => {
    try {
      const u = new URL(url);
      return u.hostname === 'rake-gloss-51236258.figma.site';
    } catch {
      return false;
    }
  },
  recursive: true,
  maxDepth: 8,
  request: {
    headers: { 'User-Agent': 'HepsiDuzici-Mirror/1.0' },
  },
});

console.log('Mirrored to', outDir);
