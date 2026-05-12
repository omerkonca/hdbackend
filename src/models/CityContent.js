const mongoose = require('mongoose');

const CityContentSchema = new mongoose.Schema({
  services: mongoose.Schema.Types.Mixed,
  explore: mongoose.Schema.Types.Mixed,
  media: mongoose.Schema.Types.Mixed,
  branding: mongoose.Schema.Types.Mixed,
  home: mongoose.Schema.Types.Mixed,
  more: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('CityContent', CityContentSchema);
