// Captures the predictive-fix milestone screenshots into assets/screenshots/fix_*.png (new files only;
// never overwrites the v2_* gallery). Usage: node scripts/capture_predictive_fix_gallery.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'screenshots');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

function serve(port) {
  const server = http.createServer((req, res) => {
    const rel = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || /(^|\/)\./.test(rel) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await serve(8125);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [tag, vp, touch] of [['desktop', { width: 1280, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
      const ctx = await browser.newContext({ viewport: vp, hasTouch: touch });
      const page = await ctx.newPage();
      await page.goto('http://127.0.0.1:8125/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('tab-btn-forecasting').click());
      await page.waitForTimeout(900);
      await page.evaluate(() => { const d = document.getElementById('forecast-start-date'); d.value = '2026-11-07'; d.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(900);

      const tiles = page.locator('#kpi-card-brisket-container').locator('xpath=..');
      await tiles.scrollIntoViewIfNeeded();
      await tiles.screenshot({ path: path.join(OUT_DIR, `fix_${tag}_meat_tiles.png`) });

      await page.locator('#btn-subtab-predictive').click();
      const chart = page.locator('#plotly-predictive-velocity-chart');
      await chart.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.locator('#subtab-view-predictive .chart-card').first().screenshot({ path: path.join(OUT_DIR, `fix_${tag}_hourly_chart.png`) });

      const slider = page.locator('#time-travel-control-card');
      await slider.scrollIntoViewIfNeeded();
      await slider.screenshot({ path: path.join(OUT_DIR, `fix_${tag}_slider.png`) });

      await page.locator('#btn-subtab-advanced').click();
      await page.waitForTimeout(500);
      await page.locator('#subtab-view-advanced .subtab-stat-strip').screenshot({ path: path.join(OUT_DIR, `fix_${tag}_stat_cards.png`) });
      await ctx.close();
    }
    console.log('Captured 8 predictive-fix screenshots in assets/screenshots/');
  } finally {
    await browser.close();
    server.close();
  }
})();
