const eventService = require('../src/services/eventService');

async function run() {
  console.log('🎭 Fetching all live and upcoming events...');
  const events = await eventService.getEvents({ forceRefresh: true });
  console.log(`✅ Total events loaded: ${events.length}`);
  
  const byCity = {};
  for (const e of events) {
    byCity[e.city] = (byCity[e.city] || 0) + 1;
  }
  console.log('Events by city:', byCity);

  console.log('\nSample upcoming 5 events:');
  events.slice(0, 5).forEach((e, idx) => {
    console.log(`${idx + 1}. [${e.city}] ${e.title} (${e.category}) - ${e.date.slice(0, 10)} @ ${e.location} [${e.price}]`);
  });
}

run();
