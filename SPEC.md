# SPEC.md — Comprehensive Cost of Goods Sold (Full COGS) Engine & UI Card

## 1. Overview
This specification defines the **Full COGS Engine** and adjacent **Full COGS Card** for the Yellow Rose BBQ dashboard (`sausage.allen.tools`). While the existing **Est. Meat Cost** card tracks wholesale protein batch cost against gross sales, the Full COGS Engine adds non-meat inventory depleted during service—packaging/disposables, bakery/perishables, pantry/consumables (rubs, sauces, wood), and prepared sides—to report true operational plate cost.

### Aligned Defaults (Phase 1)
- **Allocation Model:** Granular recipe Bill-of-Materials (`recipe_bom.json`) per sold Clover menu item, with calibrated smokehouse defaults overridden by `data/vendor_invoices/` unit costs where available.
- **Target Benchmark Thresholds (Full COGS %):**
  - **Green (Healthy Pacing):** `< 32.0%` (`#009E73`, Okabe-Ito Green)
  - **Amber (Watch / Tight):** `32.0% – 36.0%` (`#E69F00`, Okabe-Ito Orange)
  - **Red (Over Budget):** `> 36.0%` (`#D55E00`, Okabe-Ito Vermillion)
  - *(Reference Meat-Only COGS band: ~26%–29%)*
- **Security & Privacy Invariant:** Raw wholesale vendor invoice unit prices stay server-side / offline in `data/vendor_invoices/` (`0600`) and encrypted `backups/*.enc`. Only aggregated category totals (`meat_cost`, `bakery_cost`, `sides_cost`, `packaging_cost`, `total_cogs`, `cogs_pct`) are emitted to client payloads.

---

## 2. Functional Requirements (EARS Syntax)

### 2.1 Backend BOM Depletion & Cost Engine
- **REQ-01 (BOM Depletion Invariant):** When processing sold line items from Clover POS transactions or daily totals, the system shall multiply item counts by their recipe bill-of-materials (`recipe_bom.json`) to calculate `meat_cost`, `bakery_cost`, `sides_cost`, and `packaging_cost`.
- **REQ-02 (Vendor Invoice Reconciliation):** When `data/vendor_invoices/` CSVs are present during pipeline execution, the system shall ingest unit costs for proteins, bakery items, sides ingredients, sauces, and disposables to update BOM unit rates without printing, logging, or exposing raw invoice lines in public JSON/JS payloads.
- **REQ-03 (Fault-Isolated Degradation):** If `data/vendor_invoices/` is missing or an item lacks a vendor invoice match, the system shall log `[WARN]` and fall back to calibrated default unit costs in `recipe_bom.json` without blocking `build_payloads.py`.
- **REQ-04 (Full COGS Math Parity):** When computing daily or period Full COGS, `total_cogs` shall strictly equal `meat_cost + non_meat_cost` (where `non_meat_cost = bakery_cost + sides_cost + packaging_cost`), and `cogs_pct` shall calculate as `(total_cogs / gross_revenue) * 100`.
- **REQ-05 (Monotonicity Invariant):** For every open service day with positive sales, `full_cogs_pct` shall be greater than or equal to `meat_cost_pct`, and `total_cogs` shall be greater than or equal to `meat_cost`.

### 2.2 Frontend Card Layout & Hydration
- **REQ-06 (Adjacent Grid Placement):** When viewing the Forecaster KPI strip (`index.html`) and Cost/Shop Reports subtabs, the **Full COGS Card** shall render directly adjacent to the **Est. Meat Cost Card** in a responsive `.cost-cards-grid` container, maintaining equal card height on desktop (`>= 768px`) and stacking cleanly with zero horizontal overflow on mobile (`< 768px`).
- **REQ-07 (Card Information Hierarchy):** When rendering the Full COGS Card, the system shall display:
  1. Primary metric: Total Full COGS `$` and `%` of gross sales.
  2. Comparative subtext: `Meat: $X,XXX (XX%) • Non-Meat: $X,XXX (XX%)` plus category breakdown (`Sides/Buns: $A | Paper/Sauce: $B`).
  3. Visual pacing pill: Color-coded Okabe-Ito status badge comparing Full COGS % against the 32% / 36% food cost target bands.
- **REQ-08 (Partial Day & Closed Day Guard):** When viewing a closed day (Monday) or a partial-day / pre-service sync state where `gross_revenue <= 0`, the Full COGS Card shall display `Pending Service` (or `$0 (Closed)` on Monday) instead of `0.0%`, `Infinity%`, or `NaN%`, and shall emit zero console errors.
- **REQ-09 (View Mode Toggle):** When toggling between `Meat Only` and `Full COGS` in the analytics subtabs, the system shall update the active cost comparison in-place without page reload, modal traps, or stale placeholder flash.
- **REQ-10 (Subtab Hydration):** When switching between Forecaster, Menu Mix, and Shop Reports subtabs, the system shall hydrate both the Est. Meat Cost Card and Full COGS Card from read-only cloned payloads without mutating `dashPayload` or `historicalRecords`.

### 2.3 Copywriting, Ergonomics & Security
- **REQ-11 (Plain-English Reporting):** The Full COGS Card, tooltips, and JD assistant messages shall strictly prohibit statistical jargon (`regression`, `variance`, `heteroskedasticity`, `Z-Score`, `Sigma`, `DOW Base`, `Elasticity`), using commercial kitchen terms such as `Full Food Cost`, `Meat Cost vs. Full COGS`, and `Plate Cost Cushion`.
- **REQ-12 (Mobile Touch-Safety):** On viewports `< 768px`, all interactive controls (including the `[Meat Only | Full COGS]` toggle) shall have tap targets `>= 48px` and body text `>= 16px`.
- **REQ-13 (Cache Busting):** When `app.js`, `modules/forecaster/analytics_subtabs.js`, or `style.css` are modified, the `?v=` query parameter in `index.html` shall be bumped.
