# Multi-Meat Forecasting, Executive BI & Smokehouse UX Distillate (<= 40 Lines)

## 1. Culinary Yield, Case Pack & Unit Conversion Invariants
- **Brisket**: `Y_net = 0.40` (`~14 lb` raw packer; `5 packers/case = 70 lbs raw`; `2.3` 7-oz portions/cooked lb).
- **Pork Butt (Shoulder)**: `Y_net = 0.44` (`~8 lb` bone-in butt; `4 butts/case = 32 lbs raw`; `2.0` 8-oz portions/cooked lb).
- **Pork Spare Ribs**: `~5 lbs/rack` (12 bones); `6 racks/case = 30 lbs raw` (`2 racks/cryovac bag`; `Y_cook = 0.60`).
- **Beef Dino Ribs**: `3 bones/plate`; `4 lbs/rack`; `12 ribs/case` (`3 cryovac bags`).
- **Smoked Turkey (No-Trim)**: `Y_trim = 1.0`, `Y_cook = 0.70` (`20 lbs/case raw`; `3.2` 5-oz portions/cooked lb).
- **Sausage**: `50 lb` base block (`~55.5–63 lb` stuffed; `60 lb` nominal batch), `3.0 links/lb` (`85%` smoke yield).
- **Prep Cushion**: `Target Cooked = F_t * 1.10` (+10% Extra Prep / Cushion). Closed Mon = `0` prep, `$0 (Closed)`, no alert.

## 2. Plain-English Smokehouse Copywriting & Zero-Jargon Mandate
- **Banned UI Jargon**: Never show `"MultiMeatForecaster"`, `"variance"`, `"safety buffer"`, `"model evaluation"`, `"DOW Base"`, `"Z-Score"`, `"Sigma"`, `"COGS"`, `"Velocity"`, `"Elasticity"`, or `"Stadium Lift"`.
- **Approved Smokehouse Terms**: `"Pitmaster Daily Forecast"`, `"Difference from Target"`, `"Extra Prep / Cushion"`, `"Cook Accuracy Audit"`, `"Typical [Day]"`, `"Est. Meat Cost"`, `"Left After Meat Cost"`, `"Hourly Sales Pace"`.
- **Audit Takeaway Rule**: Every Cook Accuracy Audit view starts with a 1-line plain-English takeaway in practical cuts & lbs.
- **Glossary Invariant**: 13 terms in `modules/reports/shop_reports.js` + `hourly_quick_wind_detector.py`. Brief lives in `#subtab-view-reports`.
- **Time Display Standard**: Always 12-hour Eastern Standard Time (`h:00 AM/PM EST`) with uppercase AM/PM and explicit `EST`. Never 24-hour military time (`14:00`, `through hour 15:00`).

## 3. Executive Data Visualization, Layout & Okabe-Ito Tokens
- **Tufte & Few**: Zero 3D/heavy gridlines; Bullet Bars (`.kpi-bullet-track`) + 7-Day Sparklines (`.kpi-sparkline-svg`) on KPI cards.
- **24h Pace Layout**: Tight vertical flow between `#plotly-predictive-velocity-chart` and `#hourly-turnover-deck` (zero blank dark gap).
- **Okabe-Ito Palette**: Orange `#E69F00`, Sky `#56B4E9`, Green `#009E73`, Amber `#F0E442`, Blue `#0072B2`, Vermillion `#D55E00`, Purple `#CC79A7`.
- **Viewport Invariant**: Desktop (`>= 768px`) = tooltips; Mobile (`< 768px`) = static (`staticPlot: true`, `pointer-events: none`, `touch-action: pan-y`) with Peak/Low/Now face badges and `>= 16px` body text.

## 4. Zero-Trust Security, Modular Architecture & Roll-Up Invariants
- **Modules (`<script defer>`)**: `core_utils.js`, `sausage_calc.js`, `shop_reports.js`, `analytics_subtabs.js` -> `app.js`.
- **Subtab Roll-Ups**: All 7 subtabs start with `.subtab-stat-strip` (3 cards) and `.rollup-section` (`min-height: 48px` `.rollup-header`).
- **Security**: Files `0644`, dirs/scripts `0755`, `.env` `0600`; no `document.write()`; `escapeHTML`; parameterized SQL (`?`); zero wholesale COGS leaks.
- **CI & Records**: Ingestion stages 4 paths (`clover_api/analytics/*.json`, `analytics/*.json`, `api/analytics/*.json`, `payloads.js`, `WEBSITE_MENU.md`); clean worktree + autostash rebase; historical days merge/accumulate.

