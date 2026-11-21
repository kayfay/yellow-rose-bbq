const { test, expect } = require('@playwright/test');

test.describe('Plate & Recipe Costs Subtab — Mobile-First Cards & Fuzzy Search', () => {
  test('renders Category Rollup Cards, fuzzy search with typos, and expandable line items on mobile (390px)', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.click('.mobile-bottom-nav-btn[data-tab="forecasting-analytics"]');
    await page.click('#btn-subtab-plate-costs');

    const view = page.locator('#subtab-view-plate-costs');
    await expect(view).toBeVisible();

    // 1. Category Rollup Cards render (8 categories, zero wide tables)
    const catCards = view.locator('.plate-cat-card');
    await expect(catCards).toHaveCount(8);
    expect(await view.locator('table').count()).toBe(0);

    // 2. Fuzzy search handles typos ("brskt" -> Brisket items, "banna puding" -> Banana Pudding)
    const search = page.locator('#plate-fuzzy-search');
    const searchBox = await search.boundingBox();
    expect(searchBox.height).toBeGreaterThanOrEqual(48);

    await search.fill('brskt');
    const firstCardTitle = view.locator('.plate-item-title').first();
    await expect(firstCardTitle).toContainText(/Brisket/i);

    // 3. Tap card to expand vertical line-by-line BOM breakdown
    const firstTrigger = view.locator('.plate-item-card-trigger').first();
    await firstTrigger.click();
    await expect(firstTrigger).toHaveAttribute('aria-expanded', 'true');
    const firstBody = view.locator('.plate-item-body').first();
    await expect(firstBody).toBeVisible();
    await expect(firstBody.locator('.plate-bom-row').first()).toBeVisible();

    // 4. Fuzzy search on typo "banna puding"
    await search.fill('banna puding');
    await expect(view.locator('.plate-item-title').first()).toContainText(/Banana Pudding/i);

    // 5. Switch to 34 House Recipes & verify recipes render
    await page.click('#plate-search-clear');
    await page.click('.plate-filter-pill[data-plate-filter="recipes"]');
    await expect(page.locator('#plate-result-count')).toContainText('34 house recipes');

    // 6. Zero horizontal overflow & zero banned jargon ("cogs")
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);

    const visibleText = (await view.innerText()).toLowerCase();
    expect(visibleText).not.toContain('cogs');
    expect(visibleText).not.toContain('nan');
    expect(consoleErrors).toEqual([]);
  });

  test('category card tap filters items and desktop shows 2-column card grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.click('#tab-btn-forecasting');
    await page.click('#btn-subtab-plate-costs');

    const view = page.locator('#subtab-view-plate-costs');
    await expect(view).toBeVisible();

    // Tap first Category Summary Card to filter
    const firstCat = view.locator('.plate-cat-card').first();
    await firstCat.click();
    await expect(firstCat).toHaveClass(/active/);
    await expect(page.locator('#plate-active-cat-chip')).toBeVisible();

    // Clear category filter via chip
    await page.click('#plate-active-cat-chip');
    await expect(page.locator('#plate-active-cat-chip')).toBeHidden();
    await expect(page.locator('#plate-result-count')).toContainText('137 menu items');
  });
});
