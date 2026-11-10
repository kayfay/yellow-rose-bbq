# PLAN.md — Milestone & Single-Responsibility Task Breakdown

## Pre-Flight & Archival Invariant
- Create a verified baseline archive `backups/archive_pre_sync_audit_20261109.tar.gz` before modifying any source files.
- Preserve copies of modified core files in `archive/` if wholesale-rewriting any script.
- Never overwrite or delete `clover_sales.db` or `data/clover_sales_master.db`.

---

## Task 1: Fix POS Projection Decoupling (`tz_utils.js`, `app.js`, `analytics_subtabs.js`, `generate_historical_payload.py`)
**Objective:** Ensure `Projected Day Total` (`blendedTotalRevenue`) never mirrors `Actual POS to Date` (`actualSalesSoFar`) when hours remain after the POS sync cutoff, and ensure `predicted_revenue` never copies `actual_revenue`.
1. **`tz_utils.js`**:
   - Add `setLastSyncedAt(val)` / `getLastSyncedAt()` and `getSyncHealth(syncTime, now)` to `window.ShopTime`.
   - Update `computeBlendedDayMetrics(actuals, forecastRecords, now, dateStr, syncNow)`:
     - Resolve the effective POS cutoff for `today` (and for any date matching `syncNow` where `syncNow` is mid-day `< 20:00 EST` and subsequent buckets have zero POS orders, or where a partial day's last recorded POS bucket is `< 19` and sync occurred before 8:00 PM EST): use `min(effNow, syncInst)` (or the last non-zero POS bucket hour when sync lagged) when not simulating.
     - Ensure `remainingHoursWeight > 0` whenever operating hours (`11..20`) remain after the effective POS sync cutoff, so `blendedTotalRevenue = actualSalesSoFar + remainingHoursWeight * historicalDayAvg` strictly diverges from `actualSalesSoFar`.
2. **`generate_historical_payload.py`**:
   - Replace `"predicted_revenue": round(revenue, 2)` on line 95 with a deterministic weekday baseline fallback (`{ 'Mon': 0.0, 'Tue': 3689.0, 'Wed': 3050.0, 'Thu': 3900.0, 'Fri': 5100.0, 'Sat': 6200.0, 'Sun': 4650.0 }`) before `MultiMeatForecaster` enrichment so `predicted_revenue` is never initialized to `actual_revenue`.
3. **`app.js` & `modules/forecaster/analytics_subtabs.js`**:
   - Pass the resolved sync timestamp into `window.ShopTime.setLastSyncedAt()` in `updateSyncStatusTime()` and before `computeBlendedDayMetrics()`.
   - In `app.js`, allow `hasBlended` to activate when viewing a single-day record that has mid-day/incomplete synced POS data (or when `isToday` / `isSimulating`), and remove the fallback `r.predicted_revenue !== undefined ? r.predicted_revenue : (r.actual_revenue || 0)` that copied actuals into predictions.
   - Update `#hourly-actuals-summary` in `analytics_subtabs.js` to display both `Actual POS to Date` and `Projected Day Total` alongside the sync cutoff hour.
4. **Verification**:
   - `node --check tz_utils.js && npm run check`
   - `npm test -- tests/e2e/projection.spec.js`

---

## Task 2: Implement Dynamic 3-Tier Sync Age Badges & Stale Data Indicators (`app.js`, `style.css`, `index.html`)
**Objective:** Visually surface POS sync freshness and warn pitmasters/owners when sync lag exceeds 30 minutes (Amber Warning) or 2 hours (Red Stale Alert).
1. **`tz_utils.js` & `app.js`**:
   - Implement `window.ShopTime.getSyncHealth(bestDate, now)` returning `{ ageMinutes, state, badgeText }`:
     - `< 30` mins: `state = 'fresh'`, `badgeText = '● Live Sync'`
     - `30–120` mins: `state = 'warning'`, `badgeText = '⚠ Sync Lag (' + ageMinutes + 'm ago)'`
     - `> 120` mins: `state = 'stale'`, `badgeText = '⚠ Stale Sync (' + Math.round(ageMinutes / 60) + 'h ago)'`
   - Update `updateSyncStatusTime()` in `app.js` to apply `.sync-state-fresh`, `.sync-state-warning`, or `.sync-state-stale` and `data-sync-state` on both `#data-last-pulled` and `#last-updated-time`.
2. **`style.css` & `index.html`**:
   - Add high-contrast Okabe-Ito styles for `.sync-status-pill`, `.sync-state-fresh`, `.sync-state-warning`, and `.sync-state-stale` in `style.css`.
   - Remove hardcoded inline green styles on `#data-last-pulled` in `index.html` so the dynamic state classes control the color and border.
3. **Verification**:
   - Add unit/E2E assertions in `tests/e2e/projection.spec.js` testing `< 30m` (`fresh`), `45m` (`warning`), and `> 120m` (`stale`) sync badge rendering.

---

## Task 3: Comprehensive Page-by-Page Text & Metric Alignment Audit (`index.html`, `modules/reports/shop_reports.js`, `clover_api/tests/test_copy_audit.py`)
**Objective:** Audit every subtab (`Forecaster`, `Daily Sales`, `Busy Hours`, `Weather`, `Game Day`, `Menu Mix`, `Shop Reports`) and eliminate all stale yield strings (`40%` brisket yield -> `35%`) and hardcoded text overrides.
1. **`index.html`**:
   - Line 629 (`#subtab-view-predictive`): Change `Brisket yields <strong>40%</strong> cooked weight` to `Brisket yields <strong>35%</strong> cooked weight (~5.75 lbs per packer)`.
   - Line 704 (`#subtab-view-arima`): Change `for 40% Brisket &amp; 44% Pork cooked yield` to `for 35% Brisket &amp; 44% Pork cooked yield`.
   - Line 1320 (`#subtab-view-reports` Supplier Specs): Change `(~82 lbs raw, ~16.4 lbs each; 40% cooked yield)` to `(~82 lbs raw, ~16.4 lbs each; 35% cooked yield / ~5.75 lbs cooked)`.
   - Bump `?v=` cache-buster query strings across `index.html` to `?v=2.2.6`.
2. **`modules/reports/shop_reports.js`**:
   - Line 116: Fix fallback `the_action` brisket cooked calculation from `Math.round(bRaw * 0.40)` to `Math.round(bRaw * 0.35)`.
3. **`clover_api/tests/test_copy_audit.py`**:
   - Add banned regex patterns for stale brisket yield strings (`r"40%\s*cooked yield"`, `r"40%\s*brisket"`, `r"bRaw\s*\*\s*0\.40"`) across all rendered HTML/JS/JSON files so `40%` brisket yield can never regress.
4. **Verification**:
   - `.venv/bin/python -m unittest discover -s clover_api/tests`
   - `npm test -- tests/e2e/stat_cards.spec.js`

---

## Task 4: Full Test Suite, Deterministic PAL Verifiers & Adversarial Critic Gate
**Objective:** Run all mandatory verification suites and pass an independent read-only Adversarial Critic audit with a score `>= 9/10`.
1. **Execute Verification Suite**:
   - `npm run check && node --check tz_utils.js`
   - `.venv/bin/python -m unittest discover -s clover_api/tests`
   - `.venv/bin/python scripts/verify_smokehouse_ux_pal.py`
   - `.venv/bin/python scripts/verify_v2_facelift_pal.py`
   - `.venv/bin/python scripts/verify_bi_insight_engine.py`
   - `.venv/bin/python scripts/verify_subtab_rollup_pal.py`
   - `.venv/bin/python scripts/verify_timezone_and_actuals.py`
   - `npm test` (Playwright E2E suite across all specs)
2. **Spawn Independent Adversarial Critic Subagent (`research`)**:
   - Inspect git diffs, DOM text, sync badge states, and projection calculations across all subtabs.
   - Require score `>= 9.0 / 10` before marking `.loop/prd.json` tasks `passes: true` and logging final results to `.loop/log.md`.
