const placesService = require('../services/placesService');

function photoQueryParams(resolved, reqQuery) {
  const p = new URLSearchParams();
  if (resolved.query) p.set('query', resolved.query);
  if (resolved.lat != null) p.set('lat', String(resolved.lat));
  if (resolved.lng != null) p.set('lng', String(resolved.lng));
  return p.toString();
}

class PlacesController {
  /** GET /api/places/photo?query=&lat=&lng= — Wikipedia/Wikimedia (API anahtarı yok) */
  async getPhoto(req, res) {
    try {
      const { query, lat, lng } = req.query;
      if (!query && (lat == null || lng == null)) {
        return res.status(400).json({ ok: false, message: 'query veya lat/lng gerekli.' });
      }

      const resolved = await placesService.getCachedOrSearch({
        query: query || 'Düziçi',
        lat: lat != null ? Number(lat) : undefined,
        lng: lng != null ? Number(lng) : undefined,
      });

      if (!resolved?.photoSourceUrl) {
        return res.status(404).json({ ok: false, message: 'Bu mekan için fotoğraf bulunamadı.' });
      }

      const { buf, contentType } = await placesService.fetchPhotoBytes(resolved.photoSourceUrl);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(buf);
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }

  /** GET /api/places/meta?query=&lat=&lng= — OSM tesisler + fotoğraf yolu */
  async getMeta(req, res) {
    try {
      const { query, lat, lng } = req.query;
      if (!query && (lat == null || lng == null)) {
        return res.status(400).json({ ok: false, message: 'query veya lat/lng gerekli.' });
      }

      const resolved = await placesService.getCachedOrSearch({
        query: query || 'Düziçi',
        lat: lat != null ? Number(lat) : undefined,
        lng: lng != null ? Number(lng) : undefined,
      });

      if (!resolved) {
        return res.status(404).json({ ok: false, message: 'Mekan bulunamadı.' });
      }

      const qs = photoQueryParams(resolved, req.query);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.json({
        ok: true,
        data: {
          name: resolved.name,
          address: resolved.address,
          lat: resolved.lat,
          lng: resolved.lng,
          mapUrl: resolved.osmUrl,
          parking: resolved.parking,
          restroom: resolved.restroom,
          entryFee: resolved.entryFee,
          entryFeeNote: resolved.entryFeeNote,
          photoUrl: `/api/places/photo?${qs}`,
          source: resolved.source,
        },
      });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }
}

module.exports = new PlacesController();
