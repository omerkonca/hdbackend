const { Client } = require('pg');
const eventService = require('./src/services/eventService');
require('dotenv').config();

async function run() {
  console.log('🔄 Scraping events from Bubilet...');
  const cities = ['Osmaniye', 'Adana', 'Hatay', 'Gaziantep', 'Kahramanmaraş'];
  let allScraped = [];
  
  for (const city of cities) {
    try {
      const items = await eventService.scrapeBubiletEvents(city);
      allScraped.push(...items);
      console.log(`✅ Scraped ${items.length} events for ${city}`);
    } catch (e) {
      console.error(`❌ Error scraping for ${city}:`, e.message);
    }
  }
  
  if (allScraped.length === 0) {
    console.error('❌ No events scraped. Make sure you are not blocked locally.');
    return;
  }
  
  console.log('\n📡 Connecting to Postgres database directly...');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in backend/.env file!');
    return;
  }
  
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected to Postgres database!');
    
    // Read current data
    const res = await client.query('SELECT data FROM city_contents WHERE id = 1');
    if (res.rows.length === 0) {
      throw new Error('city_contents row with id = 1 not found in database');
    }
    
    const content = res.rows[0].data;
    content.scrapedEvents = allScraped;
    
    // Save backup to city_content_backups
    try {
      await client.query(
        'INSERT INTO city_content_backups (data, description) VALUES ($1, $2)',
        [res.rows[0].data, `Backup before local scraped events update on ${new Date().toISOString()}`]
      );
      console.log('✅ Created a backup of city contents.');
    } catch (bkErr) {
      console.warn('⚠️ Backup failed (continuing):', bkErr.message);
    }
    
    // Write new content back
    await client.query(
      'UPDATE city_contents SET data = $1, updated_at = $2 WHERE id = 1',
      [content, new Date().toISOString()]
    );
    console.log(`🎉 Successfully saved ${allScraped.length} events directly to Supabase database!`);
  } catch (error) {
    console.error('❌ Database operation failed:', error.message);
  } finally {
    await client.end();
  }
}

run();
