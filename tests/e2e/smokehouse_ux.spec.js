const { test, expect } = require('@playwright/test');

test.describe('Smokehouse UX Overhaul (v2.2.0) — Plain English, Case/Cut Units, Black Square Fix & Cushion Strip', () => {
  test('renders plain-English copywriting, KitchenQuantityDisplay case/cut badges, unit mode toggle, and zero black voids', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Switch to POS Analytics & Forecasting tab
    await page.locator('#tab-btn-forecasting').click();
    await expect(page.locator('#tab-forecasting-analytics')).toBeVisible();

    // Select an active open operating day (Saturday) so meat prep targets are > 0
    await page.locator('#btn-preset-saturday').click();

    // 1. Verify Plain-English Smokehouse Copywriting (Zero banned statistical jargon)
    await expect(page.locator('.model-eval-title')).toContainText('Cook Accuracy Audit');
    await expect(page.locator('#model-eval-body .audit-plain-takeaway')).toBeVisible();
    await expect(page.locator('#model-eval-body .audit-plain-takeaway')).toContainText('Takeaway:');

    const bodyText = (await page.locator('#tab-forecasting-analytics').innerText()).toLowerCase();
    expect(bodyText).not.toContain('multimeatforecaster');
    expect(bodyText).not.toContain('safety buffer');
    expect(bodyText).not.toContain('model evaluation');
    expect(bodyText).not.toContain('model variance pacing');
    expect(bodyText).not.toContain('total day variance');
    for (const term of ['velocity', 'variance', 'z-score', 'sigma', 'cogs', 'dow base', 'buffer margin']) {
      expect(bodyText).not.toContain(term);
    }

    // 2. Verify KitchenQuantityDisplay renders primary Case & Individual Cut Counts
    const brisketPrimary = page.locator('#kpi-card-brisket-container .kitchen-qty-primary');
    await expect(brisketPrimary).toBeVisible();
    await expect(brisketPrimary).toContainText(/^~\d+ Briskets?$/i);
    const brisketDisplay = page.locator('#kpi-card-brisket-container .kitchen-qty-display');
    await expect(brisketDisplay).toContainText(/Raw \d+ lbs/i);
    await expect(brisketDisplay).toContainText(/Cases?/i);
    await expect(brisketDisplay).toContainText(/Cooked \d+ lbs/i);
    // Piece count is the large number: bigger than the muted rows
    const sizes = await page.evaluate(() => {
      const d = document.querySelector('#kpi-card-brisket-container .kitchen-qty-display');
      return [parseFloat(getComputedStyle(d.querySelector('.kitchen-qty-primary')).fontSize), parseFloat(getComputedStyle(d.querySelector('.kitchen-qty-secondary')).fontSize)];
    });
    expect(sizes[0]).toBeGreaterThan(sizes[1] * 1.5);

    const porkPrimary = page.locator('#kpi-card-pork-container .kitchen-qty-primary');
    await expect(porkPrimary).toBeVisible();
    await expect(porkPrimary).toContainText(/Butt/i);

    const ribsPrimary = page.locator('#kpi-card-ribs-container .kitchen-qty-primary');
    await expect(ribsPrimary).toBeVisible();
    await expect(ribsPrimary).toContainText(/Rack/i);
    await expect(page.locator('#kpi-card-ribs-container .kitchen-qty-display')).toContainText(/Case/i);

    // 3. Verify Unit Conversion Math via global formatKitchenQuantity
    const unitMath = await page.evaluate(() => {
      return {
        brisket140: window.formatKitchenQuantity('brisket', 140, 'case'),
        pork64: window.formatKitchenQuantity('pork', 64, 'case'),
        ribs12: window.formatKitchenQuantity('pork_ribs', 12, 'case'),
        dino24: window.formatKitchenQuantity('dino_ribs', 24, 'case'),
        sausage120: window.formatKitchenQuantity('sausage', 120, 'case')
      };
    });
    expect(unitMath.brisket140.cases).toBe(1.7);   // 140 / 82 lb per invoice case
    expect(unitMath.brisket140.cuts).toBe(9);      // ceil(140 / 16.4 lb per brisket)
    expect(unitMath.brisket140.cookedLbs).toBe(49); // 140 * 0.35 yield (5.75 lbs / 16.4 lb packer)
    expect(unitMath.pork64.cases).toBe(2);
    expect(unitMath.pork64.cuts).toBe(8);
    expect(unitMath.pork64.cookedLbs).toBe(28);
    expect(unitMath.ribs12.cases).toBe(2);
    expect(unitMath.ribs12.cuts).toBe(12);
    expect(unitMath.dino24.cases).toBe(2);
    expect(unitMath.dino24.cuts).toBe(24);
    expect(unitMath.sausage120.cases).toBe(2);
    expect(unitMath.sausage120.cuts).toBe(360);

    // 4. Verify UI & Viewport Controls Debug Toggle (Case & Cut View <-> Raw Lbs View) + Copy Settings as JSON
    await page.locator('#btn-toggle-debug-drawer').click();
    const unitModeBtn = page.locator('#btn-debug-unit-mode');
    await expect(unitModeBtn).toBeVisible();
    await expect(unitModeBtn).toContainText('Units: Counts');

    await unitModeBtn.click();
    await expect(unitModeBtn).toContainText('Units: Lbs');
    await expect(page.locator('body')).toHaveAttribute('data-unit-mode', 'lbs');
    await expect(brisketPrimary).toContainText(/lbs Raw/i);

    // Export JSON tokens and verify unitDisplayMode is serialized
    await page.locator('#btn-copy-debug-tokens').click();
    const exportedMode = await page.evaluate(() => window.__LAST_COPIED_DESIGN_TOKENS__?.unitDisplayMode);
    expect(exportedMode).toBe('lbs');

    // Toggle back to default Case & Cut View
    await unitModeBtn.click();
    await expect(page.locator('body')).toHaveAttribute('data-unit-mode', 'case');
    await page.locator('#btn-toggle-debug-drawer').click();

    // 5. Cushion strip and labor card are removed; no leftover copy; zero black void under 24-Hour chart
    await expect(page.locator('#prep-safety-margin-strip')).toHaveCount(0);
    await expect(page.locator('#kpi-card-labor-container')).toHaveCount(0);
    const copyText = await page.locator('body').innerText();
    expect(copyText).not.toMatch(/plain[- ]english/i);
    expect(copyText).not.toMatch(/extra prep|cushion|shift directives/i);

    const predChartBox = await page.locator('#plotly-predictive-velocity-chart').boundingBox();
    const predCardBox = await page.locator('#subtab-view-predictive .chart-card').first().boundingBox();
    expect(predChartBox.height).toBeGreaterThan(250);
    expect(predChartBox.height).toBeLessThanOrEqual(380);
    // Ensure chart card does not have a >100px empty black gap beneath the chart
    expect(predCardBox.height - predChartBox.height).toBeLessThan(80);

    // 6. Verify #js-plotly-tester is zero-sized and hidden
    const testerHidden = await page.evaluate(() => {
      const el = document.getElementById('js-plotly-tester');
      if (!el) return true;
      const rect = el.getBoundingClientRect();
      return rect.width === 0 && rect.height === 0;
    });
    expect(testerHidden).toBe(true);

    // 7. Verify Advanced Subtab Sell-Out Chart renders real SVG traces (never an empty black box)
    await page.locator('#btn-subtab-advanced').click();
    await expect(page.locator('#subtab-view-advanced')).toBeVisible();
    await expect(page.locator('#plotly-sellout-chart svg.main-svg').first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
