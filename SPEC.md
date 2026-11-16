# Yellow Rose BBQ — POS Actuals Calibration, Portion Mapping & Time-Series Wiring Specification (`SPEC.md`)

## 1. Overview
This specification defines the functional requirements (in EARS syntax) for resolving the 5 structural bugs between Clover POS line-item actuals (`data/clover_sales_master.db`) and the meat demand forecasting pipeline, alongside smart closed-hours sync staleness management.

## 2. Functional Requirements (EARS Syntax)

### FR-1: Master POS Database Resolution
- **When** any analytics or forecasting module (`portion_transformer.py`, `dashboard.py`, `meat_forecast.py`, `backtest_all_forecasts.py`) loads historical POS transactions, **the system shall** resolve `data/clover_sales_master.db` first (when present and non-empty) and fall back to `clover_api/data/clover_sales.db` only when the master database is unavailable.

### FR-2: Combo Plate Modification Parsing & Complete Portion Mapping
- **When** translating `order_line_items` into cooked meat equivalents in `clover_api/analytics/portion_transformer.py`, **the system shall** parse the `modifications` string on combo plates (`BBQ plate`, `2 meat plate`) to attribute cooked weight/racks/links to the actual proteins selected (`Moist Brisket`, `Lean Brisket`, `Mixed Brisket`, `Ribs`, `Pulled Pork`, `Turkey`, `Sausage`) rather than hardcoding 100% Brisket.
- **When** classifying standalone POS menu items, **the system shall** map all high-volume menu items—including bulk scale items (`Brisket`, `Turkey`, `Pulled Pork`, `Sausage` divided by `1000.0`), sandwiches (`Moist Sandwich`, `Lean sandwich`, `Pulled pork sandwich`, `Turkey sandwich`), platters (`Pitmaster Platter &3 Sm Sides`, `Hill Country Trinity W/3Sides`, `Bevo Platter`), ribs (`Full Rack Pork Spare Ribs`, `1/2 Rack Pork Spare Ribs`, `Single Bone Pork Rib`, `Dino Beef Rib`), tacos (`Crispy Quesa Taco Brisket`, `Crispy Quesa Taco Turkey`, `Quesabirria taco`, `Taco Plate W/2 Sides`), and `Rosebud`—with zero unmapped core protein rings.

### FR-3: Empirical Day-of-Week Baselines & Time-Series Suite Wiring
- **When** computing daily meat prep targets in `scripts/meat_forecast.py` and `clover_api/analytics/dashboard.py`, **the system shall** derive day-of-week baselines (`DOW_BASELINES`) from actual POS-translated cooked consumption in `data/clover_sales_master.db` and wire the `clover_api/analytics/modules/` suite (`hierarchical/reconciler.py`, `probabilistic/quantile_buffers.py`, `smokehouse_translator.py`) so that:
  - $\sum \text{Items} = \sum \text{Categories} = \text{Store Total}$ within `0.01`,
  - Brisket uses `5.75 lbs` cooked per `16.4 lb` raw packer (`35%` net yield) with a maximum single cushion of `+1 brisket`,
  - Turkey uses `3.0 lbs` cooked per breast (`70%` yield, `20.0 lbs/case`),
  - Pork Spare Ribs (`12 bones/rack`, `6 racks/case`) include both standalone racks and combo/platter rib allocations.

### FR-4: Non-Circular POS Backtesting
- **When** `scripts/backtest_all_forecasts.py` evaluates 30-day forecast accuracy, **the system shall** compare model predictions against actual daily POS-translated meat consumption from `data/clover_sales_master.db` (rather than comparing `DOW_BASELINES * rev_idx` against itself) and report honest MAPE, MAD, RMSE, and Tracking Signal metrics.

### FR-5: Smart Closed-Hours Sync Staleness Management
- **When** `ShopTime.getSyncHealth()` in `tz_utils.js` evaluates sync age on Mondays (closed all day) or outside operating hours (`< 10:00` or `>= 21:00` `America/New_York`), **the system shall** return `state: 'fresh'` with badge `● Closed · Synced` as long as a valid sync occurred within the past 24 hours (`1440` minutes), preventing false `⚠ Stale Sync` alarms overnight and on closed days.
