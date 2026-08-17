const { test, expect } = require('@playwright/test');

test('check console errors and reload button', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('file://' + __dirname + '/../index.html');
  await page.waitForLoadState('networkidle');
  
  const refreshBtn = await page.$('#btn-refresh-analytics');
  console.log("Refresh button found?", !!refreshBtn);
  
  if (refreshBtn) {
    console.log("Refresh button text:", await refreshBtn.innerText());
  }

  const kpiBrisket = await page.$('#kpi-brisket-lbs');
  if (kpiBrisket) {
      console.log("Brisket KPI:", await kpiBrisket.innerText());
  }
  
  console.log("Errors:", errors);
});
