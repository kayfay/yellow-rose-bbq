const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
    if(!response.ok()) console.log('HTTP ERROR:', response.status(), response.url());
  });

  await page.goto('http://127.0.0.1:8011/');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
