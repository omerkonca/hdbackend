require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../src/config');

const supabase = createClient(
  config.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY
);

async function purge() {
  console.log('🧹 Purging all fake listings from Supabase and local JSON files...');

  // 1. Fetch Supabase city_contents
  const { data, error } = await supabase
    .from('city_contents')
    .select('data')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('❌ Supabase fetch error:', error.message);
    return;
  }

  const content = data.data || {};

  // Clean root
  content.realEstates = [];
  content.autoVehicles = [];
  content.autoGallery = [];
  content.localProducts = [];
  content.privateTutors = [];
  content.jobListings = [];
  content.lostFound = [];

  // Clean explore
  if (content.explore) {
    content.explore.realEstates = [];
    content.explore.autoVehicles = [];
    content.explore.autoGallery = [];
    content.explore.localProducts = [];
    content.explore.privateTutors = [];
    content.explore.jobListings = [];
    content.explore.lostFound = [];
  }

  // Update Supabase
  const { error: updateError } = await supabase
    .from('city_contents')
    .update({ data: content, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (updateError) {
    console.error('❌ Supabase update error:', updateError.message);
  } else {
    console.log('✅ Supabase city_contents purged successfully! All fake listings removed.');
  }

  // 2. Update local backend JSON
  const backendPath = path.resolve(__dirname, '../data/city_content.json');
  if (fs.existsSync(backendPath)) {
    const raw = JSON.parse(fs.readFileSync(backendPath, 'utf8'));
    raw.realEstates = [];
    raw.autoVehicles = [];
    raw.autoGallery = [];
    raw.localProducts = [];
    raw.privateTutors = [];
    raw.jobListings = [];
    raw.lostFound = [];
    if (raw.explore) {
      raw.explore.realEstates = [];
      raw.explore.autoVehicles = [];
      raw.explore.autoGallery = [];
      raw.explore.localProducts = [];
      raw.explore.privateTutors = [];
      raw.explore.jobListings = [];
      raw.explore.lostFound = [];
    }
    fs.writeFileSync(backendPath, JSON.stringify(raw, null, 2), 'utf8');
    console.log('✅ Updated backend/data/city_content.json');
  }

  // 3. Update assets JSON
  const assetsPath = path.resolve(__dirname, '../../assets/data/city_content.json');
  if (fs.existsSync(assetsPath)) {
    const raw = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
    raw.realEstates = [];
    raw.autoVehicles = [];
    raw.autoGallery = [];
    raw.localProducts = [];
    raw.privateTutors = [];
    raw.jobListings = [];
    raw.lostFound = [];
    if (raw.explore) {
      raw.explore.realEstates = [];
      raw.explore.autoVehicles = [];
      raw.explore.autoGallery = [];
      raw.explore.localProducts = [];
      raw.explore.privateTutors = [];
      raw.explore.jobListings = [];
      raw.explore.lostFound = [];
    }
    fs.writeFileSync(assetsPath, JSON.stringify(raw, null, 2), 'utf8');
    console.log('✅ Updated assets/data/city_content.json');
  }

  console.log('🎉 Completely cleared all fake listings!');
}

purge();
