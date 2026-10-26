# Changelog

All notable changes to the **Yellow Rose BBQ Command Center** are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
