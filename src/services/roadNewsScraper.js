const { getTagValue, stripHtml, slugify } = require('../utils/helpers');

const ROAD_KEYWORDS = [
  'trafik', 'yol', 'bulvar', 'cadde', 'kapalı', 'kapali', 'kapanış', 'kapanis',
  'güzergah', 'guzergah', 'asfalt', 'ulaşım', 'ulasim', 'komisyon', 'çalışma', 'calisma',
];

const RSS_FEEDS = [
  {
    name: 'Google News Düziçi Yol',
    url: 'https://news.google.com/rss/search?q=D%C3%BCzi%C3%A7i+(yol+OR+trafik+OR+kapal%C4%B1)+when%3A14d&hl=tr&gl=TR&ceid=TR:tr',
  },
  {
    name: 'Sabir Gazetesi Düziçi',
    url: 'https://www.sabirgazetesi.com/rss/duzici',
  },
];

const FETCH_OPTIONS = {
  headers: {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
  },
};

function isRoadRelated(text) {
  const t = text.toLowerCase();
  return ROAD_KEYWORDS.some((k) => t.includes(k));
}

function newsToClosure(item, sourceName) {
  const fp = `haber_${slugify(item.sourceUrl || item.title)}`;
  return {
    id: fp,
    fingerprint: fp,
    title: item.title.length > 80 ? `${item.title.slice(0, 77)}...` : item.title,
    subtitle: item.summary || item.title,
    status: inferStatus(item.title, item.summary),
    reason: `${sourceName} haberi`,
    roadCode: 'Düziçi',
    address: 'Düziçi, Osmaniye',
    lat: 37.0162,
    lng: 36.4542,
    alternativeRoute: 'Haber linkindeki güzergâh bilgisini kontrol edin.',
    severity: 'partial',
    startAt: item.createdAt ? item.createdAt.slice(0, 10) : null,
    endAt: null,
    source: sourceName,
    announcementUrl: item.sourceUrl,
    kind: 'news',
    autoManaged: true,
  };
}

function inferStatus(title, summary = '') {
  const t = `${title} ${summary}`.toLowerCase();
  if (/tamamland|açıld|acildi|açılış|acilis|sona erdi|trafiğe açıld/i.test(t)) return 'Tamamlandı';
  return 'Devam Ediyor';
}

class RoadNewsScraper {
  async fetchRoadRelatedNews({ max = 6 } = {}) {
    const out = [];
    for (const feed of RSS_FEEDS) {
      try {
        const res = await fetch(feed.url, FETCH_OPTIONS);
        if (!res.ok) continue;
        const xml = await res.text();
        const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const block of blocks) {
          const title = getTagValue(block, 'title');
          const link = getTagValue(block, 'link');
          const pubDate = getTagValue(block, 'pubDate');
          const desc = stripHtml(getTagValue(block, 'description'));
          if (!title || !link) continue;
          if (!isRoadRelated(`${title} ${desc}`)) continue;
          const item = {
            title,
            summary: desc || title,
            sourceUrl: link,
            createdAt: new Date(pubDate || Date.now()).toISOString(),
          };
          out.push(newsToClosure(item, feed.name));
          if (out.length >= max) return out;
        }
      } catch (err) {
        console.warn('[road-news]', feed.name, err.message);
      }
    }
    return out;
  }
}

module.exports = new RoadNewsScraper();
