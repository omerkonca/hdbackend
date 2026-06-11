const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { ensureCitizenReportsTable } = require('../src/utils/runMigrations');

ensureCitizenReportsTable()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
