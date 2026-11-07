const { test, expect } = require('@playwright/test');

async function openForecasting(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('#tab-btn-forecasting').click();
  await page.waitForTimeout(300);
}

test.describe('Slider touch safety and hourly chart rendering', () => {
  test('time-travel and weight sliders allow vertical page scroll; drag ticks do not commit', async ({ page }) => {
    await openForecasting(page);
    const touchAction = await page.evaluate(() => ({
      time: getComputedStyle(document.getElementById('time-travel-slider')).touchAction,
      weight: getComputedStyle(document.getElementById('weight-slider')).touchAction
    }));
    expect(touchAction.time).toBe('pan-y');
    expect(touchAction.weight).toBe('pan-y');

    // An 'input' tick alone (mid-drag) must not move the simulated clock; 'change' (release) commits.
    await page.locator('#btn-subtab-predictive').click();
    await page.evaluate(() => {
      const s = document.getElementById('time-travel-slider');
      s.value = '17';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    await expect(page.locator('#time-travel-badge')).toContainText('Live America/New_York');
    await page.evaluate(() => {
      document.getElementById('time-travel-slider').dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await expect(page.locator('#time-travel-badge')).toContainText('5:00 PM EST');
  });

  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    test(`every analytics chart has real size after its subtab opens (${vp.width}px)`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setViewportSize(vp);
      await openForecasting(page);
      const charts = {
        predictive: 'plotly-predictive-velocity-chart',
        arima: 'plotly-meat-sales-chart',
        shift: 'plotly-shift-heatmap',
        weather: 'plotly-weather-impact-chart',
        event: 'plotly-event-impact-chart',
        advanced: 'plotly-sellout-chart'
      };
      for (const [sub, id] of Object.entries(charts)) {
        await page.locator('#btn-subtab-' + sub).click();
        await page.waitForTimeout(700);
        const box = await page.locator('#' + id).boundingBox();
        expect(box, id).not.toBeNull();
        expect(box.height, id + ' height').toBeGreaterThan(200);
        expect(box.width, id + ' width').toBeGreaterThan(200);
        await expect(page.locator('#' + id + ' svg').first(), id + ' drawn').toBeAttached();
        // The plot must sit fully inside its card (a collapsed plot wrapper once pushed it below the card edge, leaving it blank).
        if (['predictive', 'weather', 'event', 'advanced'].includes(sub)) {
          const clipped = await page.evaluate(chartId => {
            const el = document.getElementById(chartId);
            const card = el.closest('.chart-card') || el.parentElement;
            const svg = el.querySelector('svg.main-svg').getBoundingClientRect();
            return svg.bottom - card.getBoundingClientRect().bottom;
          }, id);
          expect(clipped, id + ' plot overflows its card by px').toBeLessThanOrEqual(2);
        }
      }
      expect(errors).toEqual([]);
    });
  }
});
