const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8011/');
  await new Promise(r => setTimeout(r, 2000));
  await page.click('#tab-btn-forecasting');
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  const brisketText = await page.$eval('#kpi-brisket-lbs', el => el.textContent).catch(()=>'not found');
  const porkText = await page.$eval('#kpi-pork-lbs', el => el.textContent).catch(()=>'not found');
  const sausageText = await page.$eval('#kpi-sausage-batches', el => el.textContent).catch(()=>'not found');
  console.log('Brisket:', brisketText);
  console.log('Pork:', porkText);
  console.log('Sausage:', sausageText);
  await browser.close();
})();
