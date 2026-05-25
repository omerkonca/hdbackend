const fs = require('fs');

async function run() {
  try {
    const html = fs.readFileSync('duzici_nobetci.html', 'utf8');
    console.log('HTML Loaded. Size:', html.length);

    // Extract bugun block
    const bugunStartIdx = html.indexOf('id="nav-bugun"');
    if (bugunStartIdx === -1) {
      throw new Error('id="nav-bugun" not found in HTML');
    }
    
    // Find the end of today's table
    const tableEndIdx = html.indexOf('</table>', bugunStartIdx);
    if (tableEndIdx === -1) {
      throw new Error('</table> not found after id="nav-bugun"');
    }

    const bugunHtml = html.substring(bugunStartIdx, tableEndIdx);
    console.log('bugunHtml isolated. Length:', bugunHtml.length);

    // Parse dateRange from bugunHtml
    const rangeRegex = /class=["']d-flex alert alert-warning[^>]*>([\s\S]*?)<\/div>/i;
    const rangeMatch = bugunHtml.match(rangeRegex);
    const dateRange = rangeMatch ? rangeMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    console.log('Parsed Date Range:', dateRange);

    const nameRegex = /<span class=["']isim["']>([^<]+)<\/span>/g;
    const all = [];
    let nameMatch;

    while ((nameMatch = nameRegex.exec(bugunHtml)) !== null) {
      const name = nameMatch[1].trim();
      const nameIdx = nameMatch.index;
      
      const rest = bugunHtml.substring(nameIdx);
      const detailRegex = /class=['"]col-lg-6['"]>([\s\S]*?)<\/div>[\s\S]*?class=['"]col-lg-3[^'"]*['"]>([\s\S]*?)<\/div>/;
      const detailMatch = rest.match(detailRegex);

      if (detailMatch) {
        const address = detailMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const phone = detailMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        all.push({
          dateLabel: 'Bugün',
          dateRange,
          name,
          address,
          phone
        });
      }
    }

    console.log('Total matches parsed:', all.length);
    console.log('Matches list:', JSON.stringify(all, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

run();
