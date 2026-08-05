const fs = require('fs');
const path = require('path');
const map = require('../data/cloudinary-url-map.json');

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function buildReplace(expr, entries) {
  let out = expr;
  for (const [from, to] of entries) {
    out = `replace(${out}, ${sqlStr(from)}, ${sqlStr(to)})`;
  }
  return out;
}

const entries = Object.entries(map);
const cityExpr = buildReplace('data::text', entries);
const citySql = `UPDATE city_contents
SET data = (${cityExpr})::jsonb,
    updated_at = now()
WHERE data::text ILIKE '%cloudinary%';`;

const reportExpr = buildReplace('image_urls::text', entries);
const reportSql = `UPDATE citizen_reports
SET image_urls = (${reportExpr})::text[]
WHERE image_urls::text ILIKE '%cloudinary%';`;

fs.writeFileSync(path.join(__dirname, '../data/_replace_city.sql'), citySql);
fs.writeFileSync(path.join(__dirname, '../data/_replace_reports.sql'), reportSql);
console.log('ok', entries.length);
