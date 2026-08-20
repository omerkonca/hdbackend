const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('backend/scratch/hasret_page.html', 'utf-8');
const $ = cheerio.load(html);

console.log('--- Testing Current findArticleBodyContainer ---');
const pTags = $('p');
console.log('Original p tags count in cheerio:', pTags.length);
pTags.each((i, el) => {
  const p = $(el);
  console.log(`[p ${i}] parent: <${p.parent().prop('tagName')} class="${p.parent().attr('class')}" id="${p.parent().attr('id')}"> -> ${p.text().trim().slice(0, 60)}...`);
});
