const { test, expect } = require('@playwright/test');

// Fixture: Tuesday 2026-11-03. History: $200/hour from 11 AM through 8 PM (hours 11-20), 2 sample days => $2,000 typical day.
// Today's POS: $250/hour for hours 11-14 => $1,000 so far. A simulated clock counts the cutoff hour as fully elapsed;
// the live clock counts it only for the minutes that have passed.
const run = (page, hour, withHistory = true, minute = 0, simulate = true) => page.evaluate(({ hour, withHistory, minute, simulate }) => {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales_usd: (h >= 11 && h <= hour) ? 250 : 0, orders: (h >= 11 && h <= hour) ? 5 : 0 }));
  const actuals = {
    days: { '2026-11-03': { buckets, total_orders: 20, total_sales_usd: 1000 } },
    weekday_baseline: withHistory ? {
      '1': { n: 2, sales_sum: Array.from({ length: 24 }, (_, h) => (h >= 11 && h <= 20) ? 400 : 0), orders_sum: Array(24).fill(0) }
    } : {}
  };
  // Hourly forecast deliberately on a much smaller scale than the POS (the real-data failure mode).
  const recs = Array.from({ length: 24 }, (_, h) => ({ hour: h, predicted_revenue: (h >= 11 && h <= 20) ? 20 : 0, predicted_orders: 1 }));
  const now = new Date(window.ShopTime.createShopInstant('2026-11-03', hour).getTime() + minute * 60000);
  if (simulate) window.ShopTime.setSimulatedNow(now); else window.ShopTime.clearSimulatedNow();
  const out = window.ShopTime.computeBlendedDayMetrics(actuals, recs, now, '2026-11-03').summary;
  window.ShopTime.clearSimulatedNow();
  return out;
}, { hour, withHistory, minute, simulate });

test.describe('Projected Day Total and sales pace', () => {
  test('projection = POS so far + remaining-hours weight x historical day average', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const s = await run(page, 14);
    expect(s.actualSalesSoFar).toBe(1000);
    expect(s.historicalDayAvg).toBe(2000);
    expect(s.remainingHoursWeight).toBeCloseTo(0.6, 3);        // hours 15-20 = 6 of 10 busy hours
    expect(s.blendedTotalRevenue).toBeCloseTo(1000 + 0.6 * 2000, 2); // 2200
    expect(s.blendedTotalRevenue).not.toBe(s.actualSalesSoFar);
  });

  test('pace compares to what this weekday really sold by this hour, not the hourly forecast scale', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const s = await run(page, 14);
    expect(s.typicalToHour).toBe(800);       // hours 11-14 at $200
    expect(s.pacingPct).toBeCloseTo(25, 1);  // 1000 vs 800
    expect(s.pacingUsd).toBe(200);
  });

  test('after close the projection settles on actual sales; without history it falls back to the forecast', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const late = await run(page, 22);
    expect(late.remainingHoursWeight).toBe(0);
    expect(late.blendedTotalRevenue).toBe(late.actualSalesSoFar);
    const noHistory = await run(page, 14, false);
    expect(noHistory.historicalDayAvg).toBeNull();
    expect(noHistory.blendedTotalRevenue).toBeCloseTo(noHistory.actualSalesSoFar + noHistory.forecastRemaining, 2);
  });

  test('live clock counts the current hour only for the minutes elapsed (2:30 PM = half of the 2 PM hour)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const s = await run(page, 14, true, 30, false);
    expect(s.typicalToHour).toBeCloseTo(700, 2);                 // hours 11-13 ($600) + half of hour 14 ($100)
    expect(s.remainingHoursWeight).toBeCloseTo(0.65, 3);         // half of hour 14 + hours 15-20 = $1,300 of $2,000
    expect(s.blendedTotalRevenue).toBeCloseTo(1000 + 1300, 2);
    expect(s.pacingPct).toBeCloseTo(42.9, 1);                    // 1000 vs 700
  });

  test('Monday (closed) never projects a total from history, even when time travelling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const s = await page.evaluate(() => {
      const base = { n: 5, sales_sum: Array.from({ length: 24 }, (_, h) => (h >= 11 && h <= 20) ? 500 : 0), orders_sum: Array(24).fill(0) };
      const actuals = { days: {}, weekday_baseline: { '0': base } };
      const recs = Array.from({ length: 24 }, (_, h) => ({ hour: h, predicted_revenue: 0, predicted_orders: 0 }));
      const now = window.ShopTime.createShopInstant('2026-11-02', 14); // a Monday
      window.ShopTime.setSimulatedNow(now);
      const out = window.ShopTime.computeBlendedDayMetrics(actuals, recs, now, '2026-11-02').summary;
      window.ShopTime.clearSimulatedNow();
      return out;
    });
    expect(s.historicalDayAvg).toBeNull();
    expect(s.blendedTotalRevenue).toBe(s.actualSalesSoFar + s.forecastRemaining);
    expect(s.blendedTotalRevenue).toBe(0);
  });
});
