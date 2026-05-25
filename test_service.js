const pharmacyService = require('./src/services/pharmacyService');
const fs = require('fs');

async function test() {
  try {
    const html = fs.readFileSync('duzici_nobetci.html', 'utf8');
    console.log('Testing parseDutyPharmacyHtml with real HTML file...');
    const result = pharmacyService.parseDutyPharmacyHtml(html);
    console.log('Parsed successfully! Result count:', result.length);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
