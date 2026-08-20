const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function fix() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const jsonPath = path.join(__dirname, '../data/city_content.json');
  const content = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const updateRes = await client.query(
    "UPDATE city_contents SET data = $1, updated_at = NOW() WHERE id = 1",
    [JSON.stringify(content)]
  );
  console.log('Updated city_contents row id 1, rows affected:', updateRes.rowCount);

  // Verify
  const check = await client.query("SELECT id, updated_at, jsonb_array_length(data->'villages') as village_count FROM city_contents WHERE id = 1");
  console.log('Verification:', check.rows);

  await client.end();
}

fix().catch(console.error);
