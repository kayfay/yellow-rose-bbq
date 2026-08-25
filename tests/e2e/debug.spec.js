const { test, expect } = require('@playwright/test');

test('Check D3', async ({ page }) => {
  page.on('console', msg => console.log(msg.text()));
  page.on('pageerror', err => console.log(err.message));
  page.on('requestfailed', request => console.log('Request failed: ' + request.url() + ' ' + request.failure().errorText));

  await page.goto('/');
  const isD3 = await page.evaluate(() => typeof d3 !== 'undefined');
  console.log('Is D3 loaded? ', isD3);
});
