const mongoose = require('mongoose');

const PharmacyItemSchema = new mongoose.Schema({
  name: String,
  address: String,
  phone: String,
  locationUrl: String,
  area: String,
  fetchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PharmacyItem', PharmacyItemSchema);
