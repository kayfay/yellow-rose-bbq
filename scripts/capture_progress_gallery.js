const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'screenshots');

function startStaticServer(port = 8124) {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff2': 'font/woff2'
  };

  const server = http.createServer((req, res) => {
    const cleanUrl = req.url.split('?')[0];
    const relPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
    const filePath = path.join(ROOT, relPath);
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startStaticServer(8124);
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop (1280x800) screenshots
    const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktopPage = await desktopCtx.newPage();
    await desktopPage.goto('http://127.0.0.1:8124/', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(600);
    await desktopPage.screenshot({ path: path.join(OUT_DIR, 'v2_desktop_prep.png'), fullPage: false });

    await desktopPage.click('#tab-btn-forecasting');
    await desktopPage.waitForTimeout(1200);
    await desktopPage.screenshot({ path: path.join(OUT_DIR, 'v2_desktop_analytics.png'), fullPage: false });

    await desktopPage.click('#btn-toggle-debug-drawer');
    await desktopPage.waitForTimeout(400);
    await desktopPage.screenshot({ path: path.join(OUT_DIR, 'v2_desktop_debug_drawer.png'), fullPage: false });
    await desktopCtx.close();

    // 2. Mobile (375x812) screenshots
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto('http://127.0.0.1:8124/', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(600);
    await mobilePage.screenshot({ path: path.join(OUT_DIR, 'v2_mobile_prep.png'), fullPage: false });

    await mobilePage.click('.mobile-bottom-nav-btn[data-tab="forecasting-analytics"]');
    await mobilePage.waitForTimeout(1200);
    await mobilePage.screenshot({ path: path.join(OUT_DIR, 'v2_mobile_analytics.png'), fullPage: false });
    await mobileCtx.close();

    console.log('Captured 5 v2.0.0 progress gallery screenshots in assets/screenshots/');
  } finally {
    await browser.close();
    server.close();
  }
})();
