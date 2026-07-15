#!/usr/bin/env node
/**
 * Güçlü admin şifresi üretir.
 * Kullanım: node scripts/generate-admin-token.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const token = `HDz_${crypto.randomBytes(28).toString('base64url')}!`;

console.log('\nYeni admin şifresi:\n');
console.log(token);
console.log('\nRender → Environment → ADMIN_TOKEN değerini bununla güncelleyin.');
console.log('Yerel geliştirme için backend/.env dosyasına da ekleyin.\n');

const secretsDir = path.resolve(__dirname, '../../secrets');
if (fs.existsSync(secretsDir)) {
  const out = path.join(secretsDir, `admin_token_${new Date().toISOString().slice(0, 10)}.txt`);
  fs.writeFileSync(out, `${token}\n`, 'utf8');
  console.log(`Kaydedildi: ${out}\n`);
}
