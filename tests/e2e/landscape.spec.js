const { test, expect } = require('@playwright/test');

// A phone held sideways: 844x390, touch screen.
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test.describe('Landscape phone', () => {
  test('charts stay scroll-safe, fit the short screen, and nothing overflows sideways', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#tab-btn-forecasting').click();
    await page.waitForTimeout(600);

    expect(await page.evaluate(() => window.isLandscapePhone())).toBe(true);
    expect(await page.evaluate(() => window.isMobileViewport())).toBe(true);

    const charts = { predictive: 'plotly-predictive-velocity-chart', weather: 'plotly-weather-impact-chart', event: 'plotly-event-impact-chart', advanced: 'plotly-sellout-chart' };
    for (const [sub, id] of Object.entries(charts)) {
      await page.locator('#btn-subtab-' + sub).click();
      await page.waitForTimeout(700);
      const info = await page.evaluate(chartId => {
        const el = document.getElementById(chartId);
        const card = el.closest('.chart-card') || el.parentElement;
        const svg = el.querySelector('svg.main-svg').getBoundingClientRect();
        return {
          pointer: getComputedStyle(el).pointerEvents,
          touch: getComputedStyle(el).touchAction,
          h: Math.round(el.getBoundingClientRect().height),
          overflow: svg.bottom - card.getBoundingClientRect().bottom,
          badges: !!card.querySelector(':scope > .mobile-chart-face-badges') && getComputedStyle(card.querySelector(':scope > .mobile-chart-face-badges')).display !== 'none'
        };
      }, id);
      expect(info.pointer, id).toBe('none');
      expect(info.touch, id).toBe('pan-y');
      expect(info.h, id + ' fits the short screen').toBeLessThanOrEqual(300);
      expect(info.overflow, id + ' clipped by card').toBeLessThanOrEqual(2);
      expect(info.badges, id + ' Peak/Low/Now strip visible').toBe(true);
    }

    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sideways).toBeLessThanOrEqual(1);
    for (const sel of ['#tab-btn-sausage', '#tab-btn-forecasting']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.height, sel + ' tap target').toBeGreaterThanOrEqual(48);
    }
    expect(errors).toEqual([]);
  });
});
