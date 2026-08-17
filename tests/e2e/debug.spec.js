const { test, expect } = require('@playwright/test');

test('Check Plotly', async ({ page }) => {
  page.on('console', msg => console.log(msg.text()));
  page.on('pageerror', err => console.log(err.message));
  page.on('requestfailed', request => console.log('Request failed: ' + request.url() + ' ' + request.failure().errorText));

  await page.goto('/');
  const isPlotly = await page.evaluate(() => typeof Plotly !== 'undefined');
  console.log('Is Plotly loaded? ', isPlotly);
});
