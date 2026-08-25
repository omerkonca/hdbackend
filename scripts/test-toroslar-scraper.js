const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function findChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function scrapeToroslar(headless = true) {
  const executablePath = await findChromePath();
  if (!executablePath) {
    throw new Error('Chrome/Edge executable not found');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900'
    ],
    defaultViewport: { width: 1280, height: 900 }
  });

  try {
    const page = await browser.newPage();
    
    // Bypass webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    );

    let capturedData = null;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/wkt-sorgulama') || url.includes('/elektrik-kesintisi-sorgulama')) {
        try {
          const json = await response.json();
          if (json && (json.state === 1 || json.result)) {
            console.log('[CAPTURED SUCCESS FROM RESPONSE]', url);
            capturedData = json;
          }
        } catch (e) {}
      }
    });

    console.log('1. Navigating to page...');
    await page.goto('https://online.toroslaredas.com.tr/elektrik-kesintisi-sorgulama', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('2. Clicking "Farklı Bir Adres"...');
    await page.evaluate(() => {
      const radio = document.querySelector('#radio-farkli-bir-adres');
      if (radio) {
        radio.click();
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(r => setTimeout(r, 800));

    console.log('3. Selecting Osmaniye (80)...');
    await page.evaluate(() => {
      const $il = window.jQuery && window.jQuery('#IlKodu');
      if ($il && $il.length) {
        $il.val('80').change();
        $il.selectpicker('refresh');
      }
    });

    console.log('4. Waiting for Ilce options...');
    await page.waitForFunction(() => {
      const select = document.querySelector('#IlceKodu');
      return select && select.options && select.options.length > 1;
    }, { timeout: 10000 });

    console.log('5. Selecting Düziçi...');
    await page.evaluate(() => {
      const select = document.querySelector('#IlceKodu');
      let duziciVal = '00001743';
      for (const opt of select.options) {
        if (/düziçi|duzici/i.test(opt.text)) {
          duziciVal = opt.value;
          break;
        }
      }
      const $ilce = window.jQuery && window.jQuery('#IlceKodu');
      if ($ilce && $ilce.length) {
        $ilce.val(duziciVal).change();
        $ilce.selectpicker('refresh');
      }
    });

    await new Promise(r => setTimeout(r, 1000));

    console.log('6. Checking recaptcha iframe...');
    const iframeElement = await page.$('iframe[src*="recaptcha/api2/anchor"]');
    if (iframeElement) {
      const frame = await iframeElement.contentFrame();
      if (frame) {
        const checkbox = await frame.$('#recaptcha-anchor');
        if (checkbox) {
          console.log('7. Clicking Recaptcha checkbox...');
          await checkbox.click();
          await new Promise(r => setTimeout(r, 2500));
        }
      }
    }

    console.log('8. Clicking Sorgula button...');
    await page.evaluate(() => {
      const btn = document.querySelector('#elektrikKesintiSorgulaBtn');
      if (btn) btn.click();
    });

    console.log('9. Waiting for responses and DOM update...');
    await new Promise(r => setTimeout(r, 6000));

    const finalState = await page.evaluate(() => {
      return {
        mevcutList: window.mapMevcutPolygonList || [],
        planlananList: window.mapPlanlananPolygonList || [],
        suanCount: document.querySelector('.suanCount')?.innerText?.trim() || '',
        planlananCount: document.querySelector('.planlananCount')?.innerText?.trim() || '',
        errorMsg: document.querySelector('.errorFormMessage')?.innerText?.trim() || '',
        captchaErr: document.querySelector('#captchaErrorMesajDiv')?.innerText?.trim() || ''
      };
    });

    console.log('Scraper Finished! Summary:', {
      hasCapturedData: !!capturedData,
      mevcutCount: finalState.mevcutList.length,
      planlananCount: finalState.planlananList.length,
      suanCount: finalState.suanCount,
      planlananCountText: finalState.planlananCount,
      errorMsg: finalState.errorMsg,
      captchaErr: finalState.captchaErr
    });

    return { capturedData, finalState };
  } finally {
    await browser.close();
  }
}

scrapeToroslar(true)
  .then(res => console.log('Done:', JSON.stringify(res, null, 2).slice(0, 1000)))
  .catch(err => console.error('Error:', err));
