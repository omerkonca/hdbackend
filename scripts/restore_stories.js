const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function restore() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const backupRes = await client.query("SELECT data FROM city_content_backups WHERE id = 1970");
  const backupData = backupRes.rows[0].data;

  const currentRes = await client.query("SELECT data FROM city_contents WHERE id = 1");
  const currentData = currentRes.rows[0].data;

  // Restore headerMedia and storyBubbles from backup
  currentData.home = currentData.home || {};
  currentData.home.headerMedia = backupData.home.headerMedia;
  currentData.home.storyBubbles = backupData.home.storyBubbles;

  // Update in Supabase
  await client.query("UPDATE city_contents SET data = $1, updated_at = NOW() WHERE id = 1", [currentData]);
  console.log('Successfully updated Supabase city_contents with 29 story media items and 5 bubbles.');

  // Update backend/data/city_content.json
  const backendJsonPath = path.join(__dirname, '..', 'data', 'city_content.json');
  if (fs.existsSync(backendJsonPath)) {
    fs.writeFileSync(backendJsonPath, JSON.stringify(currentData, null, 2), 'utf8');
    console.log('Updated backend/data/city_content.json');
  }

  // Update assets/data/city_content.json
  const assetsJsonPath = path.join(__dirname, '..', '..', 'assets', 'data', 'city_content.json');
  if (fs.existsSync(assetsJsonPath)) {
    fs.writeFileSync(assetsJsonPath, JSON.stringify(currentData, null, 2), 'utf8');
    console.log('Updated assets/data/city_content.json');
  }

  await client.end();
}

restore();
