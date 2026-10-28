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

Located in `data/` (with historical versions in `archive/legacy_v1/`):

| File / Location | Description |
| :--- | :--- |
| `data/yellow_rose_bbq_cogs.xlsx` | Excel workbook containing recipe unit costs, meat shrinkage calculations, and COGS models. |
| `data/yellow_rose_bbq_cogs.csv` | Exported COGS tabular matrix used by analytics scripts. |
| `data/yellow_rose_bbq_complete_cogs_model.csv` | Comprehensive margin, portion cost, and menu pricing breakdown. |
| `data/yellow_rose_bbq_wholesale_yields.csv` | Trim loss, cooked yields, and raw-to-smoked meat conversion ratios. |
| `data/yellow_rose_bbq_clover_audit.csv` | Menu price discrepancy audit comparing POS prices to recipe costs. |
| `data/yellow_rose_bbq_audit_report.csv` | Historical vendor and item audit logs. |
| `data/Submitted_Order564310_Cust91714857_09032026.csv` | Vendor meat wholesale invoice / order confirmation (US Foods / distributor). |
| `data/Review order detail_91714857_09042026.csv` | Vendor line-item delivery inspection and invoice details. |

---

## 3. Recipes, Formulations & Menus

| File / Location | Description |
| :--- | :--- |
| `Yellow Rose BBQ - Custom Sausage Formulations (50 lb Batch).md` | Exact formulation, spice percentages, cure amounts, and procedures for 50 lb sausage batches (Jalapeño Cheddar, Garlic, Texas Hot Links, etc.). |
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
