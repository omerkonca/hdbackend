const fs = require('fs').promises;
const path = require('path');
const { isValidRoadClosureRecord } = require('./roadClosureFilters');

const STORE_PATH = path.resolve(__dirname, '../../data/road_closures_state.json');

class RoadClosureStore {
  async load() {
    try {
      const raw = await fs.readFile(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        version: 1,
        lastSyncAt: parsed.lastSyncAt || null,
        items: parsed.items || {},
      };
    } catch {
      return { version: 1, lastSyncAt: null, items: {} };
    }
  }

  async save(state) {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(state, null, 2), 'utf8');
  }

  /**
   * Canlı taramayla birleştir; siteden kaybolan duyuruları otomatik kapat.
   */
  _filterValidItems(items) {
    const out = {};
    for (const [fp, item] of Object.entries(items)) {
      if (item.kind === 'news') continue;
      if (
        !isValidRoadClosureRecord({
          title: item.title,
          subtitle: item.subtitle,
          source: item.source,
          kind: item.kind,
        })
      ) {
        continue;
      }
      out[fp] = item;
    }
    return out;
  }

  async sync(liveItems, { missedThreshold = 1 } = {}) {
    const loaded = await this.load();
    const state = { ...loaded, items: this._filterValidItems(loaded.items) };
    const now = new Date().toISOString();
    const liveByFp = new Map();
    for (const item of liveItems) {
      const fp = item.fingerprint || item.id;
      liveByFp.set(fp, { ...item, fingerprint: fp, autoManaged: item.autoManaged !== false });
    }

    const nextItems = { ...state.items };

    for (const [fp, live] of liveByFp.entries()) {
      const prev = nextItems[fp];
      nextItems[fp] = {
        ...live,
        fingerprint: fp,
        firstSeenAt: prev?.firstSeenAt || now,
        lastSeenAt: now,
        missedScans: 0,
        autoManaged:
          prev?.autoManaged === false || live.autoManaged === false ? false : true,
      };
    }

    for (const [fp, prev] of Object.entries(nextItems)) {
      if (liveByFp.has(fp)) continue;
      if (prev.autoManaged === false) continue;

      const missed = (prev.missedScans || 0) + 1;
      if (missed >= missedThreshold) {
        nextItems[fp] = {
          ...prev,
          status: 'Tamamlandı',
          missedScans: missed,
          closedAt: now,
          closeReason: 'Duyuru artık yayında değil',
        };
      } else {
        nextItems[fp] = { ...prev, missedScans: missed };
      }
    }

    return {
      version: 1,
      lastSyncAt: now,
      items: nextItems,
    };
  }

  applyLifecycle(state) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items = {};
    for (const [fp, item] of Object.entries(state.items)) {
      let status = item.status || '';
      const lower = status.toLowerCase();
      if (item.endAt && !/trafik komisyon/i.test(item.title || '')) {
        const end = new Date(item.endAt);
        end.setHours(0, 0, 0, 0);
        if (end < today && (lower.includes('devam') || lower.includes('aktif'))) {
          status = 'Tamamlandı';
        }
      }
      items[fp] = { ...item, status };
    }
    return { ...state, items };
  }

  toPublicList(state) {
    return Object.values(state.items).map((item) => {
      const {
        fingerprint,
        firstSeenAt,
        lastSeenAt,
        missedScans,
        autoManaged,
        closedAt,
        closeReason,
        ...pub
      } = item;
      return pub;
    });
  }
}

RoadClosureStore.STORE_PATH = STORE_PATH;
module.exports = new RoadClosureStore();
