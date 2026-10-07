# Yellow Rose BBQ - Agent Guide

## Navigation & Architecture

- **Frontend Core**: Single-page application optimized for mobile kitchen production.
  - UI Markup: [`index.html`](index.html)
  - Application Logic & UI State: [`app.js`](app.js)
  - Chart Rendering: [`d3_charts.js`](d3_charts.js)
  - Styling & Layout: [`style.css`](style.css)

- **POS & Analytics Pipeline**:
  - Ingestion: [`clover_api/ingest.py`](clover_api/ingest.py), [`clover_api/ingest_itemized.py`](clover_api/ingest_itemized.py)
  - Machine Learning & Analytics: [`clover_api/analytics/`](clover_api/analytics/)
  - Payload Generation: Bundles analytics output into [`clover_api/analytics/payloads.js`](clover_api/analytics/payloads.js) via [`clover_api/analytics/build_payloads.py`](clover_api/analytics/build_payloads.py)
  - Automated Sync: Hourly GitHub Action defined in [`.github/workflows/update_clover_data.yml`](.github/workflows/update_clover_data.yml)

- **Legacy Scripts Notice**:
  - Root scripts prefixed with `fix_*.py` or `patch*.js` are historical one-off repair files. Do not import or modify them.

## Development & Runtime Environment

- **Python Virtual Environment**:
  - The canonical environment containing all dependencies (`polars`, `xgboost`, `scikit-learn`, `statsmodels`) is `.venv4`.
  - Run python scripts using: `.venv4/bin/python <script_path>`

- **Verification & Testing**:
  - Syntax check: `npm run check` (runs `node --check app.js d3_charts.js`)
  - End-to-end tests: `npm test` (or `bash run_tests.sh`)

## Review & Standards

- Reviewer agents must enforce rules defined in [`CODING_STANDARDS.md`](CODING_STANDARDS.md).
