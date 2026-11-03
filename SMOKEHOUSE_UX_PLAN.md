# Yellow Rose BBQ — Smokehouse UX, Plain-English Copywriting & Practical Unit Overhaul (`SMOKEHOUSE_UX_PLAN.md`)

## 1. Executive Summary & Architectural Alignment (`/grill-me` Locked)
This plan governs the Smokehouse UX overhaul of `sausage.allen.tools` (Yellow Rose BBQ):
1. **Plain-English Smokehouse Copywriting ("De-Jargon Pass")**: Purge academic/data-science strings (`MultiMeatForecaster`, `Variance`, `Safety Buffer`, `Model Evaluation`) across the UI and replace with intuitive pitmaster phrasing (**`Pitmaster Daily Forecast`**, **`Difference from Target`**, **`Extra Prep / Cushion`**, **`Cook Accuracy Audit`**). Every Cook Accuracy Audit view starts with a 1-line plain-English takeaway in practical cut counts and pounds.
2. **Practical Unit Display (`KitchenQuantityDisplay`)**: Surface **Cases** and **Individual Cut Counts** (`Cases / Packers`, `Cases / Butts`, `Racks / Cases`) as primary operational figures for kitchen staff while preserving raw/cooked weight accessibility and backward-compatible E2E DOM hooks (`#kpi-brisket-lbs`, `#kpi-pork-lbs`, etc.). Include an on-screen **"Case View / Lbs View"** toggle in `#design-debug-drawer` exported via **"Copy Settings as JSON"**.
3. **24-Hour Hourly Pace Black Gap Fix**: Eliminate the dark bottom rendering void inside `#plotly-predictive-velocity-chart` by calibrating Plotly bottom margins (`b: 90` $\rightarrow$ `b: 48`, legend `y: -0.3` $\rightarrow$ `y: -0.18`), tightening `.chart-card` container heights (`style.css`), and docking the **Prep Cushion / Buffer Margin Status Strip** cleanly between the 24-hour chart and the **Hourly Rush & Service Turnover Deck**.
4. **Simplified Prep Cushion / Buffer Margin UX**: Render an instant visual status strip and stat badge (**`Buffer Margin: +2 Racks / +1 Butt / +1 Brisket`**) with semantic Okabe-Ito-compatible status color coding (**Green** = Safe Cushion, **Yellow** = Tight Prep, **Red** = Under Target).

---

## 2. Calibrated Case & Cut Conversion Standards (US Foods / Yellow Rose Specs)

| Protein Category | Primary Case & Cut Display (`Case View`) | Secondary Subtext (`Lbs & Yield`) | Standard Case Weight | Cut Count per Case | Individual Cut Spec | Cooked Yield % |
|---|---|---|---|---|---|---|
| **Beef Brisket** | `X.X Cases / ~N Briskets` | `~Raw lbs raw • ~Cooked lbs cooked` | **70 lbs / case** | **5 packers / case** | `~14 lbs` raw packer | **40%** (`2.3` 7-oz port/lb) |
| **Pork Butt (Shoulder)** | `X.X Cases / ~N Butts` | `~Raw lbs raw • ~Cooked lbs cooked` | **32 lbs / case** | **4 butts / case** | `~8 lbs` bone-in butt | **44%** (`2.0` 8-oz port/lb) |
| **Pork Spare Ribs** | `N Racks (~X.X Cases)` | `~Bags cryovac bags • ~Raw lbs raw` | **30 lbs / case** | **6 racks / case** | `~5 lbs / rack` (12 bones; 2/bag) | **60%** |
| **Beef Dino Ribs** | `N Ribs (~X.X Cases)` | `3-bone plate ribs • ~Raw lbs raw` | **48 lbs / case** | **12 ribs / case** | `~4 lbs / rib` (3 bags/case) | **50%** |
| **Smoked Turkey Breast** | `~X.X Cases / ~N Breasts` | `~Cooked lbs cooked • ~Raw lbs raw` | **20 lbs / case** | **2 breasts / case** | `~10 lbs` boneless breast | **70%** (`3.2` 5-oz port/lb) |
| **House Sausage** | `N Batches (~Links Links)` | `~Stuffed lbs stuffed (@ 3.0 links/lb)` | **60 lbs / batch** | **~180 links / batch** | `1/3 lb` per link (`50 lb` base) | **85%** |

