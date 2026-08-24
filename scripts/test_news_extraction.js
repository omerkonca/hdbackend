const newsService = require('../src/services/newsService');
const outageService = require('../src/services/outageService');
const roadClosureSyncService = require('../src/services/roadClosureSyncService');

async function test() {
  console.log('📰 Testing Outage & Road Closure extraction from news...');
  const outages = await outageService.getOutages({ forceRefresh: true });
  console.log(`✅ Extracted/active outages count: ${outages.length}`);
  if (outages.length > 0) {
    console.log('Sample outage:', JSON.stringify(outages[0], null, 2));
  }

  const roads = await roadClosureSyncService.getRoadClosures({ forceRefresh: true });
  console.log(`✅ Extracted/active road closures count: ${roads.length}`);
  if (roads.length > 0) {
    console.log('Sample road closure:', JSON.stringify(roads[0], null, 2));
  }
}

test();
