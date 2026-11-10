# Resume Here — Predictive App Fix Pass (updated 2026-11-07)

Work is paused for budget reasons, not because it is finished. Everything below is true as of the last update.
Nothing is committed. All work is in the working tree on `master` (version bumped to **2.2.4**).

Read `.loop/prd.json`, `.loop/patterns.md` and the last ~8 entries of `.loop/log.md` first (project rule), then this file.

## State in one paragraph

All four workstreams are implemented and verified by tests: copy purge, slider/touch/chart fixes, live meat cost and
projection formulas, and the counts-first unit migration, plus landscape-phone support and live summary cards.
Six independent read-only critic reviews were run; ratings were **5, 7, 8, 7, 7, 7** out of 10. The owner's gate is
**9/10 or higher before any story is marked `passes: true`**, so all 13 stories (ids 38-50 in `.loop/prd.json`)
are still `passes: false`. The fixes for the round-6 findings (invented text on the past-day lookup card, surge claims in calendar titles and notes, 0.95x shown as 0.9x) are done and tested, but **no seventh review has been run**.

## Last known test results (run just before pausing)

- `npm run check`: OK
- `npm test`: **30 passed, 0 failed, 0 flaky**
- `.venv/bin/python -m unittest discover -s clover_api/tests`: **27 OK**
- Verifiers all PASS: `verify_bi_insight_engine`, `verify_ml_analytics`, `verify_subtab_rollup_pal`,
  `verify_smokehouse_ux_pal`, `verify_v2_facelift_pal`, `verify_date_predictions`, `verify_turnover_engine`,
  `verify_hourly_sync`, `verify_all_forecasts`

Re-run these first. If anything differs, compare against untouched `HEAD` before calling it pre-existing.

## Do next, in order (cheapest first)

1. **Re-run the checks above** (free), then `git status`. About 29 files under `clover_api/analytics/`, `api/analytics/`,
   `analytics/` and `assets/screenshots/` are regenerated data and images. The hourly CI bot also writes these, so
   do not hand-merge them; commit source files separately from data churn and `git pull --rebase` before any push.
2. **Run one more critic pass** (this is the only thing blocking the stories). Use a fresh read-only reviewer with the
   "single source of truth" list below and ask for a strict 1-10 score. If it rates **>= 9**, set `passes: true` on
   ids 38-50. If lower, fix only the confirmed wrong-number / wrong-label / broken-view findings and repeat. Every
   round so far found one more stale number the previous sweep missed, so ask it to grep all rendered text,
   generated JSON and Python-emitted messages.
3. **Commit** only when the owner asks. Suggested split: source and tests; docs (`AGENTS.md`, `CHANGELOG.md`,
   `README.md`, `progress.html`, `.loop/`); then data/screenshots separately or skip data entirely.
4. After CI regenerates payloads, confirm `event_payload.json` no longer contains a negative holiday multiplier.

## Budget note

Owner had about **$1.80** of budget left on 2026-11-07. Spend nothing (no critic or agent runs) unless the owner asks.

## Open items that need the owner (not code)

- **Brisket cooked yield:** owner says one brisket cooks down to about **5.75 lb** (5 3/4 lb), roughly 35% of 16.4 lb raw. The app
  still uses 40% (6.56 lb) from the yield sheet. Recorded as `owner_reported_cooked_lbs_per_unit` in
  `unit_conversions.py`. To adopt it: set brisket `cook_yield` 0.35 and `yieldRatio` 0.35 in `core_utils.js`, then update the
  places that hardcode 0.40/0.4 for brisket (grep `0.4` in `app.js`, `tz_utils.js`, `meat_forecast.py`, `generate_historical_payload.py`)
  and the verifier/test expectations (`smokehouse_ux.spec.js`, `test_calculations.py`). Not done: it changes cooked-lb numbers everywhere.

- **Event multipliers are now measured, not typed** (done 2026-11-07). Weekday-matched medians: baseball 1.09x, concerts
  0.92x, Jaguars 0.95x, holidays not measurable (1 day). Effects inside +/-15% count as 1.0x, so every calendar event is
  1.0x. `scripts/calibrate_calendar_multipliers.py --write` re-measures when more event days have sales. Old values are in
  `archive/calendar_events.json.2026-11-07.orig`. Decide later whether any event should get a hand-chosen planning
  multiplier despite the data (the code will use whatever `multiplier` the calendar holds).
- **Rain/heat comparisons** (`clover_api/analytics/weather_impact.py`, shown on the Weather cards and the rain tip) still
  compare against ALL normal days, not the same weekday, so they carry the same busy-weekend flaw the Jaguars numbers had.
  Needs the real POS database (local copy is 32 KB); reuse `event_multipliers.measure_multipliers`.
- **Sausage links per lb** is an estimate (3 per lb, `KITCHEN_UNIT_SPECS.sausage`). The owner's links vary (5-6 in).
  Weighing ~10 finished links from one batch would replace the guess. The sausage forecast (Tuesday ~45 links) looks
  low against POS-derived history (about 100-160), but that history is itself approximate. Left unchanged on purpose.
- **Pork butt** weight (8 lb raw, 32 lb case, 44% yield) comes from the yield sheet only; update
  `clover_api/analytics/unit_conversions.py` (and the JS mirror) when a butt appears on an invoice.
