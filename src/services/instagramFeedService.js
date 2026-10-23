const CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, payload: null };

function mapItem(raw) {
  const children = [];
  if (raw.children && Array.isArray(raw.children.data)) {
    for (const child of raw.children.data) {
      const url = child.media_url || child.thumbnail_url || '';
      if (url) children.push(url);
    }
  }

  let mediaUrl = String(raw.media_url || '');
  let thumbnailUrl = String(raw.thumbnail_url || '');

  // If carousel has no top-level media_url, fallback to first child
  if (!mediaUrl && children.length > 0) {
    mediaUrl = children[0];
  }

  // Never assign an MP4 video url to thumbnailUrl
  const isVideoMedia = String(raw.media_type || '').toUpperCase() === 'VIDEO';
  if (!thumbnailUrl) {
    if (!isVideoMedia && mediaUrl) {
      thumbnailUrl = mediaUrl;
    } else if (children.length > 0 && !children[0].includes('.mp4')) {
      thumbnailUrl = children[0];
    }
  }

  return {
    id: String(raw.id || ''),
    caption: String(raw.caption || ''),
    mediaType: String(raw.media_type || ''),
    productType: String(raw.media_product_type || ''),
    mediaUrl,
    thumbnailUrl,
    permalink: String(raw.permalink || ''),
    timestamp: raw.timestamp || null,
    carouselUrls: children,
  };
}

function isReel(item) {
  return item.productType === 'REELS' || (item.mediaType === 'VIDEO' && item.productType !== 'FEED');
}

class InstagramFeedService {
  async getFeed() {
    const token = String(process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
    if (!token) {
      return { ok: true, configured: false, stories: [], posts: [], reels: [] };
    }
    if (cache.payload && Date.now() - cache.at < CACHE_MS) {
      return cache.payload;
    }

    const user = String(process.env.INSTAGRAM_USER_ID || 'me').trim() || 'me';
    const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}';
    const headers = { Authorization: `Bearer ${token}` };

    const [mediaRes, storyRes] = await Promise.all([
      fetch(`https://graph.instagram.com/${user}/media?fields=${fields}&limit=40`, { headers }),
      fetch(`https://graph.instagram.com/${user}/stories?fields=${fields}`, { headers }),
    ]);

    if (!mediaRes.ok) {
      const detail = await mediaRes.text();
      throw new Error(`Instagram media ${mediaRes.status}: ${detail.slice(0, 180)}`);
    }

    const mediaJson = await mediaRes.json();
    const media = (mediaJson.data || []).map(mapItem).filter((item) => item.id);
    const reels = media.filter(isReel).slice(0, 30);
    const posts = media.filter((item) => !isReel(item)).slice(0, 30);

    let stories = [];
    if (storyRes.ok) {
      const storyJson = await storyRes.json();
      stories = (storyJson.data || []).map(mapItem).filter((item) => item.id || item.mediaUrl);
    }

    const payload = { ok: true, configured: true, stories, posts, reels };
    cache = { at: Date.now(), payload };
    return payload;
  }
}

module.exports = new InstagramFeedService();
