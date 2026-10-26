# Yellow Rose BBQ Command Center — v2.0.0 System Version Update & Comprehensive Facelift Plan

## 1. Executive Summary & Architectural Decisions
- **Target Semantic Version:** `v1.0.0` ➔ `v2.0.0` (published with root `CHANGELOG.md` and `VERSION_PLAN.md`).
- **Baseline Archive:** `backups/archive_pre_v2_20261026.tar.gz` (verified intact prior to workspace mutations).
- **Responsive Architecture:** Unified Fluid Responsive Layout (`index.html` + `style.css` Grid/Flex/Media queries) featuring an Executive BI Multi-Column Command Center on desktop (`>= 768px`) and a Kitchen-Line Handheld Mode with a sticky bottom thumb-navigation bar and `>= 44x44px` (`48px` target) touch controls on mobile (`< 768px`).
- **Charting & Strict Mobile Touch Invariant:** Calibrated D3 v7 SVG + Executive Plotly Theme. On viewports `< 768px`, all 6 charts enforce `staticPlot: true`, `pointer-events: none`, and `touch-action: pan-y` with direct data-value callouts so vertical scrolling is never hijacked.
- **Directory Sanitation Policy:** Relocate stale root scripts (`fix_*.py`, `patch*.js`, `app_old.js`, root CSV/PNG/log dumps) into `archive/legacy_v1/`, consolidate active COGS models in `data/`, and remove redundant virtualenvs (`.venv2`, `.venv3`, `.venv4`, `venv`), retaining `.venv`.

---

## 2. 2D Layout Wireframes (Current v1.0.0 vs. Proposed v2.0.0)

### A. Current Layout (v1.0.0)
```text
+-----------------------------------------------------------------------+
| 🔥 Sausage & BBQ Prep Command   [Sausage Tracker] [POS Analytics]     |
+-----------------------------------------------------------------------+
| [Verbose Beginner Explainer Accordion + Long How-To Date Banner]      |
| [Calendar Picker] [10 Cramped Horizon Pill Buttons Wrapping Unevenly] |
| [Time-Travel Simulator Bar]                                           |
| [14 KPI Cards in Uniform Grid — Mixed Hierarchy & Inline Styles]      |
| [Sub-Tab Bar: 6 Buttons]                                              |
| [Long Verbose "Step-by-Step Reasoning" Marketing Text Block]          |
| [Chart Card: Plotly/D3 with Hover Overlay Trapping Mobile Touch]      |
+-----------------------------------------------------------------------+
```

### B. Proposed v2.0.0 Desktop Executive BI Layout (`>= 768px`)
```text
+-----------------------------------------------------------------------------------+
| 🔥 YELLOW ROSE BBQ | COMMAND v2.0.0    [● Live ET]  [Tab 1: Prep] [Tab 2: BI]     |
+-----------------------------------------------------------------------------------+
| [Date Range] [Quick Horizons: Today | Tomorrow | Weekend | 7D | 14D] [Sim Scrub]  |
+-----------------------------------------+-----------------------------------------+
| PRIMARY PITMASTER PREP TARGETS (COOKED) | REVENUE, PACING & ECONOMICS             |
| +-----------+ +-----------+ +---------+ | +-----------+ +-----------+ +---------+ |
| | Brisket   | | Pork      | | Turkey  | | | Revenue   | | Food Cost | | Velocity| |
| | Raw/Cases | | Raw/Cases | | Raw/Lbs | | | Blended   | | COGS %    | | AOV/Hrs | |
| +-----------+ +-----------+ +---------+ | +-----------+ +-----------+ +---------+ |
+-----------------------------------------+-----------------------------------------+
| [Analytics Views: Hourly Velocity | Baseline | Heatmap | Weather | Events | Adv]  |
+-------------------------------------------------------+---------------------------+
| CALIBRATED EXECUTIVE CHART PANEL (High Data-Ink)      | CONCISE OPERATIONAL BRIEF |
| - Calibrated axes, explicit units ($ / lbs / orders)  | - Bulletized action items |
| - Interactive crosshair & rich tooltips (Desktop)     | - Zero AI filler/slop     |
+-------------------------------------------------------+---------------------------+
```

### C. Proposed v2.0.0 Mobile Kitchen-Line Layout (`< 768px` / `375px–414px`)
```text
+--------------------------------------+
| 🔥 YELLOW ROSE v2.0      [● Live ET] |
+--------------------------------------+
| [Date Picker (48px)] [Horizon Scroll]|
| [Compact Sim Bar: Live | 12P | 7P]   |
+--------------------------------------+
| 2-COLUMN HIGH-CONTRAST KPI CARDS     |
| +----------------+ +---------------+ |
| | Revenue / Pace | | Brisket Prep  | |
| +----------------+ +---------------+ |
| | Pork Prep      | | Turkey / Ribs | |
| +----------------+ +---------------+ |
+--------------------------------------+
| STATIC TOUCH-SAFE CHART CARD         |
| [SVG/Canvas: pointer-events: none]   |
| [touch-action: pan-y | Direct Badges]|
| (Zero hover traps — smooth scroll)   |
+--------------------------------------+
| CONCISE 3-BULLET PIT DIRECTIVES      |
+======================================+
| [ 🌭 Sausage Prep ] [ 📊 POS & Prep ]| <-- Sticky Bottom Thumb Bar (>=48px)
+======================================+
```

---

## 3. Milestone Checklist & Verification Gates (`.loop/prd.json`)
- [x] **Milestone 0 (Pre-Flight):** Baseline backup `backups/archive_pre_v2_20261026.tar.gz` created & verified; `.loop/` initialized.
- [x] **Milestone 1 (Task 12 — Directory Sanitation):** Move 20+ orphaned root scripts/dumps to `archive/legacy_v1/`, prune `.venv2`/`.venv3`/`.venv4`/`venv`, document clean directory structure.
- [x] **Milestone 2 (Task 13 — Code Logic & PAL Math Audit):** Audit sausage formulation scaling, culinary yield conversions, COGS/food-cost engine, and forecasting models; verify with deterministic PAL tests.
- [x] **Milestone 3 (Task 14 — Zero-Trust Security Audit):** Fix world-writable (`0777`/`0666`) file permissions, replace `document.write()` loader with safe script/stylesheet loading, tighten CSP, and verify SQL parameterization & secret isolation.
- [x] **Milestone 4 (Task 15 — Executive BI Charts & Mobile Touch Invariant):** Overhaul Plotly & D3 charts with high data-ink executive styling and enforce strict mobile non-interactivity (`staticPlot: true`, `pointer-events: none`, `touch-action: pan-y` on `< 768px`).
- [x] **Milestone 5 (Task 16 — Anti-Slop Copywriting Overhaul):** Rewrite verbose explainers and filler text into sharp, executive/pitmaster operational bullets while preserving all Playwright e2e text invariants.
- [x] **Milestone 6 (Task 17 — Mobile-First Facelift, Debug Token Panel & `progress.html`):** Implement responsive layout, sticky mobile bottom navigation, `>= 44x44px` touch targets, interactive viewport/theme debug panel (`Copy Settings as JSON`), side-by-side desktop/mobile screenshots in `progress.html`, root `CHANGELOG.md`, and Adversarial Critic review (`>= 9/10`).
