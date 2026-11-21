# PLAN.md — Interactive Plate & Recipe Cost Explorer Subtab + Page 1 Master PDF Summary

## Milestones & Deterministic Verification Tasks

### Task 1: Generate `plate_cost_explorer.json` & Update Page 1 of Master PDF
- **Action:**
  - Extend `scripts/plate_bom_line_item_report.py` to compute the 8-category **Base vs. Full To-Go Food Cost % Rollup**, top cost-reduction watchlist items, all 137 menu items (with expandable line-by-line BOM), and all 34 house recipes (151 ingredient lines), writing `clover_api/analytics/plate_cost_explorer.json` (using plain-English keys/copy, zero banned jargon) and updating `clover_api/analytics/build_payloads.py`.
  - Update `scripts/generate_boss_master_exports.py` (and `plate_bom_line_item_report.py` PDF merger) so **Page 1** of `YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.pdf` highlights the **Category-by-Category Base vs. Full To-Go Food Cost Rollup & Top Cost-Reduction Targets** right alongside the existing executive summary, followed by Appendices A, B & C.
- **Verification:**
  - `.venv/bin/python scripts/plate_bom_line_item_report.py` exits `0`.
  - `.venv/bin/python clover_api/analytics/build_payloads.py` exits `0`.

### Task 2: Build `#subtab-view-plate-costs` UI & Interactive Explorer (`index.html`, `style.css`, `analytics_subtabs.js`)
- **Action:**
  - Add `<button type="button" class="preset-btn" id="btn-subtab-plate-costs">🧾 Plate &amp; Recipe Costs</button>` next to `#btn-subtab-reports` in `index.html`.
  - Add `#subtab-view-plate-costs` starting with a 3-card `.subtab-stat-strip` and a `.rollup-section` containing the **Page 1 Category-by-Category Base vs. Full To-Go Food Cost % Rollup Table**, followed by the interactive search/filter/sort explorer for all **137 Menu Items** and **34 House Recipes (151 ingredient lines)** with click-to-expand line-by-line BOM breakdown rows.
  - Wire subtab routing and interactive filtering/sorting/expansion in `modules/forecaster/analytics_subtabs.js` and style in `style.css` (`>= 48px` tap targets, Okabe-Ito status badges, zero horizontal overflow).
  - Bump `?v=` cache-busting query strings in `index.html`.
- **Verification:**
  - `npm run check` passes (`node --check` across all JS files).

### Task 3: Full Verification Suite, Playwright E2E, Google Drive Sync & GitHub Push
- **Action:**
  - Create `tests/e2e/plate_cost_explorer.spec.js` testing subtab navigation, category rollup rendering, search/filter/sort, line-item expansion, mobile touch targets (`>= 48px`), plain-English copy compliance (`smokehouse_ux.spec.js`), and zero console errors.
  - Run `.venv/bin/python -m unittest discover -s clover_api/tests`, `.venv/bin/python scripts/verify_cogs_math.py`, and `npm test`.
  - Sync updated Master PDF to Google Drive via `rclone` and push code changes to `origin/master` when approved.
- **Verification:**
  - `unittest` (45/45), `verify_cogs_math.py`, and Playwright E2E pass with exit code `0`.
