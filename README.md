# Yellow Rose BBQ — Sausage & BBQ Prep Command Center (`v2.0.0`)

An executive Business Intelligence (BI) and mobile-first kitchen-line command center, sausage formulation calculator, and multi-meat Clover POS forecasting platform for Yellow Rose BBQ.

## System Overview & Architecture

The Yellow Rose BBQ Command Center operates on a decoupled, serverless architecture combining a responsive static frontend hosted on GitHub Pages with an automated Python analytics pipeline executed via GitHub Actions (`.github/workflows/update_clover_data.yml`).

### 1. Repository Directory Structure (`v2.0.0`)
```text
yellow-rose-bbq/
├── index.html                    # Unified responsive Command Center entry point (Desktop BI + Mobile Kitchen Line)
├── style.css                     # Slate Dark design system, responsive breakpoints, & touch-safe chart rules
├── app.js                        # Core client controller, recipe scaler, KPI hydration, & POS turnover simulator
├── d3_charts.js                  # Calibrated D3 v7 SVG chart engine (desktop crosshair / mobile static mode)
├── tz_utils.js                   # America/New_York explicit timezone localization utilities
├── fonts/ & fonts.css            # Self-hosted Inter & JetBrains Mono typography assets
├── clover_api/                   # Clover POS ingestion & ML forecasting backend
│   ├── ingest.py / ingest_*.py   # Clover REST API transaction & catalog ingestion
│   ├── menu_map.py               # POS item-to-meat weight conversion mapping
│   └── analytics/                # Forecasting models (SARIMA, weather, shift, events, COGS) & JSON payloads
├── data/                         # Recipe specifications, COGS models, & wholesale yield tables
├── scripts/                      # Deterministic PAL verifiers, backtesters, drift alerts, & COGS auditors
├── tests/e2e/                    # Playwright end-to-end verification suites
├── .loop/                        # 3-Layer autonomous state harness (prd.json, patterns.md, log.md)
├── archive/legacy_v1/            # Archived v1.0 one-off migration scripts & historical snapshots
├── backups/                      # Local compressed pre-update workspace archives (git-ignored)
├── VERSION_PLAN.md               # v2.0.0 architectural roadmap & wireframe specifications
└── CHANGELOG.md                  # Semantic version release history
```

### 2. Data Pipeline & Forecasting Engine
- **Ingestion:** `clover_api/ingest.py` authenticates with the Clover POS REST API and stores records in a local SQLite database (`clover_sales.db`) using parameterized queries.
- **Multi-Meat Forecasting & Yield Model:** Computes daily and 24-hour demand across Brisket (40% yield), Pulled Pork (44% yield), Smoked Turkey (70% no-trim yield), Pork Spare Ribs, Beef Dino Ribs, Sausage (60 lb stuffed batches), Tacos, and Rosebuds.
- **Timezone Invariant:** All timestamps and 24-hour actual buckets are explicitly localized from UTC to `America/New_York`.

### 3. Responsive & Mobile Touch-Safe UX
- **Desktop (`>= 768px`):** High-density multi-column executive dashboard with interactive Plotly/D3 crosshairs and calibrated tooltips.
- **Mobile (`< 768px`):** Ergonomic `>= 48px` touch targets, sticky bottom thumb-navigation bar, and strictly non-interactive charts (`staticPlot: true`, `pointer-events: none`, `touch-action: pan-y`) to prevent scroll trapping on kitchen handhelds.

### 4. Zero-Trust Security Model
- **Strict Secret Isolation:** `CLOVER_MERCHANT_ID` and `CLOVER_API_KEY` reside exclusively in GitHub Actions Secrets / git-ignored `.env` (`0600`).
- **Static Client Isolation:** Zero credentials, auth headers, or proprietary portion COGS formulas are exposed in public client payloads.
- **Least-Privilege File Permissions:** Source files enforce `0644` and directories/executables enforce `0755`.
