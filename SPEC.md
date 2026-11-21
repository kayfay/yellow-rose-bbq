# SPEC.md — Interactive Plate & Recipe Cost Explorer Subtab + Page 1 Executive Category Rollup

## 1. Overview
This specification defines two coordinated enhancements for Yellow Rose BBQ (`sausage.allen.tools`):
1. **Interactive "🧾 Plate & Recipe Costs" Subtab (`#subtab-view-plate-costs`):** A new subtab inside **POS Analytics & Forecasting** (placed right next to **📝 Shop Reports**) that lets the owner interactively inspect all **137 menu items** (with expandable line-by-line inventory, fresh veggies, bakery, sauce, and to-go packaging breakdowns), all **34 house recipes (151 ingredient lines)**, and the **Category-by-Category Base vs. Full To-Go Food Cost % Rollup**.
2. **Page 1 Category-by-Category Food Cost % Rollup in the Master PDF:** Highlights the **Category-by-Category Base vs. Full To-Go Food Cost % Rollup Table** and top cost-reduction opportunities right on **Page 1** of `YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.pdf` (and `.html`) alongside the existing executive summary.

---

## 2. Functional Requirements (EARS Syntax)

### 2.1 Page 1 Executive Summary & Category Rollup (Master PDF + Subtab Top)
- **REQ-01 (Page 1 Category Rollup):** When generating the Master PDF/HTML report, Page 1 shall display a clean print **Category-by-Category Base vs. Full To-Go Food Cost % Rollup Table**; when rendering inside the mobile-first web subtab (`#subtab-view-plate-costs`), the same 8-category rollup shall render as **tappable Category Summary Cards** with visual Base-vs-To-Go progress bars (1-column stack on mobile, 2-column grid on desktop, zero wide HTML tables).
- **REQ-02 (Cost-Reduction Highlights):** When rendering the Page 1 Executive Summary and subtab stat strip, the system shall highlight overall Base vs. Full To-Go Food Cost %, average To-Go Packaging & Sauce add-on per item, and high-cost watchlist items (`>36%` Full To-Go Food Cost).

### 2.2 Interactive Plate & Recipe Costs Subtab (`#subtab-view-plate-costs`)
- **REQ-03 (Subtab Placement & Roll-Up Invariant):** When viewing **POS Analytics & Forecasting**, the system shall render `#btn-subtab-plate-costs` (`🧾 Plate & Recipe Costs`) next to `#btn-subtab-reports` (`📝 Shop Reports`). The subtab view (`#subtab-view-plate-costs`) shall start with a 3-card `.subtab-stat-strip` and a collapsible `.rollup-section` (`min-height: 48px` `.rollup-header`).
- **REQ-04 (Mobile-First Card Explorer, Search & Sorting):** When inspecting the **137 Menu Items** or **34 House Recipes** inside `#subtab-view-plate-costs`, the system shall render **stacked, touch-friendly accordion cards** (never wide horizontal-scroll tables), with:
  1. Quick-filter pills (`All 137 Items`, `High Cost >36%`, `Watch 32–36%`, `34 House Recipes`) + tap-to-filter Category Summary Cards.
  2. Full-width `>= 48px` live search input (matches menu item, ingredient, packaging, or recipe name).
  3. Mobile-friendly Sort dropdown (`Highest Full Cost %`, `Biggest To-Go Add-On $`, `Lowest Profit Cushion $`, `Name A–Z`).
- **REQ-05 (Expandable Vertical Line-by-Line BOM Drill-Down):** When the user taps any of the 137 menu item cards or 34 recipe cards, the card shall expand in-place to display a clean **vertical line-item list** (Ingredient/Item + Qty on left, Cost on right — zero cramped columns):
  - For Menu Items: Core Portion + Fresh Veggies + Bakery + Sauces (OG, Spicy, or Mustard) + To-Go Packaging, clearly tagging `$0.00` already-included items to prevent double-counting.
  - For House Recipes: Every ingredient line (151 total lines across 34 recipes), exact measurement, supply anchor, ingredient cost, and `% of batch`.

### 2.3 Plain-English, Security & Mobile Ergonomics Invariants
- **REQ-06 (Zero Banned Acronym/Jargon in UI):** All visible UI copy in `index.html`, `analytics_subtabs.js`, and `plate_cost_explorer.json` shall strictly avoid banned terms from `smokehouse_ux.spec.js` (`velocity`, `variance`, `z-score`, `sigma`, `cogs`, `dow base`, `buffer margin`), using `Food Cost`, `Base Portion Cost`, `Full To-Go Cost`, and `Plate & Recipe Costs`.
- **REQ-07 (Zero Raw Invoice File Leakage):** Public SPA files (`index.html`, `app.js`, `payloads.js`) shall never embed raw vendor invoice filenames (`YRBBQ_Detail_Data`, `YRBBQ_Product_Usage`, `four_bucket_cogs_report`) or raw 3,060-line invoice delivery dumps. All files under `data/vendor_invoices/reports/` shall remain mode `0600`.
- **REQ-08 (Mobile Touch-Safety):** All filter pills, search inputs, sort headers, and expandable row toggles shall have tap targets `>= 48px` and body text `>= 16px` on mobile (`< 768px`) with zero horizontal overflow.
