# Yellow Rose BBQ — Bundled Calibration & Verification Plan (`PLAN.md`)

## Milestones & Deterministic Verification Tasks

### Task 1: Master DB Resolution & Combo Modification Parser (`portion_transformer.py`)
- **Action:**
  1. Update `load_transactions()` in `clover_api/analytics/portion_transformer.py` (and `dashboard.py`) to auto-select `data/clover_sales_master.db` when present and non-empty, falling back to `clover_api/data/clover_sales.db`.
  2. Expand `PORTION_MAP` to cover all high-volume menu items (`Moist Sandwich`, `Lean sandwich`, bulk `turkey`, bulk `pulled pork`, `Crispy Quesa Taco Brisket`, `Crispy Quesa Taco Turkey`, `Quesabirria taco`, `Taco Plate W/2 Sides`, `Rosebud`, `Dino Beef Rib`).
  3. Parse `modifications` on `BBQ plate` and `2 meat plate` so Ribs, Turkey, Pulled Pork, Sausage, and Brisket selections are accurately attributed instead of defaulting 100% of plates to Brisket.
- **Verification:** Run a deterministic check confirming `unclassified_item` drops to 0 for core meat items and daily POS rib rack totals include plate/platter rib selections.

### Task 2: Recalibrate `DOW_BASELINES` & Wire Time-Series Modules (`scripts/meat_forecast.py`)
- **Action:**
  1. Compute empirical day-of-week cooked demand medians (P50) and P90 upper bounds from the corrected `portion_transformer.py` output across `data/clover_sales_master.db` (plus pitmaster operational floors for high-volume weekend rib/brisket runs).
  2. Update `DOW_BASELINES` in `scripts/meat_forecast.py` and wire `clover_api/analytics/modules/probabilistic/quantile_buffers.py` + `hierarchical/reconciler.py` + `smokehouse_translator.py` into `MultiMeatForecaster`.
- **Verification:** Confirm Saturday `2026-11-14` projects `12` briskets (`11 expected + 1 cushion`), Sunday ribs reflect real platter + rack volume, and `reconciler.py` preserves $\sum \text{Items} = \sum \text{Categories} = \text{Store Total}$.

### Task 3: De-Circularize Historical Backtester (`scripts/backtest_all_forecasts.py`)
- **Action:**
  1. Update `scripts/backtest_all_forecasts.py` to load actual POS daily meat consumption via `portion_transformer.py` from `data/clover_sales_master.db` (when available) as the ground-truth `item_actuals`, falling back to payload baselines only in CI environments where `data/clover_sales_master.db` is absent.
  2. Print side-by-side Predicted vs. Actual yields (in whole kitchen cuts and cooked lbs) and verify calibrated MAPE < 15.0%.
- **Verification:** `.venv/bin/python scripts/backtest_all_forecasts.py` and `.venv/bin/python scripts/verify_all_forecasts.py` exit `0` with non-zero, honest residual statistics.

### Task 4: Smart Closed-Hours Sync Staleness & Payload Rebuild (`tz_utils.js`, `build_payloads.py`)
- **Action:**
  1. Verify `ShopTime.getSyncHealth()` in `tz_utils.js` returns `Closed · Synced` (`state: 'fresh'`) on Mondays and outside `10:00–21:00` `America/New_York` when synced within 24h (`<= 1440` min), while preserving `<30m` fresh / `30–120m` warning / `>120m` stale during open hours.
  2. Add a unit/E2E assertion in `tests/e2e/projection.spec.js` testing Monday/overnight closed-sync behavior.
  3. Rebuild `clover_api/analytics/payloads.js` and `sync_status.json` via `.venv/bin/python clover_api/analytics/build_payloads.py`.
- **Verification:** `node --check tz_utils.js && npm run check` and `npx playwright test tests/e2e/projection.spec.js` exit `0`.

### Task 5: Full Regression Suite & `.loop/` Audit Log Update
- **Action:**
  1. Run `npm run check`, `.venv/bin/python -m unittest discover -s clover_api/tests`, PAL verifiers (`verify_all_forecasts.py`, `verify_v2_facelift_pal.py`, `verify_smokehouse_ux_pal.py`, `verify_bi_insight_engine.py`), and `npm test` (Playwright E2E).
  2. Update `.loop/prd.json` and `.loop/log.md` with exact verification counts.
- **Verification:** 100% pass rate across all suites with exit code `0`.
