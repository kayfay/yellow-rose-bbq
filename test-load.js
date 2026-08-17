const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('file:///home/atools/Documents/GitHub/yellow-rose-bbq/index.html');
  await page.waitForTimeout(2000);
  const text = await page.$eval('#kpi-brisket-lbs', el => el.textContent);
  console.log('Brisket Lbs:', text);
  await browser.close();
})();
