# Yellow Rose BBQ — Architectural Refactoring, Bug Audit & UI De-Slop Plan (`AUDIT_PLAN.md`)

## 1. Executive Summary & Alignment Decisions
Following the `/grill-me` alignment session and static codebase inspection, this plan governs the non-destructive refactoring of [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js) (4,944 lines) into fault-isolated domain modules under `modules/`, resolution of 4 discovered runtime/data bugs, enforcement of kitchen-line UI/UX standards, and full deterministic + adversarial verification.

### Core Decisions Locked
1. **Zero-Bundler Modular Architecture (`<script defer>`)**:
   - Decouple [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js) into four domain modules (`modules/shared/`, `modules/recipes/`, `modules/reports/`, `modules/forecaster/`) loaded via `<script defer>` in [`index.html`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/index.html) before [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js).
   - Keep [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js) as the lightweight lifecycle orchestrator and global hook bridge so GitHub Pages, `local_server.py`, and all 19 Playwright E2E specs work without a build bundler.
   - Expand `npm run check` in [`package.json`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/package.json) to syntax-check `app.js`, `d3_charts.js`, `tz_utils.js`, and all `modules/**/*.js` files.
2. **Layout & Touch-Safety Invariants**:
   - Preserve the [`AGENTS.md`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/AGENTS.md) Forecasting vertical flow: **Date Picker → Projections (KPI Cards & Chart) → Subtab Buttons → Active Subtab View** (no screen-blocking sticky scroll bar).
   - Keep the Daily Executive Brief, 10 Pitmaster Tips, Plain-English Glossary, and Supplier Delivery schedule strictly inside `#subtab-view-reports`.
   - Enforce $\ge 48\text{px}$ tap targets, $\ge 16\text{px}$ body text, Okabe-Ito colorblind-safe tokens, and static mobile chart cards (`staticPlot: true`, `pointer-events: none`, `touch-action: pan-y` below `768px`).
3. **Runtime Bug & Circuit-Breaker Scope**:
   - Fix all 4 discovered runtime bugs (Open-Meteo Fahrenheit & rain multiplier bug + timeout circuit breaker, async render-sequence guard against race conditions, dynamic `calendar_events` lookup, and payload-first fetch helper with structured error isolation).

---

## 2. 2D Architecture & Module Flow Wireframe

```
+===================================================================================+
|                           INDEX.HTML (Single-Page Shell)                          |
|  Loads: plotly -> d3 -> payloads.js -> d3_charts.js -> tz_utils.js -> modules/*   |
+===================================================================================+
                                         |
          +------------------------------+------------------------------+
          |                              |                              |
          v                              v                              v
+-------------------+        +-----------------------+      +-----------------------+
|  modules/shared/  |        |   modules/recipes/    |      |   modules/reports/    |
|   core_utils.js   |        |  sausage_calc.js      |      |   shop_reports.js     |
+-------------------+        +-----------------------+      +-----------------------+
| - escapeHTML()    |        | - RECIPES (10 specs)  |      | - renderDailyExecBrief|
| - isMobileViewport|        | - state & localStorage|      | - getTenWatchlistTips |
| - getPlotlyConfig |        | - renderRecipePills() |      | - renderQuickWindBanner|
| - applyChartTouch |        | - adjustWeight()      |      | - renderGlossary()    |
| - fetchWithTimeout|        | - updateUI() (3.0/lb) |      | - openTermExplainer() |
| - parseValidDate()|        | - resetRun/shareLink  |      | - buildSparklineSVG() |
+-------------------+        +-----------------------+      +-----------------------+
          |                              |                              |
          +------------------------------+------------------------------+
                                         |
                                         v
+===================================================================================+
|                        modules/forecaster/analytics_subtabs.js                    |
|  - renderPlotlyShiftHeatmap()      - renderPlotlyEventChart() & Calendar Drawer   |
|  - renderAdvancedAnalytics()       - renderPlotlyWeatherChart()                   |
|  - renderPlotlyPredictiveChart()   - renderHourlyTurnoverDeck() & Time-Travel Sim |
+===================================================================================+
                                         |
                                         v
+===================================================================================+
|                                  app.js (Orchestrator)                            |
|  - Main Tab & Subtab Navigation    - Date Picker & Horizon Presets                |
|  - renderPlotlyForecastingChart()  - Async Render Sequence Guard (Race Prevention)|
|  - renderKPIBulletAndSparklines()  - Design Debug Drawer & Viewport Presets       |
+===================================================================================+
```

---

## 3. Priority Bug Fixes & Technical Specifications

