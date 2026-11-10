# SPEC.md — POS Sync Decoupling, Stale Sync Badges & Comprehensive Subtab Text/Metric Audit

## 1. Overview & Problem Statement
In **`sausage.allen.tools`** (Yellow Rose BBQ), when the Clover POS synchronization timestamp lags behind wall-clock time (e.g., *"Data Last Synced: November 8, 2026 at 1:41 PM EST"* viewed later in the evening or on a subsequent day) or when viewing an incomplete/mid-day POS record:
1. **`Predicted Day Total` / `Projected Day Total` Mirroring Bug**:
   - In [`tz_utils.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/tz_utils.js), `computeBlendedDayMetrics()` previously used the browser/wall-clock hour (`cutoff = isPast ? 23 : (isToday ? shopHour(effNow) : -1)`) instead of anchoring to the actual POS sync cutoff or last recorded POS bucket when sync data is mid-day or lagging. Once the wall-clock passed 8:00 PM EST (or on an incomplete day whose last sync was mid-day), `remainingHoursWeight` collapsed to `0`, causing `blendedTotalRevenue` (`Projected Day Total`) to equal `actualSalesSoFar` (`Actual POS to Date`).
   - In [`generate_historical_payload.py`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/generate_historical_payload.py) (line 95), `predicted_revenue` was initialized to `round(revenue, 2)` (`actual_revenue`) before optional enrichment, and in [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js) (lines 1739, 1749), fallback expressions `r.predicted_revenue !== undefined ? r.predicted_revenue : (r.actual_revenue || 0)` and `r.actual_revenue !== undefined ? r.actual_revenue : (r.predicted_revenue || 0)` allowed `Predicted Total` and `Actual POS Total` to mirror one another whenever one field was missing or un-enriched.
2. **Stale Sync Indicator Absence**:
   - [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js) (`updateSyncStatusTime()`) rendered `#data-last-pulled` in a static green style regardless of whether the sync timestamp was 10 minutes old or 20 hours stale.
3. **Residual Copy & Metric Drift Across Subtabs**:
   - [`index.html`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/index.html) (lines 629, 704, 1320) and [`modules/reports/shop_reports.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/modules/reports/shop_reports.js) (line 116) still display `40%` cooked brisket yield in static/fallback text instead of the canonical `35%` (`5.75 lbs` cooked per `16.4 lb` raw packer) locked in [`clover_api/analytics/unit_conversions.py`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/clover_api/analytics/unit_conversions.py).

---

## 2. Functional Requirements (EARS Syntax)

### 2.1 POS Projection Decoupling & Sync-Aware Cutoff (`tz_utils.js`, `app.js`, `analytics_subtabs.js`, `generate_historical_payload.py`)

- **REQ-PROJ-001 (Mid-Day & Stale-Sync Projection Formula):**
  **When** POS sync age exceeds 0 minutes on an open operating day (Tuesday–Sunday) and the effective POS cutoff hour is prior to closing (hour `< 20`, i.e., before 8:00 PM EST close), **the system shall** calculate `Projected Day Total` (`blendedTotalRevenue`) as:
  $$\text{Projected\_Day\_Total} = \text{Actual\_POS\_to\_Date} + (\text{Remaining\_Hours\_Weight} \times \text{Historical\_Weekday\_Avg})$$
  and **shall NOT** copy `Actual_POS_to_Date` (`actualSalesSoFar`) directly into `Projected Day Total`.

- **REQ-PROJ-002 (Sync-Aware Effective Cutoff Resolution):**
  **When** computing blended day metrics in [`tz_utils.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/tz_utils.js) (`computeBlendedDayMetrics`) for `today` (or a day whose last sync timestamp `lastSyncedAt` falls on `targetDate` prior to 8:00 PM EST when no simulated clock is active), **the system shall** bound the effective cutoff hour and minute to the latest POS data timestamp (`min(wallClockNow, lastSyncedAt)` or the last non-zero POS bucket hour when sync lags mid-day), so that un-synced afternoon/dinner hours retain their positive `Remaining_Hours_Weight`.

- **REQ-PROJ-003 (Strict Separation of `predicted_revenue` and `actual_revenue`):**
  **When** generating historical records in [`generate_historical_payload.py`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/generate_historical_payload.py) or rendering comparison cards in [`app.js`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/app.js), **the system shall** compute `predicted_revenue` strictly from the weekday baseline / `MultiMeatForecaster` model and **shall never** assign `predicted_revenue = actual_revenue` or fall back from `predicted_revenue` to `actual_revenue`.

- **REQ-PROJ-004 (incomplete / Mid-Day Selected Date Blending):**
  **When** the user selects or views a date that has partial/mid-day POS actuals (e.g., synced mid-day at 1:41 PM EST with `$0` orders after the sync hour and `lastSyncedAt` on that date before 8:00 PM EST), **the system shall** display both `Actual POS to Date` and the decoupled `Projected Day Total` in the Cook Accuracy Audit banner (`#kpi-model-eval-banner`) and KPI comparison badges (`#kpi-revenue-compare`).

- **REQ-PROJ-005 (End-of-Day & Closed Monday Invariant):**
  **When** an open operating day has completed service (effective cutoff hour `>= 20` and all operating hours 11:00 AM – 8:00 PM EST have elapsed in synced POS data), **the system shall** set `Remaining_Hours_Weight = 0` so `Projected Day Total` equals `Actual POS to Date`. **When** the target date is Monday (closed day), **the system shall** render `$0 (Closed)` with `0` prep targets and `0` projected revenue.

---

### 2.2 Dynamic Sync Age Badges & Stale Data Indicators (`app.js`, `style.css`, `index.html`)

- **REQ-SYNC-001 (3-Tier Sync Status Calculation):**
  **When** `updateSyncStatusTime()` resolves the latest payload/sync timestamp (`bestDate`) against current wall-clock time (`now`), **the system shall** compute `syncAgeMinutes = (now - bestDate) / 60000` and classify the sync status into one of three deterministic tiers:
  1. **Fresh (`data-sync-state="fresh"`, `< 30` minutes):** Okabe-Ito Green (`#009E73` / `#34d399`), badge text `"● Live Sync"`.
  2. **Lagging (`data-sync-state="warning"`, `30` to `120` minutes):** Okabe-Ito Amber (`#E69F00` / `#fbbf24`), badge text `"⚠ Sync Lag (${mins}m ago)"`.
  3. **Stale (`data-sync-state="stale"`, `> 120` minutes / `2` hours):** Okabe-Ito Vermillion (`#D55E00` / `#f87171`), badge text `"⚠ Stale Sync (${hours}h ago)"`.

- **REQ-SYNC-002 (Top Header & Bottom Footer Parity):**
  **When** rendering the sync timestamp in `#data-last-pulled` (top bar) and `#last-updated-time` (bottom footer), **the system shall** format both timestamps identically via `window.ShopTime.formatShopTimestamp()` in 12-hour `EST`/`EDT` format and apply the active 3-tier status badge class and `data-sync-state` attribute.

---

### 2.3 Page-by-Page Text & Metric Alignment Audit (All 6 Subtabs + KPI Deck)

- **REQ-AUDIT-001 (Canonical Yield & Unit Alignment):**
  **When** rendering any text, bullet, tooltip, or fallback across `index.html`, `app.js`, and `modules/**/*.js`, **the system shall** enforce the canonical [`unit_conversions.py`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/clover_api/analytics/unit_conversions.py) specifications:
  - **Brisket:** `35%` cooked yield (`5.75 lbs` cooked per `16.4 lb` raw packer; `5 packers/case = 82 lbs raw`; `2.3` portions/cooked lb). Zero occurrences of `"40% cooked yield"`, `"40% Brisket"`, or `"bRaw * 0.40"`.
  - **Pork Butt:** `44%` cooked yield (`8.0 lb` raw butt; `4 butts/case = 32 lbs raw`; `2.0` portions/cooked lb).
  - **Pork Spare Ribs:** `60%` cooked yield (`5.6 lbs/rack`; `6 racks/case = 33.6 lbs raw`; `2 racks/bag`).
  - **Beef Dino Ribs:** `4.0 lbs/rib`; `12 ribs/case` (`3 cryovac bags`).
  - **Smoked Turkey:** `70%` cooked yield (`10.0 lb` raw breast; `2 breasts/case = 20 lbs raw`; `3.2` portions/cooked lb).
  - **House Sausage:** `50 lb` meat block (`25.5 lb` beef + `16.0 lb` pork + `8.5 lb` fat; `60 lb` nominal stuffed batch with add-ins; `3.0 links/lb`).

- **REQ-AUDIT-002 (Subtab Stat Cards & Explainer Parity):**
  **When** viewing any of the 6 analytics subtabs (`#subtab-view-predictive`, `#subtab-view-arima`, `#subtab-view-shift`, `#subtab-view-weather`, `#subtab-view-event`, `#subtab-view-advanced`) or `#subtab-view-reports`, **the system shall** populate all `.subtab-stat-card` values and `#live-*-line` explainer spans dynamically from `window.BBQ_PAYLOADS` without hardcoded string overrides.

- **REQ-AUDIT-003 (Zero Banned Jargon & 12-Hour EST Formatting):**
  **When** rendering any DOM text across all views, **the system shall** contain zero occurrences of banned jargon (`"MultiMeatForecaster"`, `"variance"`, `"safety buffer"`, `"model evaluation"`, `"DOW Base"`, `"Z-Score"`, `"Sigma"`, `"COGS"`, `"Velocity"`, `"Elasticity"`, `"Stadium Lift"`, `"Plain English"`, `"lbs actual"`, `"actual to"`) and **shall** format all hourly timestamps in 12-hour Eastern Time (`h:00 AM/PM EST`).
