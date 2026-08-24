const { createClient } = require('@supabase/supabase-js');
const config = require('../src/config');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

async function inspect() {
  const { data, error } = await supabase
    .from('city_contents')
    .select('data')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const d = data.data;
  console.log('Root realEstates:', d.realEstates?.length);
  console.log('Explore realEstates:', d.explore?.realEstates?.length);
  if (d.explore?.realEstates) {
    console.log('explore.realEstates:', JSON.stringify(d.explore.realEstates, null, 2));
  }

  console.log('Root autoVehicles/autoGallery:', d.autoVehicles?.length, d.autoGallery?.length);
  console.log('Explore autoVehicles/autoGallery:', d.explore?.autoVehicles?.length, d.explore?.autoGallery?.length);
  if (d.explore?.autoVehicles) {
    console.log('explore.autoVehicles:', JSON.stringify(d.explore.autoVehicles, null, 2));
  }

  console.log('Root localProducts:', d.localProducts?.length);
  console.log('Explore localProducts:', d.explore?.localProducts?.length);
  if (d.explore?.localProducts) {
    console.log('explore.localProducts:', JSON.stringify(d.explore.localProducts, null, 2));
  }
}

inspect();
