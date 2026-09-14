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
    const sausageText = await page.locator('#kpi-sausage-batches').textContent();
    
    const brisketVal = Number(brisketText.replace(/,/g, ''));
    const porkVal = Number(porkText.replace(/,/g, ''));
    const sausageVal = Number(sausageText.replace(/,/g, ''));
    
    expect(brisketVal).toBeGreaterThanOrEqual(0);
    expect(porkVal).toBeGreaterThanOrEqual(0);
    expect(sausageVal).toBeGreaterThanOrEqual(0);
    
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
    // We assume the chart updates, we can check for D3 DOM structures
    await expect(page.locator('#plotly-meat-sales-chart svg').first()).toBeVisible({ timeout: 15000 });
  });

  test('Operational Horizon Presets: Weekend vs Single Day Targets', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-btn-forecasting');
    await expect(page.locator('#kpi-brisket-lbs')).not.toHaveText('--', { timeout: 10000 });

    // Click Weekend (Fri-Sun)
    await page.click('#btn-preset-weekend');
    await page.waitForTimeout(500);

    const startVal = await page.locator('#forecast-start-date').inputValue();
    const endVal = await page.locator('#forecast-end-date').inputValue();
    expect(startVal).not.toBe(endVal);

    const weekendBrisket = Number((await page.locator('#kpi-brisket-lbs').textContent()).replace(/,/g, ''));
    expect(weekendBrisket).toBeGreaterThan(50);

    // Click Thursday single day
    await page.click('#btn-preset-thursday');
    await page.waitForTimeout(500);

    const thuStart = await page.locator('#forecast-start-date').inputValue();
    const thuEnd = await page.locator('#forecast-end-date').inputValue();
    expect(thuStart).toBe(thuEnd);

    const thuBrisket = Number((await page.locator('#kpi-brisket-lbs').textContent()).replace(/,/g, ''));
    expect(thuBrisket).toBeGreaterThan(0);
    expect(thuBrisket).toBeLessThanOrEqual(weekendBrisket);
  });

  test('In-Place Chart Updates: Chart remains intact across date filters without crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.click('#tab-btn-forecasting');

    await expect(page.locator('#plotly-meat-sales-chart')).toBeVisible();

    // Toggle between Friday and Saturday
    await page.click('#btn-preset-friday');
    await page.waitForTimeout(300);
    await page.click('#btn-preset-saturday');
    await page.waitForTimeout(300);
    await page.click('#btn-preset-7');
    await page.waitForTimeout(300);

    // Chart SVG must still be present and visible
    await expect(page.locator('#plotly-meat-sales-chart svg').first()).toBeVisible();
    expect(errors.filter(e => e.includes('RangeError') || e.includes('Invalid time value'))).toHaveLength(0);
  });

  test('Defensive Date Selection: Historical Date and Empty Input Handling', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.click('#tab-btn-forecasting');

    // Input historical date 2026-06-11
    await page.fill('#forecast-start-date', '2026-06-11');
    await page.fill('#forecast-end-date', '2026-06-11');
    await page.dispatchEvent('#forecast-start-date', 'change');
    await page.waitForTimeout(500);

    // Historical reference drawer should become visible
    await expect(page.locator('#historical-reference-card')).toBeVisible();
    await expect(page.locator('#hist-demand-val')).toBeVisible();

    // Input empty string - should gracefully fallback without throwing RangeError
    await page.fill('#forecast-start-date', '');
    await page.dispatchEvent('#forecast-start-date', 'change');
    await page.waitForTimeout(300);

    expect(errors.filter(e => e.includes('RangeError') || e.includes('Invalid time value'))).toHaveLength(0);
  });

  test('Closed Day Handling: Monday displays Closed status and 0 prep targets', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-btn-forecasting');

    // Input Monday 2026-09-14
    await page.fill('#forecast-start-date', '2026-09-14');
    await page.fill('#forecast-end-date', '2026-09-14');
    await page.dispatchEvent('#forecast-start-date', 'change');
    await page.waitForTimeout(500);

    // Verify revenue KPI reads "Closed" (NOT "-95%")
    const revText = await page.locator('#kpi-projected-revenue').textContent();
    expect(revText.trim()).toBe('Closed');

    // Verify raw meat prep targets are 0 on closed days
    const brisketVal = await page.locator('#kpi-brisket-lbs').textContent();
    expect(brisketVal.trim()).toBe('0');

    // Verify demand label explains the closure
    const demandText = await page.locator('#kpi-demand-label').textContent();
    expect(demandText.toLowerCase()).toContain('closed');
  });

});

