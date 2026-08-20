const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const b = await client.query("SELECT data FROM city_content_backups WHERE id = 1970");
  const d = b.rows[0].data;
  console.log('Backup 1970 headerMedia count:', d.home?.headerMedia?.length);
  console.log('Backup 1970 storyBubbles:', d.home?.storyBubbles);
  
  d.home?.headerMedia?.forEach((m, i) => {
    console.log(i, m.bubbleId, m.title, m.type, m.isActive, m.url.substring(0, 60));
  });

  await client.end();
}

check();
