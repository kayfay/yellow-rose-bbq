const { test, expect } = require('@playwright/test');

test.describe('v2.0.0 Facelift: Mobile-First Ergonomics, Touch-Safe Charts & Debug Harness', () => {

  test('Mobile Viewport (< 768px): Sticky bottom nav switches tabs & charts enforce non-interactive touch-safe invariant', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // 1. Verify v2.0.0 badge and sticky mobile bottom navigation bar
    await expect(page.locator('.version-badge')).toContainText('v2.0.0');
    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();

    const navPrepBtn = page.locator('.mobile-bottom-nav-btn[data-tab="sausage-tracker"]');
    const navForecastBtn = page.locator('.mobile-bottom-nav-btn[data-tab="forecasting-analytics"]');

    // Verify ergonomic touch target height (>= 44px)
    const navBox = await navForecastBtn.boundingBox();
    expect(navBox.height).toBeGreaterThanOrEqual(44);

    // Switch to Analytics via mobile bottom navigation bar
    await navForecastBtn.click();
    await expect(navForecastBtn).toHaveClass(/active/);
    await expect(page.locator('#tab-forecasting-analytics')).toHaveClass(/active/);

    // Wait for charts to render
    await expect(page.locator('#kpi-brisket-lbs')).not.toHaveText('--', { timeout: 10000 });
    await expect(page.locator('#plotly-predictive-velocity-chart')).toBeVisible();

    // Switch subtab to render ARIMA / D3 meat sales chart too
    await page.click('#btn-subtab-arima');
    await expect(page.locator('#plotly-meat-sales-chart svg').first()).toBeVisible({ timeout: 15000 });

    // Verify strict mobile non-interactive chart invariant (< 768px)
    const chartSelectors = [
      '#plotly-predictive-velocity-chart',
      '#plotly-shift-heatmap',
      '#plotly-meat-sales-chart'
    ];

    for (const selector of chartSelectors) {
      const attr = await page.locator(selector).getAttribute('data-mobile-static');
      expect(attr).toBe('true');

      const styles = await page.locator(selector).evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          pointerEvents: computed.pointerEvents,
          touchAction: computed.touchAction
        };
      });
      expect(styles.pointerEvents).toBe('none');
      expect(styles.touchAction).toBe('pan-y');
    }

    // Switch back to Prep tab via mobile bottom nav
    await navPrepBtn.click();
    await expect(navPrepBtn).toHaveClass(/active/);
    await expect(page.locator('#tab-sausage-tracker')).toHaveClass(/active/);
  });

  test('Design Token & Viewport Debug Drawer: Simulates mobile width and exports v2.0.0 JSON tokens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const toggleBtn = page.locator('#btn-toggle-debug-drawer');
    const drawer = page.locator('#design-debug-drawer');

    await expect(drawer).toBeHidden();
    await toggleBtn.click();
    await expect(drawer).toBeVisible();

    // Simulate 375px mobile width via debug drawer preset
    await page.click('.debug-vp-btn[data-vp="375"]');
    const simAttr = await page.locator('body').getAttribute('data-preview-vp');
    expect(simAttr).toBe('375');

    // Toggle high-contrast light mode and back
    await page.click('#btn-debug-contrast');
    await expect(page.locator('body')).toHaveClass(/pit-high-contrast/);
    await page.click('#btn-debug-contrast');

    // Copy Settings as JSON and verify exported schema
    await page.click('#btn-copy-debug-tokens');
    const exportedTokens = await page.evaluate(() => window.__LAST_COPIED_DESIGN_TOKENS__);
    expect(exportedTokens).toBeTruthy();
    expect(exportedTokens.version).toBe('2.0.0');
    expect(exportedTokens.tokens.touchTargetMinPx).toBe(48);
  });

  test('Sausage Recipe Math Parity: Link estimates and Day 2 checklist verification match across recipes', async ({ page }) => {
    await page.goto('/');

    for (const recipeKey of ['jalapeno-cheddar', 'classic-beef', 'mild-sausage']) {
      await page.click(`.recipe-pill[data-recipe="${recipeKey}"]`);
      const expectedLinks = await page.locator('#est-links-expected').textContent();
      const verifLinks = await page.locator('#verif-yield-links').textContent();
      expect(expectedLinks).toBe(verifLinks);
      expect(Number(expectedLinks)).toBeGreaterThan(0);
    }

    // Verify Classic Beef displays custom Step 9 and Step 11 (no jalapeño/cheese mention) and curing salt weight > 0
    await page.click('.recipe-pill[data-recipe="classic-beef"]');
    const curingText = await page.locator('#verif-cure').textContent();
    expect(curingText).toContain('60 g');
    const step9Text = await page.locator('.task-row[data-step="9"] .task-content p').textContent();
    expect(step9Text.toLowerCase()).not.toContain('jalapeño');
    const step11Text = await page.locator('.task-row[data-step="11"] .task-content p').textContent();
    expect(step11Text).toContain('Fold in powdered milk and ice water until sticky.');
  });

});
