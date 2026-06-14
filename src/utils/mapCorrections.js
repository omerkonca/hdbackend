const fs = require('fs');
const path = require('path');

const CORRECTIONS_PATH = path.resolve(__dirname, '../../data/map_corrections.json');

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9çğışöü]/gi, '').trim();
}

function loadCorrections() {
  if (!fs.existsSync(CORRECTIONS_PATH)) return { places: {}, pharmacies: {} };
  return JSON.parse(fs.readFileSync(CORRECTIONS_PATH, 'utf8'));
}

function buildPlaceLookup(corrections) {
  const lookup = corrections.places || {};
  const lookupMap = new Map();
  for (const [key, value] of Object.entries(lookup)) {
    lookupMap.set(norm(key), value);
  }
  return lookupMap;
}

function applyPlaceCorrection(place, lookupMap) {
  const match = lookupMap.get(norm(place.name));
  if (!match) return place;
  return {
    ...place,
    ...(match.lat != null ? { lat: match.lat } : {}),
    ...(match.lng != null ? { lng: match.lng } : {}),
    ...(match.googleMapsUrl ? { googleMapsUrl: match.googleMapsUrl } : {}),
  };
}

function enrichExploreWithCorrections(data) {
  const corrections = loadCorrections();
  const lookupMap = buildPlaceLookup(corrections);
  if (!data.explore) return data;

  if (data.explore.categories) {
    for (const cat of data.explore.categories) {
      if (!cat.places) continue;
      cat.places = cat.places.map((p) => applyPlaceCorrection(p, lookupMap));
    }
  }

  if (data.explore.suggestions) {
    for (const suggestion of data.explore.suggestions) {
      if (!suggestion.places) continue;
      suggestion.places = suggestion.places.map((p) => applyPlaceCorrection(p, lookupMap));
    }
  }

  return data;
}

function mapsSearchUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function mapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

module.exports = {
  CORRECTIONS_PATH,
  norm,
  loadCorrections,
  buildPlaceLookup,
  applyPlaceCorrection,
  enrichExploreWithCorrections,
  mapsSearchUrl,
  mapsDirectionsUrl,
};
