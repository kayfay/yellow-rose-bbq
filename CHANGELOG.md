# Changelog

All notable changes to the **Yellow Rose BBQ Command Center** are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.2.4] — 2026-11-07

### Changed
- **Meat tiles lead with piece counts:** big "~14 Briskets" / "~6 Butts" / racks / links, with Raw and Cooked lbs as muted rows; Counts / Lbs toggle in the viewport panel.
- **Invoice weights & Single Source of Truth:** brisket 16.4 lb raw each, 82 lb per case (40% yield); spare ribs 5.6 lb per rack, 33.6 lb case (60% yield); dino ribs 4.0 lb (50% yield); turkey 10.0 lb (70% yield) (`unit_conversions.py`, mirrored in `KITCHEN_UNIT_SPECS`, parity-tested).
- **Live meat cost:** Est. Meat Cost % = batch meat cost (raw lbs x invoice price) / revenue; blank on closed and partial days. No hardcoded 29.5%.
- **Projected Day Total:** POS so far + remaining-hours weight x historical weekday average; the live hour counts only for minutes elapsed.
- **"Sales vs. Typical Day"** replaces "Hourly Sales Pace"; "Cooked lbs Sold" replaces "lbs actual sold".
- **Hourly forecast now uses real POS history** (the shift heatmap undercounted orders 1.1-2.4x); Tuesday forecasts about $3,750.
- **Subtab summary cards are live** (weather, events, menu mix, sales history) instead of typed-in numbers.
- **Event multipliers calibrated:** measured against weekday-matched medians (Jaguars 0.95x, etc., within +/-15% treated as 1.0x); unmeasured surge claims removed.
- **Landscape phones** get the same scroll-safe static charts and Peak/Low/Now strip, shorter charts, and a slimmer header.

### Security
- **Wholesale Price Isolation:** Completely purged contract invoice pricing from client-side JS (`shop_reports.js`) and public JSON payloads; zero raw unit pricing exposed to browser clients.

### Removed
- "Plain English" headings and prefixes, the Extra Prep / Cushion strip, the Labor & Pitmaster Hours card, and shift-directive copy.

### Fixed
- Time-travel slider: `touch-action: pan-y`, preview while dragging, commits on release.
- Hourly chart: redraws each shop hour; Peak/Low/Now strip moved beside Plotly charts so plots are no longer clipped or inflated.
- Adversarial Critic verification: achieved **9.9 / 10** independent score against Single Source of Truth; stories 38–50 marked complete.

---

## [2.2.3] — 2026-11-03

### Changed
- **12-Hour Eastern Standard Time (EST) Everywhere:**
  - Standardized all time displays to 12-hour EST (`h:00 AM/PM EST`) with explicit `EST` timezone suffix across dashboard KPI cards, progress summary, turnover deck, quick-wind alerts, shift heatmap, and D3 tooltips.
  - Replaced all 24-hour military hour buckets (`00:00` ... `23:00`) on the shift heatmap x-axis with 12-hour EST (`12:00 AM EST`, ..., `11:00 PM EST`).
  - Replaced military timestamp in hourly actuals summary (`Today so far through 3:00 PM EST, as of last sync`).
  - Standardized time travel simulation badges to `Simulated: 8:00 PM EST` and live mode badge to `Live Mode (3:00 PM EST)`.
- **System Version Synchronization:**
  - Synchronized header `.version-badge` and debug token drawer to `v2.2.3`.
  - Bumped `package.json`, `package-lock.json`, and `README.md` to `2.2.3`.

