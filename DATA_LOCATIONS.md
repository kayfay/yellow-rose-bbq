# Yellow Rose BBQ - Important Data Locations & Reference Guide

This document indexes all critical business data, databases, cost models, recipes, credentials, and cron jobs for the Yellow Rose BBQ projects.

---

## 1. Databases (POS & Sales Data)

| File / Location | Description |
| :--- | :--- |
| `clover_api/data/clover_sales.db` | Live/primary SQLite database storing Clover POS sales records, order line items, and transaction history. |
| `clover_api/data/clover_data.db` | Secondary Clover synced data, sync tokens, and transaction logs. |
| `clover_api/data/bbq_metrics.db` | Precomputed business metrics, daily/hourly aggregations, and performance counters. |
| `backup_db/bbq_pos_data.db` | Snapshot backup copy of the POS database. |

---

## 2. Cost Models, Wholesale Invoices & Financials

Located in `data/` and `data/vendor_invoices/` (with historical versions in `archive/legacy_v1/` and encrypted vault in `backups/`):

| File / Location | Description |
| :--- | :--- |
| `data/vendor_invoices/YRBBQ_Submitted_Order723891_Cust91714857_11072026.csv` | Recent vendor meat wholesale order confirmation (US Foods / distributor, 11/07/2026). Mode 0600. |
| `data/vendor_invoices/YRBBQ_Invoice History 08-09-2026 - 11-06-2026.csv` | Vendor invoice history across orders and will-call pickups. Mode 0600. |
| `data/vendor_invoices/YRBBQ_Detail Data 08-09-2026 - 11-06-2026.csv` | Vendor line-item delivery inspection and detailed order item transactions. Mode 0600. |
| `data/vendor_invoices/YRBBQDetail Data 08-08-2026 - 11-05-2026.xlsx` | Excel workbook of detailed delivery data and product transactions. Mode 0600. |
| `data/yellow_rose_bbq_cogs.xlsx` | Excel workbook containing recipe unit costs, meat shrinkage calculations, and COGS models. |
| `data/yellow_rose_bbq_cogs.csv` | Exported COGS tabular matrix used by analytics scripts. |
| `data/yellow_rose_bbq_complete_cogs_model.csv` | Comprehensive margin, portion cost, and menu pricing breakdown. |
| `data/yellow_rose_bbq_wholesale_yields.csv` | Trim loss, cooked yields, and raw-to-smoked meat conversion ratios. |
| `data/yellow_rose_bbq_clover_audit.csv` | Menu price discrepancy audit comparing POS prices to recipe costs. |
| `data/yellow_rose_bbq_audit_report.csv` | Historical vendor and item audit logs. |
| `data/Submitted_Order564310_Cust91714857_09032026.csv` | Historical vendor meat wholesale invoice / order confirmation (09/03/2026). Mode 0600. |
| `data/Review order detail_91714857_09042026.csv` | Historical vendor line-item delivery inspection and invoice details (09/04/2026). Mode 0600. |
| `backups/yrbbq_vendor_data_encrypted_20261107.tar.gz.enc` | Encrypted archive (AES-256-CBC, PBKDF2) containing all confidential vendor invoices and detail data. Mode 0600. |
| `scripts/secure_data_vault.py` | Confidential Data Vault encryption, verification, and privacy audit utility (`encrypt`, `decrypt`, `verify`, `audit`). |

---

## 3. Recipes, Formulations & Menus

| File / Location | Description |
| :--- | :--- |
| `modules/recipes/sausage_calc.js` | House sausage recipes and the 50 lb batch calculator (25.5 lb beef, 16 lb pork, 8.5 lb hard fat base). The old formulation document was retired 2026-11-07 (copy in `archive/`). |
| `data/recipes/mexican_chorizo.json` | Recipe schema for Mexican Chorizo production (batch weights, ingredients, allergen profile). |
| `WEBSITE_MENU.md` | Public-facing menu descriptions, item names, and current prices. |
| `OPERATIONAL_QUESTIONNAIRE.md` | Smoker schedule, prep cadence, service hours, and core operating parameters. |

---

## 4. Analytics & Predictive Forecasts

Located in `clover_api/analytics/` (consumed by frontend and dashboard):

| File / Location | Description |
| :--- | :--- |
| `clover_api/analytics/daily_executive_brief.json` | Daily executive summary generated for management (sales vs goal, margins). |
| `clover_api/analytics/predictive_payload.json` | Machine learning & regression projections for daily meat requirements. |
| `clover_api/analytics/arima_payload.json` | ARIMA time-series models for hourly/daily sales forecasts. |
| `clover_api/analytics/forecast_snapshots.json` | Historical snapshot records of predicted vs actual demand. |
| `clover_api/analytics/sync_status.json` | Last successful Clover API sync timestamp and connection status. |

---

## 5. API Secrets & Integration Environment

| File / Location | Description |
| :--- | :--- |
| `clover_api/.env` | Contains Clover API tokens, Merchant ID, API base URLs, and webhook signing secrets. |

*(Important: Ensure these API keys and webhook secrets are backed up in your Bitwarden vault.)*

---

## 6. Automation & Scheduled Tasks

Active crontab jobs running on this host:
* **Clover Hourly Sales Poller:**
  `0 * * * * cd /home/atools/Documents/GitHub/yellow-rose-inventory && export PYTHONPATH="/home/atools/Documents/GitHub/yellow-rose-inventory/scripts:$PYTHONPATH" && /home/atools/Documents/GitHub/yellow-rose-inventory/.venv/bin/python /home/atools/Documents/GitHub/yellow-rose-inventory/scripts/poll_clover_sales.py >> /home/atools/Documents/GitHub/yellow-rose-inventory/data/poll_clover.log 2>&1`
* **Nightly Encrypted Backup:**
  `systemd user timer: github-backup.timer` (executes daily at 2:00 AM via Restic to Google Drive).
