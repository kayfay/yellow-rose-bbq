const { test, expect } = require('@playwright/test');

test.describe('Real-Time Predictive-to-Historical POS Turnover & Simulation Suite', () => {

  test('Time-travel simulation scrubbing correctly triggers hourly turnover and blended KPI updates', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Navigate to Forecasting Analytics tab
    const forecastTabBtn = page.locator('#tab-btn-forecasting');
    await expect(forecastTabBtn).toBeVisible();
    await forecastTabBtn.click();
    await page.waitForTimeout(300);

    // 2. Verify Time-Travel Simulator controls are present
    const simBar = page.locator('#time-travel-control-card');
    await expect(simBar).toBeVisible();
    const simSlider = page.locator('#time-travel-slider');
    await expect(simSlider).toBeVisible();
    const simBadge = page.locator('#time-travel-badge');
    await expect(simBadge).toContainText('Live America/New_York');

    // 3. Open Hourly Operations & Economics subtab
    const btnPredictive = page.locator('#btn-subtab-predictive');
    await btnPredictive.click();
    await page.waitForTimeout(400);

    // 4. Verify Hourly Turnover Deck is rendered
    const turnoverDeck = page.locator('#hourly-turnover-deck');
    await expect(turnoverDeck).toBeVisible();

    const turnoverCards = page.locator('#hourly-turnover-deck .turnover-card');
    const initialCardCount = await turnoverCards.count();
    expect(initialCardCount).toBeGreaterThanOrEqual(10); // 11 AM - 9 PM operating hours = 11 cards

    // 5. Test Quick Simulation Preset: 8:00 PM Post-Rush Turnover (#sim-btn-postrush)
    const btnPostRush = page.locator('#sim-btn-postrush');
    await expect(btnPostRush).toBeVisible();
    await btnPostRush.click();
    await page.waitForTimeout(400);

    // Badge should now indicate simulation mode at 8:00 PM
    await expect(simBadge).toContainText('Simulated: 8:00 PM ET');

    // Hour 19 (7:00 PM) must have flipped to 'POS Actual'
    const card7pm = page.locator('#hourly-turnover-deck .turnover-card[data-hour="19"]');
    await expect(card7pm).toBeVisible();
    await expect(card7pm).toHaveClass(/card-actual/);
    const badge7pm = card7pm.locator('.turnover-badge');
    await expect(badge7pm).toContainText('POS Actual');

    // Hour 20 (8:00 PM) should have badge 'Live Pacing'
    const card8pm = page.locator('#hourly-turnover-deck .turnover-card[data-hour="20"]');
    await expect(card8pm).toBeVisible();
    await expect(card8pm).toHaveClass(/card-live/);
    const badge8pm = card8pm.locator('.turnover-badge');
    await expect(badge8pm).toContainText('Live Pacing');

    // Hour 21 (9:00 PM) should remain 'Projected'
    const card9pm = page.locator('#hourly-turnover-deck .turnover-card[data-hour="21"]');
    await expect(card9pm).toBeVisible();
    await expect(card9pm).toHaveClass(/card-predicted/);
    const badge9pm = card9pm.locator('.turnover-badge');
    await expect(badge9pm).toContainText('Projected');

    // Assert blended live total pills across all top-shelf KPI summary cards
    const pillRevenue = page.locator('#kpi-revenue-blended-sub');
    const pillBrisket = page.locator('#kpi-brisket-blended-sub');
    const pillPork = page.locator('#kpi-pork-blended-sub');
    const pillSausage = page.locator('#kpi-sausage-blended-sub');
    const pillFoodCost = page.locator('#kpi-food-cost-blended-sub');
    const pillVelocity = page.locator('#kpi-velocity-blended-sub');
    const pillAov = page.locator('#kpi-aov-blended-sub');
    const pillLabor = page.locator('#kpi-labor-blended-sub');
    const pillRosebuds = page.locator('#kpi-rosebuds-blended-sub');
    const subBrisket = page.locator('#kpi-brisket-cooked');
    const subRosebuds = page.locator('#kpi-rosebuds-sub');

    await expect(pillRevenue).toBeVisible();
    await expect(pillRevenue).toContainText('Blended Live Total');
    await expect(pillBrisket).toBeVisible();
    await expect(pillBrisket).toContainText('actual drawn');
    await expect(subBrisket).toContainText('actual sold');
    await expect(pillPork).toBeVisible();
    await expect(pillPork).toContainText('actual drawn');
    await expect(pillSausage).toBeVisible();
    await expect(pillSausage).toContainText('actual links sold');
    await expect(pillRosebuds).toBeVisible();
    await expect(pillRosebuds).toContainText('actual sold');
    await expect(subRosebuds).toContainText('actual sold');
    await expect(pillFoodCost).toBeVisible();
    await expect(pillFoodCost).toContainText('Blended Live COGS');
    await expect(pillVelocity).toBeVisible();
    await expect(pillVelocity).toContainText('Blended Velocity');
    await expect(pillAov).toBeVisible();
    await expect(pillAov).toContainText('Blended Live Ticket');
    await expect(pillLabor).toBeVisible();
    await expect(pillLabor).toContainText('Blended Shift Hours');

    // 6. Test Quick Preset: Reset to Live (#sim-btn-reset)
    const btnReset = page.locator('#sim-btn-reset');
    await btnReset.click();
    await page.waitForTimeout(300);
    await expect(simBadge).toContainText('Live America/New_York');

    // 7. Test Filter Toggle: All 24 Hours vs Smokehouse Hours
    const btnAllHours = page.locator('#btn-turnover-all');
    await btnAllHours.click();
    await page.waitForTimeout(300);
    const allCardsCount = await page.locator('#hourly-turnover-deck .turnover-card').count();
    expect(allCardsCount).toBe(24);

    const btnOperating = page.locator('#btn-turnover-operating');
    await btnOperating.click();
    await page.waitForTimeout(300);
    const operatingCardsCount = await page.locator('#hourly-turnover-deck .turnover-card').count();
    expect(operatingCardsCount).toBe(11); // 11 AM through 9 PM inclusive

    // 8. Test 14-Day Outlook Preset (#btn-preset-14)
    const btn14 = page.locator('#btn-preset-14');
    await btn14.click();
    await page.waitForTimeout(400);

    // Multi-day range should hide individual single-day blended pills
    await expect(pillBrisket).toBeHidden();
    await expect(pillFoodCost).toBeHidden();

    // Top-shelf Revenue KPI card should be visible with non-zero revenue
    const kpiRevenue = page.locator('#kpi-projected-revenue');
    await expect(kpiRevenue).toBeVisible();
    const revText = await kpiRevenue.textContent();
    expect(revText).toMatch(/\$[0-9,]+/);

    // 9. Assert zero uncaught exceptions and zero console errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

});