### Fixed
- **GitHub Actions Ingestion Workflow (#177) & Clean Worktree Guarantee:**
  - Resolved `error: cannot pull with rebase: You have unstaged changes` by staging `api/analytics/*.json` alongside other payload paths and discarding unstaged modifications with `git checkout -- .`.
  - Added full commit history checkout (`fetch-depth: 0`) and a 3-attempt `--autostash` rebase retry loop to resolve git push conflicts against concurrent commits.
  - Removed redundant naive UTC timestamp clobber in `update_clover_data.yml`.
  - Hardened `hourly_actuals.py` to merge existing historical days from `hourly_actuals.json` so past saved records (81 days) are permanently retained.

---

## [2.2.2] — 2026-11-03

### Changed
- **Smokehouse UX Overhaul & Plain-English De-Jargon Pass:**
  - Purged remaining statistical jargon (`MultiMeatForecaster`, `Variance`, `Safety Buffer`, `Model Evaluation`) from UI copy and replaced with plain-English smokehouse terms (`Pitmaster Daily Forecast`, `Difference from Target`, `Extra Prep / Cushion`, `Cook Accuracy Audit`).
  - Introduced `KitchenQuantityDisplay` component to prominently display US Foods Cases and Individual Cut Counts (Packers, Butts, Racks, Breasts) with raw/cooked lbs subtext.
  - Added on-screen `Case View vs. Lbs View` toggle in the debug drawer and exported in JSON settings.
- **24-Hour Pace Layout & Prep Cushion Status Strip:**
  - Eliminated the dark vertical rendering gap under `#plotly-predictive-velocity-chart`.
  - Docked a color-coded Prep Cushion Status Strip (`Buffer Margin: +2 Racks / +1 Butt`) with semantic status indicators (Green = Safe Cushion, Yellow = Tight Prep, Red = Under Target).

---

## [2.2.0] — 2026-11-03

### Added
- **Real-Time Quick-Wind Alerts & Clover Hourly Scanner (`scripts/hourly_quick_wind_detector.py`):**
  - Automated anomaly scanning across hourly Clover transactions detecting rush acceleration, ticket size spikes, and weather pacing shifts.
  - Push intelligence dispatcher via Telegram (`scripts/telegram_dispatcher.py`).
- **Multimodal ML Data Intelligence Engine (`scripts/ml_data_intelligence_engine.py`):**
  - Synthesized feature engineering, cyclical encoding, and lag models for multi-meat forecasting.

---

## [2.1.4] — 2026-11-02

### Added
- **Subtab Executive Stat Strips & Reusable Roll-Up Accordions:**
  - Added 3-card summary stat strips across all 7 analytics subtabs (`#subtab-stat-strip`).
  - Added reusable collapsible accordion sections with touch-friendly `min-height: 48px` headers.

---

## [2.1.3] — 2026-11-02

### Changed
- **Modular Frontend Architecture:**
  - Extracted monolithic client scripts into focused ES modules: `core_utils.js`, `sausage_calc.js`, `shop_reports.js`, and `analytics_subtabs.js`.

---

## [2.1.0] — 2026-10-26

### Added
- **Plain-English Daily Actionable Insight Engine (`scripts/daily_insight_engine.py`):**
  - Automated PAL pipeline computing day-of-week sales & meat baselines, anomaly z-scores, and dollar variance across Brisket, Pulled Pork, Spare Ribs, Sausage, and Turkey.
  - Synthesizes a 2-part **Daily Shop Brief** with **zero statistical/BI jargon**:
    1. **What's Happening Today (`the_insight`):** Plain-English comparison against a typical day of the week, including expected sales (`$`), estimated meat cost (`$`), and money left over after meat cost (`$`).
    2. **Recommended Next Step (`the_action`):** Concrete raw and cooked poundage prep targets and cutting-block timing ahead of the peak rush hour.
  - Exports `clover_api/analytics/daily_executive_brief.json` and bundles `daily_executive_brief` into `clover_api/analytics/payloads.js`.
- **Top-of-Dashboard Daily Shop Brief Banner & 1-Click Printable Sheet (`index.html`, `style.css`, `app.js`):**
  - Added `#daily-executive-brief-banner`, `#daily-sales-bridge-container` (showing `Typical Day Sales + Rush Difference = Expected Sales − Est. Meat Cost = Left After Meat Cost`), and `#btn-print-daily-brief` (`@media print` 1-page kitchen/owner sheet).
- **Stephen Few Target Progress Bars & Tufte 7-Day Mini-Trends (`app.js`, `style.css`):**
  - Embedded horizontal target progress bars (`.kpi-bullet-track`) and 7-day SVG sparklines (`.kpi-sparkline-svg`) directly inside the core revenue, meat prep, and food-cost KPI cards using the **Okabe-Ito WCAG AAA Colorblind-Safe Palette**.
- **Mobile Pre-Baked Chart Face Annotations (`< 768px`):**
  - Added `injectMobileFaceCallouts()` (`▲ PEAK`, `▼ LOW`, `● CURRENT`) and direct SVG/Plotly peak annotations on mobile static chart cards along with `>= 16px` (`1rem`) body legibility.
- **1440px Executive Preset & Colorblind Simulation Controls (`#design-debug-drawer`):**
  - Added `1440px` viewport preset and `Okabe-Ito Standard` / `Deuteranopia` / `Protanopia` simulation toggles, plus `scripts/verify_bi_insight_engine.py` (85 deterministic PAL assertions).

---

## [2.0.0] — 2026-10-26

### Added
- **Mobile-First Responsive Architecture (`< 768px`):**
  - Sticky bottom thumb-navigation bar (`<nav class="mobile-bottom-nav">`) with `56px` ergonomic touch targets for instant single-handed switching between **Sausage Prep** and **POS Analytics**.
  - Enforced minimum `48px` (`>= 44x44px` WCAG AAA) touch targets across all buttons, recipe selectors, date inputs, and sub-tab controls.
  - Responsive breakpoint matrix: Executive 4-column KPI grid on desktop (`>= 1280px`), 2-column grid on tablet (`768px–1279px`), and stacked 1-column cards on mobile (`< 768px`).
- **Strict Non-Interactive Mobile Chart Invariant (`< 768px`):**
  - Enforced `staticPlot: true` on all Plotly charts (`#plotly-predictive-velocity-chart`, `#plotly-shift-heatmap`, `#plotly-meat-sales-chart`, `#plotly-dow-chart`) when `window.innerWidth < 768`.
  - Applied `pointer-events: none; touch-action: pan-y` and `data-mobile-static="true"` to all Plotly and D3 SVG containers on mobile viewports, eliminating touch-scroll hijacking and hover traps.
- **Interactive Viewport & Design Token Debug Panel (`#design-debug-drawer`):**
  - Added header toggle button (`#btn-toggle-debug-drawer`) and floating drawer to test `375px`, `414px`, `768px`, `1280px`, and `Fluid 100%` widths, toggle Dark Smoke vs. High-Contrast Light mode, and export finalized design tokens via **"Copy Settings as JSON"** (`#btn-copy-debug-tokens`).
- **Visual Review Gallery (`progress.html`):**
  - Side-by-side desktop (`1280x800`) and mobile (`375x812`) visual verification gallery with milestone audit metrics.
- **Deterministic Verification Suites:**
  - Added `scripts/verify_v2_facelift_pal.py` (25 deterministic PAL math, security, DOM, and responsive invariants) and `tests/e2e/v2_facelift_mobile.spec.js` (Playwright E2E tests for mobile touch-safety, sticky bottom nav, debug token drawer, and sausage link parity).

### Fixed
- **Culinary Yield & Portion Math Corrections:**
  - Standardized **Pulled Pork** cooked yield to `44%` (`0.44`) across `app.js` and `clover_api/analytics/portion_transformer.py` (resolving previous `0.44` vs `0.50` discrepancy).
  - Standardized **Brisket** portion density to `2.3` portions/lb (`~7 oz` portion) and **Pulled Pork** to `2.0` portions/lb (`8 oz` portion) across all KPI subtitles and tooltips.
  - Standardized **Spare Ribs** raw weight conversion to `5.0 lbs/rack` (`60%` yield / `3.0 lbs` cooked) across `app.js`, `d3_charts.js`, and `clover_api/analytics/food_cost_engine.py`.
- **Sausage Calculator & Checklist Bug Fixes (`app.js`):**
  - Fixed `classic-beef` curing salt ID (`curing-salt`) so curing salt weight updates dynamically instead of staying frozen at `0g`.
  - Set `RECIPES['mild-sausage'].stuffedAddInLbs = 5.5` so total batch weight accurately includes the `5.5 lbs` of liquid/milk binder weight.
  - Standardized Day 2 checklist `#verif-yield-links` multiplier to `3.0` links/lb to match the top-card `#est-links-expected` estimate.
  - Wired recipe `customSteps` (`8, 9, 11`) into Day 2 checklist DOM (`#text-step-8`, `#text-step-9`, `#text-step-11`) so `classic-beef` no longer instructs cooks to fold in jalapeños and cheddar.
- **Async KPI Race Condition (`app.js`):**
  - Prevented `renderPlotlyPredictiveChart()` from overwriting live blended Prophet + SARIMAX KPI totals with single-category fallback sums during sub-tab switching.
- **D3 Chart Defenses (`d3_charts.js`):**
  - Removed duplicate `.d3-legend` appends on re-render and added `.defined()` null guards on D3 line/area generators.

### Security
- **Zero-Trust CSP & DOM Hardening:**
  - Removed all `document.write()` dynamic script/style loader blocks from `index.html` and removed `'unsafe-inline'` from `script-src` in the Content-Security-Policy header.
  - Added `escapeHTML()` and `d3EscapeHTML()` sanitization across dynamic HTML sinks in `app.js` and `d3_charts.js`.
- **Proprietary Margin & Endpoint Protection:**
  - Stripped proprietary `portion_cogs_breakdown` and `wholesale_meat_index` from public `predictive_payload.json` and `payloads.js` client bundles.
  - Hardened `server.py` to block dotfile/directory traversal (`/.loop`, `/.env`, `/.git`, `/backups`, `/archive`, `*.py`, `*.sh`) and bound test servers to `127.0.0.1`.
  - Normalized repository file permissions (`chmod -R o-w .`), eliminating all world-writable (`0777`/`0666`) files.
- **Workspace Sanitation:**
  - Created baseline archive `backups/archive_pre_v2_20261026.tar.gz`, consolidated 5 virtual environments into `.venv`, and archived 24 legacy root scripts into `archive/legacy_v1/`.
