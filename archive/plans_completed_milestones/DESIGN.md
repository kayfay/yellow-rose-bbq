# DESIGN.md — Architecture, 2D Data Flow Blueprint & Component State Contracts

## 1. 2D Data Flow & Component Architecture Blueprint

```
+---------------------------------------------------------------------------------------------------+
|                        CLOVER POS & ANALYTICS PIPELINE (Python 3.13 / CI)                         |
+---------------------------------------------------------------------------------------------------+
|  clover_sales.db (UTC)                                                                            |
|       |                                                                                           |
|       +---> hourly_actuals.py ----------> hourly_actuals.json (24 ET buckets/day + dow_baseline)  |
|       +---> generate_historical_payload.py -> historical_payload.json (actual vs MultiMeat model) |
|       +---> dashboard.py / update_predictive_cache.py -> dashboard_payload.json / predictive.json |
|       +---> daily_insight_engine.py ----> daily_executive_brief.json                              |
|       |                                                                                           |
|       v                                                                                           |
|  build_payloads.py ---------------------> payloads.js (window.BBQ_PAYLOADS) + sync_status.json    |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                      FRONTEND STATE & TIMEZONE ENGINE (tz_utils.js + app.js)                      |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  1. Sync State Resolver (app.js: updateSyncStatusTime)                                            |
|     - Reads max(sync_status.last_synced_at, payload.generated_at)                                 |
|     - Computes syncAgeMinutes = (Date.now() - bestDate.getTime()) / 60000                         |
|     - Sets data-sync-state = "fresh" (<30m) | "warning" (30m-120m) | "stale" (>120m)              |
|     - Exposes window.ShopTime.setLastSyncedAt(iso) for cutoff awareness                           |
|                                                                                                   |
|  2. Decoupled POS Projection Engine (tz_utils.js: computeBlendedDayMetrics)                       |
|     - Inputs: (actuals, forecastRecords, now, dateStr, syncTimestamp)                             |
|     - Resolves Effective Cutoff:                                                                  |
|         * If simulating: simulatedNow hour (full hour elapsed)                                    |
|         * If today (or incomplete synced date where syncTimestamp falls on dateStr < 20:00 ET):   |
|             effectiveInst = min(now, syncTimestamp) or last non-zero POS bucket hour              |
|             cutoff = shopHour(effectiveInst), liveFrac = shopMinute(effectiveInst) / 60           |
|         * If completed past day: cutoff = 23, remainingHoursWeight = 0                            |
|     - Computes:                                                                                   |
|         * Actual_POS_to_Date = sum(buckets[0..cutoff].sales_usd)                                  |
|         * Historical_Weekday_Avg = sum(weekday_baseline[dow].sales_sum) / n                       |
|         * Remaining_Hours_Weight = sum(avgByHour[h] * (1 - elapsedWeight(h))) / Historical_Avg    |
|         * Projected_Day_Total = Actual_POS_to_Date + Remaining_Hours_Weight * Historical_Avg      |
+---------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+---------------------------------------------------------------------------------------------------+
|                           RENDERED SPA UI HIERARCHY (index.html / DOM)                            |
+---------------------------------------------------------------------------------------------------+
|  [Header Bar]  #data-last-pulled (3-Tier Badge: Fresh Green / Warning Amber / Stale Red)          |
|  [Date Controls] #forecast-start-date | #forecast-end-date | #time-travel-slider                  |
|                                                                                                   |
|  [13 KPI Cards Grid] (.forecasting-kpi-grid)                                                      |
|    +-- #kpi-card-revenue-container (#kpi-projected-revenue, #kpi-revenue-compare, blended-pill)   |
|    +-- #kpi-card-brisket-container (35% yield, 5.75 lb cooked / 16.4 lb raw packer, 82 lb case)   |
|    +-- #kpi-card-pork-container    (44% yield, 8.0 lb butt, 32 lb case)                           |
|    +-- #kpi-card-sausage-container (60 lb batch / 3.0 links per lb)                               |
|    +-- #kpi-card-ribs-container    (60% yield, 5.6 lb rack, 6 racks / 33.6 lb case)               |
|    +-- #kpi-card-dino-container    (4.0 lb rib, 12 ribs / 48 lb case)                             |
|    +-- #kpi-card-turkey-container  (70% yield, 20 lb case)                                        |
|    +-- #kpi-card-rosebuds-container, #kpi-card-tacos-container, #kpi-card-total-cooked-container  |
|    +-- #kpi-card-velocity-container (Sales vs. Typical Day), #kpi-card-food-cost-container, AOV   |
|                                                                                                   |
|  [Cook Accuracy Audit Banner] (#kpi-model-eval-banner)                                            |
|    +-- 1-Line Takeaway (.audit-plain-takeaway)                                                    |
|    +-- 4 Stat Boxes: Actual POS to Date | Projected Day Total | Pace vs. Target | Est. Meat Cost  |
|                                                                                                   |
|  [7 Subtab Views]                                                                                 |
|    1. #subtab-view-predictive (Hourly Sales & Meat Draw: 3 Stat Cards + 35% Yield Note + Deck)    |
|    2. #subtab-view-arima      (Daily Sales vs. Typical Day: 3 Stat Cards + 35% Yield Directive)   |
|    3. #subtab-view-shift      (Busy Hours Heatmap: Lunch Peak, Dinner Peak, Drop-Off + Heatmap)   |
|    4. #subtab-view-weather    (Today's Weather Impact: Rain, Heat, Rain+No Game + Live Lines)     |
|    5. #subtab-view-event      (Local Game Day Boost: Jaguars, Next Event, 14d Ahead + Calendar)   |
|    6. #subtab-view-advanced   (Menu Mix & Rush Patterns: Dino Shift, Channel AOV, Game+Rain)      |
|    7. #subtab-view-reports    (Shop Reports: Brief, Sales Bridge, Quick-Wind, 10 Tips, 35% Specs) |
|                                                                                                   |
|  [Footer Frame] #last-updated-time (Mirrors Header 3-Tier Sync Status) + #btn-refresh-analytics   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. State & Module Contracts

### 2.1 `tz_utils.js` (`window.ShopTime`)
| Function | Signature | Contract & Return Shape |
|---|---|---|
| `setLastSyncedAt` | `setLastSyncedAt(isoOrDate) -> Date\|null` | Stores the latest POS sync timestamp (`sync_status.last_synced_at` or `hourly_actuals.generated_at`) so `computeBlendedDayMetrics` can bound live elapsed hours to the last synced POS point. |
| `getLastSyncedAt` | `getLastSyncedAt() -> Date\|null` | Returns the stored sync `Date` instant or `null`. |
| `getSyncHealth` | `getSyncHealth(syncIsoOrDate, now) -> { ageMinutes, state, label, badgeText }` | Pure helper returning `state: 'fresh' \| 'warning' \| 'stale'`, `ageMinutes` (integer), and human-readable lag badge text (`"● Live Sync"`, `"⚠ Sync Lag (45m ago)"`, `"⚠ Stale Sync (6h ago)"`). |
| `computeBlendedDayMetrics` | `computeBlendedDayMetrics(actuals, forecastRecords, now, dateStr, syncNow)` | Computes hourly and summary metrics. When `dateStr` is today (or matches the date of `syncNow` while `syncNow` is mid-day `< 20:00 ET` and later buckets in `dayData` have `0` orders), bounds `cutoff` and `liveFrac` to the effective POS sync instant so `remainingHoursWeight > 0` and `blendedTotalRevenue > actualSalesSoFar`. |

### 2.2 `clover_api/analytics/historical_payload.json` & `generate_historical_payload.py`
- Each record in `historical_records` must satisfy:
  - `actual_revenue`: float (`>= 0.0`), summed from locked POS orders for `date`.
  - `predicted_revenue`: float (`>= 0.0`), computed by `MultiMeatForecaster.predict_day(date)['predicted_revenue']` (or weekday baseline if forecaster unavailable, **never** `round(revenue, 2)`).
  - `predicted_brisket_cooked_lbs`: `round(predicted_brisket_raw_lbs * 0.35, 1)`.
  - `actual_brisket_cooked_lbs`: `round(actual_brisket_raw_lbs * 0.35, 1)`.

### 2.3 Sync Status Badge DOM Contract (`#data-last-pulled` & `#last-updated-time`)
```html
<!-- Top Header Sync Pill -->
<div id="data-last-pulled" class="sync-status-pill sync-state-fresh" data-sync-state="fresh">
  Data Last Synced: November 8, 2026 at 11:00 PM EST • <span class="sync-health-tag">● Live Sync</span>
</div>
```
- CSS classes in [`style.css`](file:///home/atools/Documents/GitHub/yellow-rose-bbq/style.css):
  - `.sync-state-fresh`: border `rgba(0, 158, 115, 0.45)`, background `rgba(0, 158, 115, 0.12)`, text `#34d399`
  - `.sync-state-warning`: border `rgba(230, 159, 0, 0.55)`, background `rgba(230, 159, 0, 0.15)`, text `#fbbf24`
  - `.sync-state-stale`: border `rgba(213, 94, 0, 0.65)`, background `rgba(213, 94, 0, 0.18)`, text `#f87171`

### 2.4 Subtab Audit Matrix
| Subtab ID | Stat Strip Keys (`data-stat`) | Dynamic Explainer / Copy Contract |
|---|---|---|
| `#subtab-view-predictive` | `peak-hour`, `typical-day`, `hourly-avg` | `#predictive-velocity-summary`, `#hourly-actuals-summary`, Cooked Yield note = `35%` Brisket, `44%` Pork, `70%` Turkey |
| `#subtab-view-arima` | `open-day-avg`, `midweek-weekend`, static `Monday` | `#dynamic-baseline-trend`, `#dynamic-insight-string` (`35%` Brisket & `44%` Pork cooked yield) |
| `#subtab-view-shift` | `lunch-peak`, `dinner-peak`, `dropoff` | 12-hour EST heatmap buckets (`12:00 AM EST` .. `11:00 PM EST`), Tuesday 11:00 AM EST reopen |
| `#subtab-view-weather` | `rain-days`, `heat-days`, `rain-game` | `#live-rain-line`, `#live-heat-line` hydrated from `weather_payload.weather_stats` |
| `#subtab-view-event` | `jags`, `next-event`, `events-ahead` | `#live-jags-line`, `#live-flga-line`, `#live-concert-line`, `#live-baseball-line` from `event_payload` & `calendar_events` |
| `#subtab-view-advanced` | `dino-shift`, `channel-aov`, `game-rain` | `#live-dino-line`, `#live-channel-line`, `#live-weather-stadium-line`, `#live-payday-line` from `advanced_payload` |
| `#subtab-view-reports` | `#stat-meat-cost-pct`, Watchlist, Cutoffs | `#daily-executive-brief-banner`, `shop_reports.js` fallback yield `0.35`, Supplier spec `35% cooked yield` |
