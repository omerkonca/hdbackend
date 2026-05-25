const fs = require('fs').promises;
const path = require('path');
const { isValidRoadClosureRecord } = require('./roadClosureFilters');

const BASELINE_PATH = path.resolve(__dirname, '../../data/road_closure_baseline.json');

async function loadBaseline() {
  try {
    const raw = await fs.readFile(BASELINE_PATH, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((item) =>
      isValidRoadClosureRecord({
        title: item.title,
        subtitle: item.subtitle,
        source: item.source,
        kind: item.kind,
      }),
    );
  } catch {
    return [];
  }
}

module.exports = { loadBaseline, BASELINE_PATH };
