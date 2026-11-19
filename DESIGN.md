# DESIGN.md — Full COGS Engine Architecture, Wireframe & Contracts

## 1. 2D Dashboard Card Layout Blueprint

### Desktop (`>= 768px`) — Side-by-Side `.cost-cards-grid`
```text
+------------------------------------------+   +-------------------------------------------------+
|  EST. MEAT COST                          |   |  FULL COGS (FULL FOOD COST)      [Healthy <32%] |
|                                          |   |                                                 |
|  28.4%                                   |   |  34.2%                                          |
|  Est. Meat Cost Share                    |   |  $4,104 Full Food Cost                          |
|  (~$3,408 Est. Meat Cost)                |   |  Meat: $3,408 (28.4%) • Non-Meat: $696 (5.8%)   |
|                                          |   |  Sides/Buns: $412 | Paper/Sauce: $284           |
+------------------------------------------+   +-------------------------------------------------+
                                               [ Toggle: (Meat Only) | (Full COGS) ]
```

### Mobile (`< 768px`) — Stacked Single Column (`touch-action: pan-y`, `>= 48px` tap targets)
```text
+------------------------------------------+
|  EST. MEAT COST                          |
|  28.4%  (~$3,408 Est. Meat Cost)         |
+------------------------------------------+
|  FULL COGS (FULL FOOD COST) [Watch 32-36]|
|  34.2%  ($4,104 Full Food Cost)          |
|  Meat: $3,408 (28.4%) • Non-Meat: $696   |
|  Sides/Buns: $412 | Paper/Sauce: $284    |
+------------------------------------------+
```

---

## 2. Recipe Bill-of-Materials Schema (`clover_api/analytics/recipe_bom.json`)

Each Clover menu item key maps to its complete plate BOM. Meat cost derives from `unit_conversions.py` raw-to-cooked yields and invoice protein rates; non-meat components use calibrated unit costs reconciled against `data/vendor_invoices/`.

```json
{
  "version": "1.0.0",
  "default_targets": {
    "green_max_pct": 32.0,
    "amber_max_pct": 36.0
  },
  "recipes": {
    "brisket_sandwich": {
      "meat_cut": "brisket",
      "cooked_meat_lbs": 0.33,
      "bun_cost": 0.42,
      "sides_cost": 0.00,
      "sauce_cost": 0.25,
      "paper_tray_cost": 0.38,
      "pickle_onion_cost": 0.15
    },
    "pulled_pork_sandwich": {
      "meat_cut": "pork",
      "cooked_meat_lbs": 0.33,
      "bun_cost": 0.42,
      "sides_cost": 0.00,
      "sauce_cost": 0.25,
      "paper_tray_cost": 0.38,
      "pickle_onion_cost": 0.15
    },
    "two_meat_plate": {
      "meat_cut": "mixed_plate",
      "cooked_meat_lbs": 0.75,
      "bun_cost": 0.28,
      "sides_cost": 1.35,
      "sauce_cost": 0.35,
      "paper_tray_cost": 0.65,
      "pickle_onion_cost": 0.18
    },
    "family_pack": {
      "meat_cut": "mixed_bulk",
      "cooked_meat_lbs": 2.00,
      "bun_cost": 1.68,
      "sides_cost": 3.80,
      "sauce_cost": 0.90,
      "paper_tray_cost": 1.45,
      "pickle_onion_cost": 0.45
    }
  }
}
```

### Category Roll-Up Mapping
- **`meat_cost`**: Cooked lbs × yield-adjusted raw protein cost (from `unit_conversions.py` / `food_cost_engine.py`).
- **`bakery_cost`**: `bun_cost + pickle_onion_cost` (Bakery & Perishables).
- **`sides_cost`**: `sides_cost` (Mac & cheese, slaw, potato salad, baked beans, collard greens).
- **`packaging_cost`**: `paper_tray_cost + sauce_cost` (Packaging, disposables, rubs, sauces, wood allowance).
- **`non_meat_cost`**: `bakery_cost + sides_cost + packaging_cost`.
- **`total_cogs`**: `meat_cost + non_meat_cost`.

---

## 3. Payload & API Contract

### Generated Static JSON & Local Route
- **File:** `clover_api/analytics/full_cogs.json` (bundled into `clover_api/analytics/payloads.js` via `build_payloads.py`).
- **Local Server Route:** `/api/analytics/full_cogs` (served by `local_server.py` / static payload).

```json
{
  "generated_at": "2026-11-19T08:00:00-05:00",
  "target_bands": {
    "green_max_pct": 32.0,
    "amber_max_pct": 36.0
  },
  "daily": {
    "2026-11-18": {
      "status": "ok",
      "gross_revenue": 12000.00,
      "meat_cost": 3408.00,
      "bakery_cost": 168.00,
      "sides_cost": 244.00,
      "packaging_cost": 284.00,
      "non_meat_cost": 696.00,
      "total_cogs": 4104.00,
      "meat_cost_pct": 28.4,
      "cogs_pct": 34.2,
      "pacing_band": "amber",
      "pacing_label": "Watch (32–36%)"
    }
  }
}
```

*Guard state:* On Monday (`status: "closed"`) or when `gross_revenue <= 0` (`status: "pending"`), `cogs_pct` is `null` and UI renders `$0 (Closed)` or `Pending Service`.

---

## 4. Affected Files & State Contracts

| File | Responsibility |
|---|---|
| `clover_api/analytics/recipe_bom.json` | Declarative recipe BOM catalog and target band constants. |
| `clover_api/analytics/cost_engine.py` | Backend Full COGS calculation engine; joins Clover POS line items with `recipe_bom.json` and `data/vendor_invoices/` unit rates; writes `full_cogs.json`. |
| `clover_api/analytics/build_payloads.py` | Registers `full_cogs.json` into `payloads.js` (`window.FULL_COGS_PAYLOAD`). |
| `index.html` | Adds `#kpi-card-full-cogs-container` adjacent to `#kpi-card-food-cost-container` inside `.cost-cards-grid`, plus Shop Reports mirror and `?v=` cache-bust bump. |
| `style.css` | Styles `.cost-cards-grid`, `.cogs-pacing-pill` (Okabe-Ito Green/Amber/Vermillion), responsive mobile wrap (`< 768px`), and `>= 48px` toggle buttons. |
| `modules/forecaster/analytics_subtabs.js` | Hydrates the Full COGS Card, manages `[Meat Only | Full COGS]` toggle state, and enforces read-only payload cloning + `NaN`/zero-revenue guards. |
| `app.js` | Syncs Full COGS Card updates on date-picker changes and live pace refreshes. |
| `scripts/verify_cogs_math.py` | Deterministic PAL verifier asserting math parity, monotonicity, and zero banned jargon. |
| `clover_api/tests/test_cost_engine.py` | Python `unittest` suite for BOM depletion, invoice fallback, and closed/partial day guards. |
| `tests/e2e/full_cogs_card.spec.js` | Playwright E2E test verifying adjacent card layout, toggle behavior, mobile stacking, and zero console errors. |
