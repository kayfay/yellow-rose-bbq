const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('file://' + __dirname + '/index.html');
  await page.waitForTimeout(1000); // give it a sec
  console.log("Errors: ", errors);
  
  const refreshText = await page.evaluate(() => {
     const btn = document.getElementById('btn-refresh-analytics');
     return btn ? btn.innerText : 'NOT_FOUND';
  });
  console.log("Refresh Btn:", refreshText);
  await browser.close();
})();
