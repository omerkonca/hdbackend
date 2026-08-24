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
          lat: item.lat,
          lng: item.lng,
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

      // Manuel eklenen kayıtlar canlı scraper'da olmasa bile ASLA otomatik kapatılmaz!
      if (prev.autoManaged === false || prev.kind === 'manual') {
        if (prev.endAt && new Date(prev.endAt).getTime() < Date.now()) {
          nextItems[fp] = {
            ...prev,
            status: 'Tamamlandı',
            closedAt: now,
            closeReason: 'Bitiş tarihi sona erdi',
          };
        }
        continue;
      }

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
    const nowIso = new Date().toISOString();
    const MUNICIPALITY_MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;
    const ASPHALT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
    const items = {};
    for (const [fp, item] of Object.entries(state.items)) {
      let status = item.status || '';
      const lower = status.toLowerCase();
      const titleBlob = `${item.title || ''} ${item.subtitle || ''}`.toLocaleLowerCase('tr-TR');
      let closedAt = item.closedAt;
      let closeReason = item.closeReason;

      const forceClose = (reason) => {
        if (lower.includes('devam') || lower.includes('aktif') || !status) {
          status = 'Tamamlandı';
          closedAt = closedAt || nowIso;
          closeReason = reason;
        }
      };

      // Bozuk liste fingerprint'leri
      if (/^belediye_(duyurular|haberler)$/i.test(fp)) {
        forceClose('Liste sayfası fingerprint — otomatik kapatıldı');
      }

      // Uzunbanı asfaltlama (bitmiş duyuru, sitede haber olarak kalıyor)
      if (titleBlob.includes('uzunban') && titleBlob.includes('asfalt')) {
        forceClose('Uzunbanı asfaltlama duyurusu süresi doldu');
      }

      if (item.endAt && !/trafik komisyon/i.test(item.title || '')) {
        const end = new Date(item.endAt);
        end.setHours(0, 0, 0, 0);
        if (end < today && (lower.includes('devam') || lower.includes('aktif'))) {
          status = 'Tamamlandı';
          closedAt = closedAt || nowIso;
          closeReason = closeReason || 'Bitiş tarihi geçti';
        }
      }

      // Belediye duyuruları: endAt yoksa max yaş
      if (
        item.kind === 'municipality' &&
        item.autoManaged !== false &&
        !item.endAt &&
        (status.toLowerCase().includes('devam') || status.toLowerCase().includes('aktif'))
      ) {
        const first = item.firstSeenAt ? new Date(item.firstSeenAt).getTime() : 0;
        if (first > 0) {
          const age = Date.now() - first;
          const asphalt = /asfalt|yol\s*yap[ıi]m|yol\s*çal[ıi][sş]ma/i.test(titleBlob);
          const limit = asphalt ? ASPHALT_MAX_AGE_MS : MUNICIPALITY_MAX_AGE_MS;
          if (age > limit) {
            forceClose(
              asphalt
                ? 'Asfaltlama duyurusu max yaş aşımı'
                : 'Belediye duyurusu max yaş aşımı',
            );
          }
        }
      }

      items[fp] = { ...item, status, closedAt, closeReason };
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