- The old sausage formulation document was retired 2026-11-07 (copy in `archive/`). The recipe lives in
  `modules/recipes/sausage_calc.js`.
- Waste facts for any future waste/cost work: sausage and rosebuds are thrown out nightly; raw briskets carry over;
  chopped brisket is left in 6-inch hotel pans (saved in project memory too).

## Known small leftovers (low priority)

- Multi-day meat-cost % is estimated at the ratio of days that have a stored cost when a range includes a partial day.
- Live-today meat % divides the day's batch cost by client-projected sales (labelled an estimate).
- The D3 Daily Sales chart is about 29px taller than its card (identical on untouched `HEAD`).
- `scripts/update_predictive_cache.py` imports `scripts.meat_forecast` and relies on the repo root being on `sys.path`.
- Dead locals `totalLaborHours` / `totalStaff` remain in `app.js` (never rendered).
- The hourly auto-refresh timer has no automated test (its pieces are covered).
- The local `clover_api/data/clover_sales.db` is 32 KB with no `weather_events` table. `event_impact.py` now falls back to
  `historical_payload.json` + `calendar_events.json`, so it runs locally; weather analytics still need the real database.
- Remaining uses of the word "surge" are data-driven pacing labels ("Heavy Rush Surge", "High-Demand Surge"), not calendar claims.

## Decisions already made by the owner (do not re-ask)

- Only **Monday** is closed. Tuesday is open. (`AGENTS.md` corrected.)
- Keep the built-in **10% prep margin** in the math (`app.js` ~line 1019) but never state it in the UI.
- Use **invoice weights**: brisket 16.4 lb raw each, 82 lb per case of 5; spare rib 5.6 lb per rack, 33.6 lb per case.
  Source of truth: `clover_api/analytics/unit_conversions.py`, mirrored in `KITCHEN_UNIT_SPECS`
  (`modules/shared/core_utils.js`); `clover_api/tests/test_calculations.py` fails if they drift.
- "Hourly Sales Pace" is now **"Sales vs. Typical Day"**; "lbs actual sold" is now **"Cooked lbs Sold"**.
- Hourly chart redraws every shop hour. Subtab summary cards are filled from live data (not typed-in numbers).
- Brisket cooked-per-piece is an estimate (owner unsure); counts are labelled approximate.
- A phone turned sideways gets the same scroll-safe static charts and Peak/Low/Now strip as portrait. A web page
  cannot force rotation, so nothing tries to.

## Single source of truth a reviewer must hold the code to

Brisket 16.4 lb raw / 82 lb case / 40% yield. Spare rib 5.6 lb rack / 33.6 lb case / 60% yield. Dino rib 4 lb each.
Pork butt 8 lb / 32 lb case / 44%. About 3 sausage links per lb (estimate). Only Monday closed. No hardcoded 29.5%.
Meat cost % = batch meat cost (raw lbs x invoice price) / revenue x 100, blank on closed or partial days.
Projected Day Total = POS so far + remaining-hours weight x historical weekday average (live hour weighted by minutes
elapsed on the real clock; Monday never projected). Banned rendered copy: "Plain English", cushion / extra prep, shift
directives, labor, "lbs actual", "actual ... sold", "Actual to", "Hourly Sales Pace", surge/demand claims in calendar
titles or notes, and typed-in event multipliers (measured only: `clover_api/analytics/event_multipliers.py`). No per-lb wholesale prices in
client JS or payloads.

## Where things live

- Cost engine: `clover_api/analytics/food_cost_engine.py` (`batch_meat_cost`, `meat_cost_pct`, `record_batch_cost`)
- Units: `clover_api/analytics/unit_conversions.py` and `modules/shared/core_utils.js`
- Projection / pace: `tz_utils.js` (`computeBlendedDayMetrics`)
- Live cards and explainers, slider, hourly refresh: `modules/forecaster/analytics_subtabs.js`
  (`hydrateSubtabStatCards`, `hydrateExplainerLines`, `startHourlyRefresh`)
- Hourly forecast from real POS history: `clover_api/analytics/hourly_feature_engineering.py`,
  `scripts/update_predictive_cache.py`
- Guard tests worth keeping: `clover_api/tests/test_copy_audit.py` (banned copy and stale numbers in source and
  generated payloads), `test_calculations.py` (formulas, units parity, hourly revenue vs POS), and the new E2E specs
  `projection`, `slider_chart`, `stat_cards`, `landscape`.
- Gallery: `node scripts/capture_predictive_fix_gallery.js` writes `assets/screenshots/fix_*.png` (new files only);
  `progress.html` Milestone E shows them.
- Backup taken before any edits: `backups/archive_pre_predictive_fixes_20261105.tar.gz` (gitignored; excludes `.env`).
- Plan and milestones: `PREDICTIVE_APP_FIX_PLAN.md`. Full audit trail: `.loop/log.md` (entries dated 2026-11-05).

## Safe-to-ignore noise

Playwright output, `test-results/`, `playwright-report/` and regenerated analytics JSON are not part of the change.
`run_tests.sh` regenerates `local_server.py`; port 8013 must be free for `npm test`.
