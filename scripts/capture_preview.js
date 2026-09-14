const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ARTIFACT_DIR = '/home/atools/.gemini/antigravity/brain/0dc7516b-6b5c-4fd9-80cd-975bace28f0a';
const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to serve static files
function createServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.ttf': 'font/ttf',
    '.png': 'image/png'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(ROOT_DIR, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(data);
    });
  });

  return server;
}

async function main() {
  const server = createServer();
  await new Promise(resolve => server.listen(8022, '127.0.0.1', resolve));
  console.log('Capture server running on http://127.0.0.1:8022');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  // 1. Capture Main Recipe Calculator
  await page.goto('http://127.0.0.1:8022/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const mainPath = path.join(ARTIFACT_DIR, 'preview_main.png');
  await page.screenshot({ path: mainPath, fullPage: false });
  console.log('Saved main preview to:', mainPath);

  // 2. Navigate to Forecasting / Analytics tab
  await page.click('#tab-btn-forecasting');
  await page.waitForTimeout(800);

  // Click Weekend preset to show multi-day horizon aggregation
  await page.click('#btn-preset-weekend');
  await page.waitForTimeout(1000);

  const forecastPath = path.join(ARTIFACT_DIR, 'preview_forecasting.png');
  await page.screenshot({ path: forecastPath, fullPage: false });
  console.log('Saved forecasting preview to:', forecastPath);

  // 3. Set Date Range to Monday (2026-09-14) to capture Closed status
  await page.fill('#forecast-start-date', '2026-09-14');
  await page.fill('#forecast-end-date', '2026-09-14');
  await page.dispatchEvent('#forecast-start-date', 'change');
  await page.waitForTimeout(1000);

  const closedPath = path.join(ARTIFACT_DIR, 'preview_monday_closed.png');
  await page.screenshot({ path: closedPath, fullPage: false });
  console.log('Saved monday closed preview to:', closedPath);

  await browser.close();
  server.close();
  console.log('Capture finished successfully!');
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
