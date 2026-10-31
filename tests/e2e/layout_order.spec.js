const { test, expect } = require('@playwright/test');

test.describe('Forecasting layout & Shop Reports subtab', () => {
  test('Date picker, projections, then subtab buttons; brief hidden until Reports is picked', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.click('#tab-btn-forecasting');

    const top = async (sel) => (await page.locator(sel).boundingBox()).y;
    const dateY = await top('#forecast-start-date');
    const kpiY = await top('#kpi-card-revenue-container');
    const subtabY = await top('#btn-subtab-predictive');
    expect(dateY).toBeLessThan(kpiY);
    expect(kpiY).toBeLessThan(subtabY);

    await expect(page.locator('#subtab-view-predictive')).toBeVisible();
    await expect(page.locator('#daily-executive-brief-banner')).toBeHidden();
    await expect(page.locator('#ten-tips-container')).toBeHidden();
    await expect(page.locator('#pitmaster-analytics-glossary')).toBeHidden();
    await expect(page.locator('details summary', { hasText: 'Supplier Delivery' })).toBeHidden();
  });

  test('Shop Reports subtab holds the brief, tips, glossary and supplier reference', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-btn-forecasting');
    await page.click('#btn-subtab-reports');

    const reports = page.locator('#subtab-view-reports');
    await expect(reports).toBeVisible();
    await expect(page.locator('#subtab-view-predictive')).toBeHidden();
    await expect(reports.locator('#daily-sales-bridge-container')).toBeVisible();
    await expect(reports.locator('#ten-tips-container')).toBeVisible();
    await expect(reports.locator('#pitmaster-analytics-glossary')).toBeVisible();
    await expect(reports.locator('details summary', { hasText: 'Supplier Delivery' })).toBeVisible();
  });

  test('Main navigation stays at two tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-tab-btn')).toHaveCount(2);
    await expect(page.locator('.mobile-bottom-nav-btn')).toHaveCount(2);
  });
});
