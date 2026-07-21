const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-web-security'] });
  const page    = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('http://localhost:4242', { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Canvas çizilmesini bekle
  await new Promise(function(r) { setTimeout(r, 8000); });

  await page.screenshot({
    path: 'output/dashboard_v5_screenshot.png',
    fullPage: false
  });

  console.log('Screenshot alindi.');
  await browser.close();
})().catch(console.error);
