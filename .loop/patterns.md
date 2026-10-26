# Multi-Meat Forecasting & System Facelift Distillate (<= 40 Lines)

## 1. Culinary Yield & Forecasting Invariants
- Turkey (No-Trim): Y_trim=1.0, Y_cook=0.70 (Cooked = Raw * 0.70). Brisket: Y_net=0.40 (~14# packer).
- Pulled Pork: Y_net=0.44 (~8# butt). Spare Ribs: ~5#/rack (12 bones). Dino: 3 bones/plate. Sausage: 60#/batch, 3 links/lb (85% yield).
- Portions/Cooked lb: Turkey 3.2 (5oz), Pork 2.0 (8oz), Brisket 2.3 (7oz). Target Cooked = F_t * 1.10 safety buffer.
- Revenue Scale: M_rev = clamp(0.90, Rev/Base, 1.10) [2800 Tue-Thu, 3500 Fri-Sun] + 0.20 * Huber(e_{t-1}, 1.5).
- Drift Rule: (|P - A|/A > 0.25 AND |P - A| >= Deadband) OR |TS| > 4.0. Closed Mon = 0 prep, $0 rev, no alert.

## 2. Timezone & Hourly Actuals Invariants
- DB created_time is naive UTC; generated_at is tz-aware ISO in America/New_York.
- UI display & 24-bucket hourly actuals (0-23 zero-filled) strictly localize UTC -> America/New_York.

## 3. Brand Palette, Typography & Responsive Breakpoints
- Palette (Slate Dark): bg-base `#020617`, bg-panel `#0f172a`, bg-hover `#1e293b`, border `#334155`.
- Text & Accents: primary `#f8fafc`, secondary `#94a3b8`, muted `#64748b`; blue `#3b82f6`, green `#10b981`, amber `#f59e0b`, red `#ef4444`, purple `#8b5cf6`.
- Typography: UI `--font-main: 'Inter', system-ui, sans-serif`; Metrics/Numbers `--font-mono: 'JetBrains Mono', monospace`.
- Breakpoints: Mobile `< 768px` (375px/414px baseline), Tablet `768px–1023px`, Executive Desktop `>= 1280px`.
- Touch & Mobile Chart Rule: Interactive controls `>= 44x44px` (`48px` preferred); charts on `< 768px` strictly non-interactive (`pointer-events: none; touch-action: pan-y`).

## 4. Zero-Trust Security & Code Hygiene Rules
- Permissions: Directories `0755`, files `0644`, scripts `0755`, secrets `.env` `0600` (never world-writable `0777`/`0666`).
- DOM & Queries: No `document.write()`; sanitize dynamic HTML; parameterized SQL (`?`) only; zero exposed credentials.
