const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('http://localhost:8000/index.html');
  await page.waitForTimeout(500); 

  await page.click('[data-tab="forecasting-analytics"]');
  await page.waitForTimeout(1000); 

  console.log("Errors: ", errors);
  
  const kpiBrisket = await page.evaluate(() => {
     const el = document.getElementById('kpi-brisket-lbs');
     return el ? el.innerText : 'NOT_FOUND';
  });
  console.log("Brisket KPI text:", kpiBrisket);
  await browser.close();
  process.exit(0);
})();
