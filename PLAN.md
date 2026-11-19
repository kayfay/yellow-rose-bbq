# PLAN.md — Full COGS Engine & UI Card Implementation Plan

## Milestones & Deterministic Verification Tasks

### Task 1: Baseline Workspace Backup & Invoice Dependency Audit
- **Action:** Create non-destructive workspace archive at `backups/archive_pre_full_cogs_20261119.tar.gz` (excluding `.venv`, `node_modules`, `.git`). Verify `data/vendor_invoices/` permissions (`0600`) and inspect available CSV headers without logging proprietary prices.
- **Verification:** `ls -lh backups/archive_pre_full_cogs_20261119.tar.gz` exits `0`; `git status` clean.

### Task 2: Recipe BOM Catalog & Backend Cost Engine (`cost_engine.py`)
- **Action:**
  - Create `clover_api/analytics/recipe_bom.json` mapping Clover menu items (sandwiches, plates, family packs, bulk cuts, sides) to Meat + Bakery + Sides + Packaging/Sauce BOM costs.
  - Implement `clover_api/analytics/cost_engine.py` with fault-isolated `data/vendor_invoices/` reconciliation and fallback defaults, outputting `clover_api/analytics/full_cogs.json`.
  - Wire `full_cogs.json` into `clover_api/analytics/build_payloads.py` so `payloads.js` exposes `window.FULL_COGS_PAYLOAD`.
- **Verification:**
  - `.venv/bin/python clover_api/analytics/cost_engine.py` exits `0`.
  - `.venv/bin/python clover_api/analytics/build_payloads.py` exits `0`.
  - `.venv/bin/python -m unittest clover_api/tests/test_cost_engine.py` passes 100%.

### Task 3: Full COGS UI Card & Responsive Grid (`index.html`, `style.css`, `analytics_subtabs.js`)
- **Action:**
  - Wrap `#kpi-card-food-cost-container` and new `#kpi-card-full-cogs-container` in `.cost-cards-grid` in `index.html`.
  - Add Okabe-Ito pacing pills (`< 32%` Green, `32–36%` Amber, `> 36%` Red) and mobile-first stacking rules (`< 768px`, `>= 48px` tap targets) in `style.css`.
  - Implement Full COGS Card hydration and `[Meat Only | Full COGS]` toggle in `modules/forecaster/analytics_subtabs.js` and `app.js` with `Pending Service` and `$0 (Closed)` guards.
  - Bump `?v=` cache-busting query strings in `index.html`.
- **Verification:**
  - `npm run check` passes (`node --check app.js d3_charts.js`).
  - `node --check modules/forecaster/analytics_subtabs.js` passes.

### Task 4: Deterministic PAL Verification & Playwright E2E Suite
- **Action:**
  - Create `scripts/verify_cogs_math.py` asserting:
    1. `meat_cost + non_meat_cost == total_cogs` (exact within `$0.01`).
    2. `full_cogs_pct >= meat_cost_pct` on all open service days.
    3. Zero banned statistical jargon in rendered strings.
    4. Zero raw invoice strings leaked into `full_cogs.json` or `payloads.js`.
  - Create `tests/e2e/full_cogs_card.spec.js` verifying adjacent desktop placement, mobile vertical stack with zero horizontal overflow, toggle state, and zero console errors.
- **Verification:**
  - `.venv/bin/python scripts/verify_cogs_math.py` exits `0`.
  - `.venv/bin/python -m unittest discover -s clover_api/tests` exits `0`.
  - `npm test -- tests/e2e/full_cogs_card.spec.js` and full `npm test` pass with exact counts reported.

### Task 5: Adversarial Critic Audit & `.loop/` State Closure
- **Action:**
  - Spawn read-only Critic subagent to audit math integrity, UI alignment, and plain-English copy (must score `>= 9/10`).
  - Update `.loop/prd.json` (`passes: true`), `.loop/patterns.md` (keeping `<= 40` lines), and `.loop/log.md` with exact verification output.
- **Verification:** All Tier 1 & Tier 2 gates green; Critic score `>= 9/10`.
