# Multi-Meat Forecasting, Executive BI & Smokehouse UX Distillate (<= 40 Lines)

## 1. Culinary Yield, Case Pack & Unit Conversion Invariants
- **Brisket**: `Y_net = 0.40` (`~16.4 lb` raw packer (invoice); `5 packers/case = 82 lbs raw`; `2.3` 7-oz portions/cooked lb).
- **Pork Butt (Shoulder)**: `Y_net = 0.44` (`~8 lb` bone-in butt; `4 butts/case = 32 lbs raw`; `2.0` 8-oz portions/cooked lb).
- **Pork Spare Ribs**: `~5.6 lbs/rack` (12 bones, invoice); `6 racks/case = 33.6 lbs raw` (`2 racks/cryovac bag`; `Y_cook = 0.60`).
- **Beef Dino Ribs**: `3 bones/plate`; `4 lbs/rack`; `12 ribs/case` (`3 cryovac bags`).
- **Smoked Turkey (No-Trim)**: `Y_trim = 1.0`, `Y_cook = 0.70` (`20 lbs/case raw`; `3.2` 5-oz portions/cooked lb).
- **Sausage**: `50 lb` base block (`~55.5–63 lb` stuffed; `60 lb` nominal batch), `3.0 links/lb` (`85%` smoke yield).
- **Prep Margin**: `Target Cooked = F_t * 1.10` (built-in 10% margin; never shown in the UI). Closed Mon = `0` prep, `$0 (Closed)`, no alert.

## 2. Plain-English Smokehouse Copywriting & Zero-Jargon Mandate
- **Banned UI Jargon**: Never show `"MultiMeatForecaster"`, `"variance"`, `"safety buffer"`, `"model evaluation"`, `"DOW Base"`, `"Z-Score"`, `"Sigma"`, `"COGS"`, `"Velocity"`, `"Elasticity"`, or `"Stadium Lift"`.
- **Approved Smokehouse Terms**: `"Pitmaster Daily Forecast"`, `"Difference from Target"`, `"Cook Accuracy Audit"`, `"Typical [Day]"`, `"Est. Meat Cost"`, `"Left After Meat Cost"`, `"Sales vs. Typical Day"`.
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
- **Security**: Files `0644`, dirs/scripts `0755`, `.env`/confidential data (`*.csv`, `*.xlsx`, `*.db`, `*.enc`) `0600`; local server blocks private dirs/exts; AES-256 vault (`scripts/secure_data_vault.py`).
- **CI & Records**: Ingestion stages 4 paths (`clover_api/analytics/*.json`, `analytics/*.json`, `api/analytics/*.json`, `payloads.js`, `WEBSITE_MENU.md`); clean worktree + autostash rebase; historical days merge/accumulate.


## 5. Predictive Fix Pass (2026-11-05)
- **Sliders**: `#time-travel-slider`, `#weight-slider` need `touch-action: pan-y`; commit on `pointerup`/`change`, never `touchmove`.
- **Test infra**: unittest + node --check + Playwright only (no pytest/tsc). E2E port `127.0.0.1:8013`.
- **Units**: `clover_api/analytics/unit_conversions.py` is the source (invoice 9/3/26): brisket 16.4 lb/82 lb case, rack 5.6 lb, butt 8 lb (yield sheet). JS mirror `KITCHEN_UNIT_SPECS`; `test_calculations.py` enforces parity.
- **Meat cost %** = batch cost (raw lbs x invoice $) / revenue; null on closed/partial days; never a ratio constant. Revenue comes from `hourly_actuals` POS history, not the shift heatmap (undercounts 1.1-2.4x).
- **Plotly badges**: Peak/Low/Now strip sits beside Plotly charts, never inside (inside breaks autosize). Only Monday is closed.
