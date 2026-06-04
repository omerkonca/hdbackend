const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs/promises');
const config = require('../src/config');
const CityContent = require('../src/models/CityContent');

async function main() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    const jsonPath = path.resolve(__dirname, '../data/city_content.json');
    console.log(`📄 Reading ${jsonPath}...`);
    const raw = await fs.readFile(jsonPath, 'utf8');
    const jsonData = JSON.parse(raw);

    // Remove MongoDB metadata fields if they exist in the JSON file
    delete jsonData._id;
    delete jsonData.createdAt;
    delete jsonData.updatedAt;
    delete jsonData.__v;

    console.log('🗑️ Clearing existing CityContent from DB...');
    await CityContent.deleteMany({});
    console.log('✅ Cleared.');

    console.log('📤 Seeding new CityContent...');
    const created = await CityContent.create(jsonData);
    console.log('✅ Seeded successfully. ID:', created._id);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during synchronization:', error);
    process.exit(1);
  }
}

main();
