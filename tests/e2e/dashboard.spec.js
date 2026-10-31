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

    // Verify model evaluation banner container is rendered
    await expect(page.locator('#kpi-model-eval-banner')).toBeVisible();
    await expect(page.locator('#model-eval-status-pill')).toBeVisible();
  });

  test('Prediction Verification: Analytics charts render', async ({ page }) => {
    await page.goto('/');
    await page.click('#tab-btn-forecasting');
    await page.click('#btn-subtab-arima');
    
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
    await page.click('#btn-subtab-arima');

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
    expect(revText.trim()).toContain('Closed');

    // Verify raw meat prep targets are 0 on closed days
    const brisketVal = await page.locator('#kpi-brisket-lbs').textContent();
    expect(brisketVal.trim()).toBe('0');

    // Verify demand label explains the closure
    const demandText = await page.locator('#kpi-demand-label').textContent();
    expect(demandText.toLowerCase()).toContain('closed');
  });

  test('Daily Pitmaster Intelligence: Random Insight, Day Summary, and 10 Watchlist Tips', async ({ page }) => {
    await page.goto('/#forecasting');
    await expect(page.locator('#tab-forecasting-analytics')).toBeVisible();
    await page.click('#btn-subtab-reports');
    await expect(page.locator('#subtab-view-reports')).toBeVisible();

    // 1. Random Insight of the Day
    const randomTextLocator = page.locator('#daily-random-insight-text');
    await expect(randomTextLocator).toBeVisible();
    const initialInsight = await randomTextLocator.textContent();
    expect(initialInsight.trim().length).toBeGreaterThan(15);

    // Re-roll button test
    const rerollBtn = page.locator('#btn-reroll-insight');
    await expect(rerollBtn).toBeVisible();
    await rerollBtn.click();
    await page.waitForTimeout(200);
    const newInsight = await randomTextLocator.textContent();
    expect(newInsight.trim().length).toBeGreaterThan(15);

    // 2. Day-Specific Tips Summary
    const daySummaryLocator = page.locator('#daily-day-tips-summary');
    await expect(daySummaryLocator).toBeVisible();
    const daySummaryText = await daySummaryLocator.textContent();
    expect(daySummaryText.trim().length).toBeGreaterThan(20);

    // Switch to Saturday preset and verify day summary updates
    await page.click('#btn-preset-saturday');
    await page.waitForTimeout(300);
    const satSummary = await daySummaryLocator.textContent();
    expect(satSummary.toLowerCase()).toContain('saturday');

    // 3. 10 Watchlist Tips (Weather, Day Dynamics, Pit Line)
    const tipCards = page.locator('#ten-tips-container .ten-tip-card');
    await expect(tipCards).toHaveCount(10);

    // Filter: Weather (should be 3)
    await page.click('#btn-filter-tips-weather');
    await page.waitForTimeout(200);
    await expect(page.locator('#ten-tips-container .ten-tip-card')).toHaveCount(3);

    // Filter: Day Dynamics (should be 3)
    await page.click('#btn-filter-tips-day');
    await page.waitForTimeout(200);
    await expect(page.locator('#ten-tips-container .ten-tip-card')).toHaveCount(3);

    // Filter: Pit Watchlist (should be 4)
    await page.click('#btn-filter-tips-pit');
    await page.waitForTimeout(200);
    await expect(page.locator('#ten-tips-container .ten-tip-card')).toHaveCount(4);

    // Filter: All (should be 10)
    await page.click('#btn-filter-tips-all');
    await page.waitForTimeout(200);
    await expect(page.locator('#ten-tips-container .ten-tip-card')).toHaveCount(10);

    // Collapse and Expand toggle test
    const collapseBtn = page.locator('#btn-toggle-tips-collapse');
    await collapseBtn.click();
    await expect(page.locator('#ten-tips-container')).toHaveClass(/collapsed/);
    await collapseBtn.click();
    await expect(page.locator('#ten-tips-container')).not.toHaveClass(/collapsed/);

    // 4. ML Data Ground Truth Citations & Interactive Term Badges
    const evidenceLocator = page.locator('#daily-random-insight-evidence');
    await expect(evidenceLocator).toBeVisible();
    const evidenceText = await evidenceLocator.textContent();
    expect(evidenceText.length).toBeGreaterThan(5);

    const proofLocator = page.locator('#daily-random-insight-proof');
    await expect(proofLocator).toBeVisible();

    const catBadgeLocator = page.locator('#daily-random-insight-cat');
    await expect(catBadgeLocator).toBeVisible();

    // Click a term pill inside the insight card to open the in-place Term Explainer Drawer
    const firstTermBtn = page.locator('#daily-random-insight-terms .term-pill-btn').first();
    if (await firstTermBtn.count() > 0) {
      await firstTermBtn.click();
      const termDrawer = page.locator('#term-explainer-drawer');
      await expect(termDrawer).toBeVisible();
      const termDef = await page.locator('#term-drawer-def').textContent();
      expect(termDef.trim().length).toBeGreaterThan(15);
      const termHelp = await page.locator('#term-drawer-help-text').textContent();
      expect(termHelp.trim().length).toBeGreaterThan(15);

      // Close drawer
      await page.click('#btn-close-term-drawer');
      await expect(termDrawer).not.toBeVisible();
    }

    // 5. Real-Time Immediate Present Quick-Wind Scan Banner
    const qwBanner = page.locator('#daily-quick-wind-banner');
    await expect(qwBanner).toBeVisible();
    await expect(page.locator('#qw-severity-badge')).toBeVisible();
    await expect(page.locator('#qw-headline')).toBeVisible();

    const presentStatus = await page.locator('#qw-present-text').textContent();
    expect(presentStatus.trim().length).toBeGreaterThan(15);

    const causeText = await page.locator('#qw-cause-text').textContent();
    expect(causeText.trim().length).toBeGreaterThan(15);

    const actionText = await page.locator('#qw-action-text').textContent();
    expect(actionText.trim().length).toBeGreaterThan(15);

    // Verify velocity metrics bar has pills
    const metricPills = page.locator('#qw-metrics-bar .qw-metric-pill');
    expect(await metricPills.count()).toBeGreaterThanOrEqual(2);

    // Toggle recent alerts drawer
    const recentAlertsToggle = page.locator('#btn-toggle-recent-alerts');
    await recentAlertsToggle.click();
    await expect(page.locator('#qw-recent-alerts-drawer')).toBeVisible();
    await recentAlertsToggle.click();
    await expect(page.locator('#qw-recent-alerts-drawer')).not.toBeVisible();

    // 6. Pitmaster Analytics Glossary
    const glossary = page.locator('#pitmaster-analytics-glossary');
    await expect(glossary).toBeVisible();

    const glossaryCards = page.locator('#glossary-card-grid .glossary-card');
    await expect(glossaryCards).toHaveCount(9);

    // Verify card content explains "What It Means" and "How It Helps Your Pit"
    const firstCardText = await glossaryCards.first().textContent();
    expect(firstCardText).toContain('What It Means');
    expect(firstCardText).toContain('How It Helps Your Pit');

    // Filter by Profit & Costs
    await page.click('.glossary-cat-btn[data-cat="cost"]');
    await page.waitForTimeout(200);
    const costCards = page.locator('#glossary-card-grid .glossary-card');
    await expect(costCards).toHaveCount(3); // COGS, Food Cost %, Gross Margin %

    // Filter by Pit & Smoker
    await page.click('.glossary-cat-btn[data-cat="pit"]');
    await page.waitForTimeout(200);
    const pitCards = page.locator('#glossary-card-grid .glossary-card');
    await expect(pitCards).toHaveCount(4); // PAR Level, Meat Draw, Cooked Yield %, Shrinkage

    // Filter by Volume & Math
    await page.click('.glossary-cat-btn[data-cat="volume"]');
    await page.waitForTimeout(200);
    const volCards = page.locator('#glossary-card-grid .glossary-card');
    await expect(volCards).toHaveCount(2); // AOV, Z-Score

    // Reset to all
    await page.click('.glossary-cat-btn[data-cat="all"]');
    await page.waitForTimeout(200);
    await expect(page.locator('#glossary-card-grid .glossary-card')).toHaveCount(9);

    // Toggle collapse on glossary
    const toggleGlossaryBtn = page.locator('#btn-toggle-glossary');
    await toggleGlossaryBtn.click();
    await expect(page.locator('#glossary-card-grid')).toHaveClass(/collapsed/);
    await toggleGlossaryBtn.click();
    await expect(page.locator('#glossary-card-grid')).not.toHaveClass(/collapsed/);
  });

});