---

## 3. 2D Layout & Unit Conversion Blueprint

```text
+=========================================================================================+
|  PROJECTED PREP TARGETS & SUPPLIER CASE ORDERS        [ Mode: 📦 Case & Cut View  ⇄ ]   |
+=========================================================================================+
|  +---------------------------------------+   +---------------------------------------+  |
|  | 🥩 BRISKET PREP TARGET                |   | 🐖 PORK BUTT PREP TARGET              |  |
|  |  1.9 Cases / ~10 Briskets  [Primary]  |   |  2.4 Cases / ~10 Butts     [Primary]  |  |
|  |  ~129 lbs raw • ~52 lbs cooked        |   |  ~76 lbs raw • ~33 lbs cooked         |  |
|  |  +---------------------------------+  |   |  +---------------------------------+  |  |
|  |  | Cook Target: ~10 Briskets       |  |   |  | Cook Target: ~10 Butts          |  |  |
|  |  | Difference from Target: On Pace |  |   |  | Difference from Target: On Pace |  |  |
|  |  +---------------------------------+  |   |  +---------------------------------+  |  |
|  |  [=======|===] 112% vs. Usual Prep    |   |  [=======|===] 110% vs. Usual Prep    |  |
|  +---------------------------------------+   +---------------------------------------+  |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  | 📊 END-OF-DAY COOK ACCURACY AUDIT & YIELD CHECK           [ Cook Target On Track ]|  |
|  | 💡 Takeaway: We cooked 1 extra brisket than needed today (+14 lbs over target).   |  |
|  | [ Planned Revenue ]  [ Actual POS Sales ]  [ Difference from Target ] [ Meat Cost]|  |
|  +-----------------------------------------------------------------------------------+  |
+=========================================================================================+

+=========================================================================================+
|  ⚡ 24-HOUR HOURLY SALES PACE & MEAT DRAW (REPAIRED ZERO-GAP LAYOUT)                    |
+=========================================================================================+
|  +-----------------------------------------------------------------------------------+  |
|  |  24-Hour Hourly Sales Pace & Meat Draw                                            |  |
|  |  [▲ PEAK: 12:00 PM (14.5 orders/hr)] [▼ LOW: 3:00 PM] [● NOW: 11:00 AM]           |  |
|  |   15 |          /\                        /\                                      |  |
|  |   10 |         /  \                      /  \                                     |  |
|  |    5 |________/____\____________________/____\________                            |  |
|  |       11AM   12PM   1PM   2PM   3PM   5PM   6PM   8PM                             |  |
|  |  [— Hourly Sales Pace (Orders/hr)] [■ Cooked Brisket Used (lbs/hr)]               |  |
|  |  (Zero empty black space — compact 44px bottom margin + snug card padding)        |  |
|  +-----------------------------------------------------------------------------------+  |
|  | 🛡️ PREP CUSHION STATUS: [ ● SAFE CUSHION (+10% Extra Prep) ]                      |  |
|  | Buffer Margin: +1 Brisket (+13 lbs) • +2 Spare Rib Racks • +1 Pork Butt (+8 lbs)  |  |
|  +-----------------------------------------------------------------------------------+  |
|  | ⚡ HOURLY RUSH & SERVICE TURNOVER DECK (11 AM – 9 PM Service)                 [▼] |  |
|  | [ 11:00 AM ]  [ 12:00 PM • Lunch Rush ]  [ 1:00 PM • Lunch Rush ]  [ 2:00 PM ]    |  |
+=========================================================================================+
```

