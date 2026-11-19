const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:8013';

test.describe('Full COGS Card & Adjacent Layout', () => {
  test('renders Full COGS Card adjacent to Est. Meat Cost Card on desktop with zero console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.click('#tab-btn-forecasting');

    const meatCard = page.locator('#kpi-card-food-cost-container');
    const fullCard = page.locator('#kpi-card-full-cogs-container');

    await expect(meatCard).toBeVisible();
    await expect(fullCard).toBeVisible();

    const meatBox = await meatCard.boundingBox();
    const fullBox = await fullCard.boundingBox();
    expect(meatBox).not.toBeNull();
    expect(fullBox).not.toBeNull();

    // Adjacent side-by-side on desktop: same row (top within 20px), full card to the right of meat card
    expect(Math.abs(meatBox.y - fullBox.y)).toBeLessThan(20);
    expect(fullBox.x).toBeGreaterThan(meatBox.x + meatBox.width - 10);

    // Toggle between Meat Only and Full COGS
    const btnMeat = page.locator('#btn-cost-view-meat');
    const btnFull = page.locator('#btn-cost-view-full');
    await expect(btnMeat).toBeVisible();
    await expect(btnFull).toBeVisible();

    await btnMeat.click();
    await expect(fullCard).toHaveAttribute('data-cost-view', 'meat');
    await btnFull.click();
    await expect(fullCard).toHaveAttribute('data-cost-view', 'full');

    // No NaN or Infinity in card text
    const fullText = await fullCard.innerText();
    expect(fullText).not.toMatch(/NaN|Infinity/i);

    expect(consoleErrors).toEqual([]);
  });

  test('stacks vertically on mobile (< 768px) with >= 48px tap targets and zero horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.click('.mobile-bottom-nav-btn[data-tab="forecasting-analytics"]');

    const meatCard = page.locator('#kpi-card-food-cost-container');
    const fullCard = page.locator('#kpi-card-full-cogs-container');
    await expect(meatCard).toBeVisible();
    await expect(fullCard).toBeVisible();

    const meatBox = await meatCard.boundingBox();
    const fullBox = await fullCard.boundingBox();
    expect(fullBox.y).toBeGreaterThan(meatBox.y + meatBox.height - 10);

    // Check tap target height >= 48px
    const btnBox = await page.locator('#btn-cost-view-full').boundingBox();
    expect(btnBox.height).toBeGreaterThanOrEqual(48);

    // No horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });
});
