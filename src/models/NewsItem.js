const mongoose = require('mongoose');

const NewsItemSchema = new mongoose.Schema({
  title: String,
  link: String,
  pubDate: Date,
  source: String,
  content: String,
  imageUrl: String,
  fullText: String
}, { timestamps: true });

module.exports = mongoose.model('NewsItem', NewsItemSchema);
