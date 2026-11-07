const { test, expect } = require('@playwright/test');

test.describe('Subtab summary cards use live data', () => {
  test('every live card is filled, the old frozen numbers are gone, and values trace to the payloads', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#tab-btn-forecasting').click();
    await page.waitForTimeout(500);

    const cards = await page.evaluate(() => [...document.querySelectorAll('[data-stat]')].map(el => ({
      key: el.dataset.stat,
      kicker: el.querySelector('.subtab-stat-kicker').textContent,
      val: el.querySelector('.subtab-stat-val').textContent,
      sub: el.querySelector('.subtab-stat-sub').textContent
    })));
    expect(cards.length).toBe(17);
    for (const c of cards) {
      expect(c.kicker, c.key).not.toBe('--');
      expect(c.sub, c.key).not.toContain('Loading');
      expect(`${c.val} ${c.sub}`, c.key).not.toMatch(/NaN|undefined|Infinity/);
    }
    // Event/dino/rain cards come from payloads that exist, so they must show real values, not '--'.
    for (const key of ['rain-days', 'jags', 'dino-shift', 'channel-aov', 'peak-hour', 'open-day-avg']) {
      expect(cards.find(c => c.key === key).val, key).not.toBe('--');
    }

    // Values must match the payloads exactly (no typed-in numbers).
    const check = await page.evaluate(() => {
      const P = window.BBQ_PAYLOADS;
      const cn = P.advanced_payload.cannibalization;
      const es = P.event_payload.event_stats;
      const val = k => document.querySelector(`[data-stat="${k}"] .subtab-stat-val`).textContent;
      const pct = (v, ref) => ((v - ref) / ref >= 0 ? '+' : '') + (Math.round((v - ref) / ref * 1000) / 10) + '%';
      return { dino: val('dino-shift'), dinoExpected: `${cn.impact_pct > 0 ? '+' : ''}${cn.impact_pct}% Pork Ribs`, jags: val('jags'), jagsExpected: (es.jags_multiplier >= 1 ? '+' : '') + (Math.round((es.jags_multiplier - 1) * 1000) / 10) + '%' };
    });
    expect(check.dino).toBe(check.dinoExpected);
    expect(check.jags).toBe(check.jagsExpected);

    // Explainer lines under each subtab use the same payload numbers (no typed-in values).
    const lines = await page.evaluate(() => [...document.querySelectorAll('[id^="live-"]')].map(el => [el.id, el.textContent.trim()]));
    expect(lines.length).toBeGreaterThanOrEqual(11);
    for (const [id, text] of lines) {
      expect(text, id).not.toMatch(/Loading|NaN|undefined/);
      expect(text.length, id).toBeGreaterThan(8);
    }
    const rain = await page.evaluate(() => {
      const ws = window.BBQ_PAYLOADS.weather_payload.weather_stats;
      return { text: document.getElementById('live-rain-line').textContent, rain: Math.round(ws.rain_avg_usd).toLocaleString(), normal: Math.round(ws.normal_avg_usd).toLocaleString() };
    });
    expect(rain.text).toContain('$' + rain.rain);
    expect(rain.text).toContain('$' + rain.normal);

    const text = await page.locator('body').innerText();
    for (const stale of ['+$97.37', '3.5x (~$17.4k)', '5.0x Peak Surge', '~$2,330 / day', '~$13.8k Sales', '-37% Pork Ribs']) {
      expect(text).not.toContain(stale);
    }
    expect(errors).toEqual([]);
  });
});
