const { test, expect } = require('@playwright/test');

test.describe('Dashboard Verification', () => {

  test('Page loads and essential UI elements are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sausage & BBQ Prep Command Center/i);
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.app-content')).toBeVisible();
  });

  test('Navigating to Analytics tab hides sticky footer', async ({ page }) => {
    await page.goto('/');
    
    // Default tab might be Prep or Production, footer should be visible
    const footer = page.locator('.sticky-footer');
    
    // Go to Analytics tab
    await page.click('#tab-btn-forecasting');
    
    // Verify .hide-footer class is applied to body
    await expect(page.locator('body')).toHaveClass(/hide-footer/);
  });

  test('Data Integrity: Raw Meat Targets math verification', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-btn-forecasting');
    
    // Wait for the JSON data to load and populate the dashboard (it populates from "--")
    await expect(page.locator('#kpi-brisket-lbs')).not.toHaveText('--', { timeout: 10000 });
    
    const brisketText = await page.locator('#kpi-brisket-lbs').textContent();
    const porkText = await page.locator('#kpi-pork-lbs').textContent();
    const sausageText = await page.locator('#kpi-sausage-links').textContent();
    
    const brisketVal = Number(brisketText.replace(/,/g, ''));
    const porkVal = Number(porkText.replace(/,/g, ''));
    const sausageVal = Number(sausageText.replace(/,/g, ''));
    
    expect(brisketVal).toBeGreaterThan(0);
    expect(porkVal).toBeGreaterThan(0);
    expect(sausageVal).toBeGreaterThan(0);
    
    // Ensure values are not insanely inflated (e.g. less than 1000)
    // Brisket daily target is normally < 1000 lbs
    expect(brisketVal).toBeLessThan(1000);
    expect(porkVal).toBeLessThan(1000);
  });

  test('Prediction Verification: Analytics charts render', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-btn-forecasting');
    
    // Assuming a plotly chart container is visible
    await expect(page.locator('#plotly-meat-sales-chart')).toBeVisible();
    
    // Verify the category dropdown exists and can be interacted with
    const dropdown = page.locator('#category-selector');
    await expect(dropdown).toBeVisible();
    
    await dropdown.selectOption('pulled_pork_lbs');
    // We assume the chart updates, we can check for Plotly DOM structures
    await expect(page.locator('.js-plotly-plot').first()).toBeVisible({ timeout: 15000 });
  });

});
