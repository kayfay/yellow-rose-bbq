const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
  page.on('pageerror', exception => console.log(`PAGE ERROR: ${exception}`));
  page.on('requestfailed', request => console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`));

  console.log("Navigating to https://sausage.allen.tools...");
  await page.goto('https://sausage.allen.tools', { waitUntil: 'networkidle' });
  
  console.log("Done.");
  await browser.close();
})();