---

## 4. Milestone Checklist (`.loop/prd.json` Tasks 31–34)

- [ ] **Milestone 1 (Task 31 — Plain-English Smokehouse Copywriting / "De-Jargon Pass")**
  - Replace `End-of-Day Model Evaluation & Plain-English Yield Audit` with **`End-of-Day Cook Accuracy Audit & Yield Check`**.
  - Replace `MultiMeatForecaster` with **`Pitmaster Daily Forecast`**, `safety buffer` with **`Extra Prep / Cushion`**, and `Variance:` / `Model Variance Pacing` / `Total Day Variance` with **`Difference from Target`** / **`Pace vs. Target`** / **`Total Day Difference`**.
  - Prepend a 1-line plain-English takeaway banner (`.audit-plain-takeaway`) at the top of `#model-eval-body` translating differences into whole briskets, pork butts, and rib racks (e.g., *"Takeaway: We cooked 1 extra brisket than needed today (+14 lbs over target)."*).
- [ ] **Milestone 2 (Task 32 — `KitchenQuantityDisplay` & Practical Case/Cut Formatting)**
  - Implement reusable `KitchenQuantityDisplay` helper in `modules/shared/core_utils.js` supporting both **`case`** mode (default: primary Case & Cut Counts with raw/cooked lbs subtext) and **`lbs`** mode (raw/cooked lbs primary with case/cut badge).
  - Add `#btn-debug-unit-mode` (`Units: Case & Cut View` / `Units: Raw Lbs View`) in `#design-debug-drawer` and export `unitDisplayMode` in `window.__LAST_COPIED_DESIGN_TOKENS__`.
  - Maintain 100% compatibility with existing Playwright E2E selectors (`#kpi-brisket-lbs`, `#kpi-pork-lbs`, `#kpi-sausage-batches`, `#kpi-pork-ribs-racks`, `#kpi-beef-dino-ribs`, `#kpi-turkey-lbs`).
- [ ] **Milestone 3 (Task 33 — 24-Hour Velocity Black Space Fix & Simplified Prep Cushion UX)**
  - Fix the dark gap under `#plotly-predictive-velocity-chart` by tightening Plotly `layout.margin.b` (`48` desktop / `44` mobile), setting `layout.height = 320`, and removing excess `.chart-card` bottom dead-space in `style.css`.
  - Add `#prep-safety-margin-strip` directly below the 24-hour chart (and update the `#subtab-view-arima` stat card) displaying **`Buffer Margin: +2 Racks / +1 Butt / +1 Brisket`** with semantic status pill (`Green = Safe Cushion`, `Yellow = Tight Prep`, `Red = Under Par`).
- [ ] **Milestone 4 (Task 34 — Deterministic PAL & E2E Tests, `progress.html` & Adversarial Critic)**
  - Create deterministic verification suite (`scripts/verify_smokehouse_ux_pal.py` and `tests/e2e/smokehouse_ux.spec.js`) testing unit conversion math, zero banned jargon in DOM, zero dark gap under the 24h velocity chart, and Prep Cushion status rendering.
  - Refresh desktop/mobile screenshots and `progress.html`.
  - Pass independent Adversarial Critic review with score $\ge 9.0 / 10$.

---

## 5. Ready-to-Run `/goal` Command

```text
/goal Execute SMOKEHOUSE_UX_PLAN.md (Tasks 31-34 in .loop/prd.json): complete the Plain-English Smokehouse De-Jargon Pass, implement KitchenQuantityDisplay with primary Case & Cut counts and debug toggle, fix the black gap beneath the 24-hour velocity chart, add the color-coded Prep Cushion status strip (+Racks/+Butts/+Briskets), run all PAL and Playwright E2E verification gates, update progress.html, and pass the independent Adversarial Critic audit (>=9/10).
```
