const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const mapping = {
  'story_1782324916717_itm5l': 'assets/images/stories/duzici_selalesi_ue56_0.webp',
  'story_1782324919087_ofshc': 'assets/images/stories/duzici_selalesi_ue56_1.webp',
  'story_1782324922773_0hpxj': 'assets/images/stories/duzici_selalesi_ue56_2.webp',
  'story_1782324933816_j040n': 'assets/images/stories/duzici_selalesi_ue56_3.webp',
  'story_1782324935767_bsx56': 'assets/images/stories/duzici_selalesi_ue56_4.webp',
  'story_1782324938219_liz1h': 'assets/images/stories/duzici_selalesi_ue56_5.webp',
  'story_1782299338686_g68c3': 'assets/images/stories/yesil_selalesi_la1b_6.jpg',
  'story_1783086669118_8kfy3': 'assets/images/stories/duzici_j8ok_7.jpg',
  'story_1782728911009_nbdj5': 'assets/images/stories/duzici_j8ok_8.png',
  'story_1783086413424_jabag': 'assets/images/stories/berke_baraji_f4w2_9.jpg',
  'story_1783862754396_26zyl': 'assets/images/stories/dumanli_yaylasi_pxkg_10.jpg',
};

async function run() {
  const assetsJsonPath = path.join(__dirname, '..', '..', 'assets', 'data', 'city_content.json');
  const backendJsonPath = path.join(__dirname, '..', 'data', 'city_content.json');

  const data = JSON.parse(fs.readFileSync(assetsJsonPath, 'utf8'));

  data.home.headerMedia.forEach(m => {
    if (mapping[m.id]) {
      m.url = mapping[m.id];
    }
  });

  fs.writeFileSync(assetsJsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Updated assets/data/city_content.json with local story asset paths.');

  fs.writeFileSync(backendJsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Updated backend/data/city_content.json with local story asset paths.');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("UPDATE city_contents SET data = $1, updated_at = NOW() WHERE id = 1", [data]);
  console.log('Updated Supabase city_contents with embedded story assets.');
  await client.end();
}

run();
