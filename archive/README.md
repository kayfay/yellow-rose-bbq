# Archive Directory Catalog

This directory preserves historical prototypes, legacy v1 scripts, and pre-refactoring snapshots under the repository's non-destructive **"Archive and Backup, Never Delete"** policy.

## Root `archive/` Files
| File / Folder | Original Purpose | Archived Date |
|---|---|---|
| `AGENTS.md.2026-10-07.orig` | Original concise `AGENTS.md` agent navigation guide prior to v2.1 harness baseline expansion. | 2026-11-02 |
| `config.py` | Early prototype configuration module superseded by `clover_api/config.py`. | 2026-08-07 |
| `dashboard_demo.html` | Standalone static HTML prototype of the initial analytics dashboard prior to SPA integration. | 2026-08-13 |
| `test.js`, `test_app.js`, `test_http.js`, `test_playwright.js`, `test_playwright_tab.js` | Early ad-hoc Playwright/HTTP smoke test scripts superseded by the structured `tests/e2e/*.spec.js` suite. | 2026-08-13 |
| `legacy_v1/` | Subdirectory containing v1 one-off repair scripts (`fix_*.py`, `patch*.js`), historical CSV/XLSX COGS audits, and v1 screenshots. | 2026-10-26 |

## `archive/legacy_v1/` Contents
- **One-Off Repair & Migration Scripts**: `add_yesterday.py`, `check_dates.py`, `check_weather.py`, `fix_app_js.py`, `fix_arima_dates.py`, `fix_date_init.py`, `fix_html.py`, `fix_kpi_sum.py`, `fix_logic.py`, `fix_security.py`, `fix_weather.py`, `parameterize.py`, `patch.js`, `patch_fix.js`, `update_halo.py`, `update_recipe.py`, `get-pip.py`.
- **Application Snapshots**: `app_old.js` (v1 monolithic client script), `live_site_forecasting.png`, `live_site_full.png`, `live_site_screenshot.png`, `job_logs.txt`, `logs.zip`, `server.log`.
- **Historical Audit & Wholesale Reference Artifacts**: `clover_live_catalog_audit.json`, `Review order detail_91714857_09042026.csv`, `Submitted_Order564310_Cust91714857_09032026.csv`, `yellow_rose_bbq_audit_report.csv`, `yellow_rose_bbq_clover_audit.csv`, `yellow_rose_bbq_cogs.csv`, `yellow_rose_bbq_cogs.xlsx`, `yellow_rose_bbq_complete_cogs_model.csv`, `yellow_rose_bbq_wholesale_yields.csv`.