### Bug 1: Open-Meteo Celsius/Fahrenheit Mismatch & Rain Multiplier Sign (`app.js:2583-2595`)
- **Root Cause**: The Open-Meteo request omits `&temperature_unit=fahrenheit`, returning Celsius (`°C`), then checks `temperature_2m_max[0] > 90.0` ($194^\circ\text{F}$). Additionally, `precipitation_sum[0] > 10.0` applies a `1.21` (+21% boost) instead of a rain headwind multiplier (`0.79` / `-21%` consistent with `weather_impact.py`), and the network `fetch()` has no timeout.
- **Fix**:
  - Add `&temperature_unit=fahrenheit` to the Open-Meteo query URL.
  - Align the heavy rain fallback multiplier with the historical weather model (`0.85` rain headwind) or cached `weather_payload` elasticity, and wrap the call in `fetchWithTimeout(..., 3500)` so slow kitchen Wi-Fi never blocks UI rendering.

### Bug 2: Out-of-Order Async Race Condition in `renderPlotlyForecastingChart`
- **Root Cause**: `renderPlotlyForecastingChart` is `async` and triggered by rapid date-picker inputs, horizon buttons (`7D`, `14D`, `30D`, `Weekend`, `3rd Sat`), and time-travel slider events. If an earlier invocation waits on a network fallback while a newer invocation resolves from memory, the stale invocation overwrites the DOM KPIs and chart.
- **Fix**:
  - Introduce a monotonically increasing render counter (`let forecastRenderSeq = 0; const mySeq = ++forecastRenderSeq;`) and abort DOM/Plotly mutations if `mySeq !== forecastRenderSeq` after any `await`.

### Bug 3: Hardcoded Event Dates in Future Fallback (`app.js:2566-2567`)
- **Root Cause**: `JAGS_HOME_GAMES` and `HARDCODED_HOLIDAYS` are hardcoded arrays inside `renderPlotlyForecastingChart`, ignoring [`clover_api/analytics/calendar_events.json`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/clover_api/analytics/calendar_events.json) and `window.BBQ_PAYLOADS.event_payload`.
- **Fix**:
  - Extract a shared helper `resolveDateEventImpact(dateStr)` in `modules/shared/core_utils.js` that merges `window.BBQ_PAYLOADS?.event_payload` / `calendar_events` with the baseline schedule.

### Bug 4: Unbounded `fetch()` Calls & Silent `catch (e) {}` Blocks
- **Root Cause**: Fallback JSON fetches across shift, event, weather, and predictive subtabs lack timeout circuit breakers and consistent payload-first lookup.
- **Fix**:
  - Implement `fetchJsonSafe(url, fallbackData, timeoutMs = 4000)` in `modules/shared/core_utils.js` using `AbortController` so any unreachable endpoint fails fast and cleanly logs a structured `[WARN]` only when needed without throwing uncaught exceptions or console errors.

---

## 4. Milestone Checklist & Verification Gates

- [x] **Milestone 1 (Phase 2 & 3)**: Create baseline archive [`backups/archive_pre_audit_20261102.tar.gz`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/backups/archive_pre_audit_20261102.tar.gz), catalog [`archive/README.md`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/archive/README.md), and initialize `.loop/` state.
- [ ] **Milestone 2 (Task 24 — Shared Utilities & Circuit Breakers)**: Extract `modules/shared/core_utils.js` (`escapeHTML`, viewport/touch helpers, `fetchJsonSafe` with `AbortController` timeout, `resolveDateEventImpact`).
- [ ] **Milestone 3 (Task 25 — Sausage Recipe Module)**: Extract `modules/recipes/sausage_calc.js` (all 10 formulations, 50 lb batch scaling, 3.0 links/lb calibration, Day 2 checklist hydration, localStorage persistence).
- [ ] **Milestone 4 (Task 26 — Shop Reports & Executive Brief Module)**: Extract `modules/reports/shop_reports.js` (Daily Executive Brief banner, Sales Breakdown bridge, 10 Pitmaster Watchlist Tips, Quick Wind banner, Plain-English Glossary & Term Explainer drawer).
- [ ] **Milestone 5 (Task 27 — Analytics Subtabs & Forecaster Bug Fixes)**: Extract `modules/forecaster/analytics_subtabs.js` (Shift Heatmap, Event Impact & Calendar Drawer, Weather Impact, Advanced Analytics, Predictive Velocity, Hourly Turnover Deck & Time-Travel Simulator) and fix the Open-Meteo unit/timeout bug + async render-sequence guard in [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js).
- [ ] **Milestone 6 (Task 28 — UI Touch-Safety Audit, `progress.html` & Adversarial Critic Sign-Off)**: Verify $\ge 48\text{px}$ tap targets, update [`index.html`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/index.html) script tags and cache-busters, update [`package.json`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/package.json) `npm run check`, run all PAL & Playwright E2E suites (19/19 pass), and pass independent Adversarial Critic audit ($\ge 9/10$).
