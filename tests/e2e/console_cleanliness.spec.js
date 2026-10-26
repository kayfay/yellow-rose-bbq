const { test, expect } = require('@playwright/test');

test.describe('Console & UI Cleanliness Audit', () => {

  test('Zero uncaught exceptions across all tabs, subtabs, and presets', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('ERR_INTERNET_DISCONNECTED') || text.includes('net::ERR_')) return;
        consoleErrors.push(text);
      }
    });

    await page.route('**/*open-meteo.com/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ daily: { temperature_2m_max: [75], precipitation_sum: [0] } })
    }));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Check Sausage Tracker Interactions
    await page.click('#tab-btn-sausage');
    await page.waitForTimeout(200);

    // Click recipe pills if present
    const recipePills = await page.$$('#recipe-pills .recipe-pill');
    for (const pill of recipePills.slice(0, 3)) {
      await pill.click();
      await page.waitForTimeout(150);
    }

    // 2. Switch to Forecasting Analytics Tab
    await page.click('#tab-btn-forecasting');
    await page.waitForTimeout(300);

    // 3. Cycle through all forecasting subtabs
    const subtabs = [
      '#btn-subtab-predictive',
      '#btn-subtab-arima',
      '#btn-subtab-weather',
      '#btn-subtab-event',
      '#btn-subtab-shift',
      '#btn-subtab-advanced'
    ];

    for (const subtabId of subtabs) {
      const subtab = page.locator(subtabId);
      if (await subtab.isVisible()) {
        await subtab.click();
        await page.waitForTimeout(250);
      }
    }

    // Return to ARIMA subtab for category filtering
    await page.click('#btn-subtab-arima');
    await page.waitForTimeout(200);

    // 4. Test Category Selector options
    const categorySelector = page.locator('#category-selector');
    if (await categorySelector.isVisible()) {
      for (const cat of ['turkey_lbs', 'brisket_lbs', 'pulled_pork_lbs', 'sausage_links', 'pork_ribs_racks', 'beef_dino_ribs']) {
        await categorySelector.selectOption(cat);
        await page.waitForTimeout(150);
      }
    }

    // 5. Test Quick Presets
    const presets = [
      '#btn-preset-weekend',
      '#btn-preset-thursday',
      '#btn-preset-friday',
      '#btn-preset-saturday',
      '#btn-preset-7',
      '#btn-preset-14',
      '#btn-preset-30'
    ];

    for (const presetId of presets) {
      const preset = page.locator(presetId);
      if (await preset.isVisible()) {
        await preset.click();
        await page.waitForTimeout(150);
      }
    }

    // 6. Assert zero page errors and zero console errors
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(', ')}`).toHaveLength(0);
    expect(consoleErrors, `Console errors: ${consoleErrors.join(', ')}`).toHaveLength(0);
  });

});
