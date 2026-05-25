const BASE = 'https://www.duzici.bel.tr';

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'tr-TR' },
  });
  return res.text();
}

function strip(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function scan(path) {
  const html = await fetchHtml(BASE + path);
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const hits = [];
  let m;
  while ((m = re.exec(html))) {
    const t = strip(m[2]);
    if (t.length > 15 && t.length < 200) {
      hits.push({ t, url: m[1] });
    }
  }
  console.log('\n' + path, hits.length);
  hits.slice(0, 20).forEach((h) => console.log(' -', h.t.slice(0, 90), h.url.slice(0, 60)));
}

(async () => {
  await scan('/duyurular');
  await scan('/haberler');
})();
