# Multi-Meat Forecasting, Executive BI & Daily Insight Distillate (<= 40 Lines)

## 1. Culinary Yield & Forecasting Invariants
- Turkey (No-Trim): Y_trim=1.0, Y_cook=0.70 (Cooked = Raw * 0.70). Brisket: Y_net=0.40 (~14# packer).
- Pulled Pork: Y_net=0.44 (~8# butt). Spare Ribs: ~5#/rack (12 bones). Dino: 3 bones/plate. Sausage: 60#/batch, 3 links/lb (85% yield).
- Portions/Cooked lb: Turkey 3.2 (5oz), Pork 2.0 (8oz), Brisket 2.3 (7oz). Target Cooked = F_t * 1.10 safety buffer.
- Revenue Scale: M_rev = clamp(0.90, Rev/Base, 1.10) [2800 Tue-Thu, 3500 Fri-Sun] + 0.20 * Huber(e_{t-1}, 1.5).
- Drift Rule: (|P - A|/A > 0.25 AND |P - A| >= Deadband) OR |TS| > 4.0. Closed Mon = 0 prep, $0 rev, no alert.

## 2. Plain-English Daily Insight Engine (PAL Rules & Zero-Jargon Mandate)
- Anomaly Math (Backend Only): `z = (x_t - mu_dow) / max(sigma_dow, 1e-6)`; Variance: `pct_var = ((x_t - mu_dow) / mu_dow) * 100`.
- Zero-Jargon UI Rule: Never display `"DOW Base"`, `"Z-Score"`, `"Sigma"`, `"COGS"`, `"Velocity"`, `"Elasticity"`, or `"Stadium Lift"`. Use plain English: `"Typical [Day]"`, `"Est. Meat Cost"`, `"Left After Meat Cost"`, `"Hourly Sales Pace"`, `"Today's Weather Impact"`, `"Local Game Day Boost"`.
- Executive Brief Invariant: lives in the "Shop Reports" subtab (#subtab-view-reports), NEVER above the date picker or projections, + 1-click Printable 1-Page Sheet + `daily_executive_brief.json` with: (1) **What's Happening Today (The Insight)** and (2) **Recommended Next Step (The Action)**.

## 3. Executive Data Visualization & Okabe-Ito Colorblind-Safe Tokens
- Tufte Data-Ink Ratio: Zero 3D effects, zero heavy vertical gridlines, muted horizontal reference lines (`rgba(148,163,184,0.10)`), direct units on axes/callouts.
- Chart Selection: Target Progress Bars (Bullet Bars) + 7-Day Mini-Trends (Sparklines) inside KPI cards; Plain-English Sales Breakdown Bar/Bridge; Hourly Sales Pace & Heatmaps.
- Okabe-Ito Palette (WCAG AAA / Colorblind-Safe): Orange `#E69F00`, Sky Blue `#56B4E9`, Bluish Green `#009E73`, Amber `#F0E442`, Deep Blue `#0072B2`, Vermillion `#D55E00`, Reddish Purple `#CC79A7`, Slate `#64748B`.
- Viewport Invariant: Desktop (`>= 768px`, `1440px` preset) = interactive plain-English tooltips; Mobile (`< 768px`, `375px`/`414px`) = 100% static (`staticPlot: true`, `pointer-events: none`, `touch-action: pan-y`) with **pre-baked Peak/Low/Now face annotations** and `>= 16px` (`1rem`) legibility.

## 4. Zero-Trust Security & Code Hygiene Rules
- Permissions: Directories `0755`, files `0644`, scripts `0755`, secrets `.env` `0600` (zero world-writable files).
- DOM & Queries: No `document.write()`; sanitize dynamic HTML (`escapeHTML`); parameterized SQL (`?`); zero leaked wholesale COGS breakdowns.
