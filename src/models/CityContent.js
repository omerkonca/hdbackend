const mongoose = require('mongoose');

const CityContentSchema = new mongoose.Schema({
  services: mongoose.Schema.Types.Mixed,
  explore: mongoose.Schema.Types.Mixed,
  media: mongoose.Schema.Types.Mixed,
  branding: mongoose.Schema.Types.Mixed,
  home: mongoose.Schema.Types.Mixed,
  more: mongoose.Schema.Types.Mixed,
  news: mongoose.Schema.Types.Mixed,
  discover: mongoose.Schema.Types.Mixed,
  trip: mongoose.Schema.Types.Mixed,
}, { timestamps: true, strict: false });

module.exports = mongoose.model('CityContent', CityContentSchema);
