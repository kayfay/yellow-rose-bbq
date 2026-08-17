const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', request => console.log('REQ FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('file:///home/atools/Documents/GitHub/yellow-rose-bbq/index.html', { waitUntil: 'networkidle' });
  
  const text = await page.$eval('#kpi-brisket-lbs', el => el.textContent);
  const rev = await page.$eval('#kpi-projected-revenue', el => el.textContent);
  console.log('Brisket Lbs:', text);
  console.log('Projected Rev:', rev);
  
  await browser.close();
})();
