#!/usr/bin/env bash
# ==============================================================================
# Yellow Rose BBQ — Unified Autonomous Smokehouse Intelligence Cron Pipeline
# 100% Local Execution • Zero Cloud Cost • Zero Persistent Daemons
#
# Scheduled via crontab every 30 minutes during active & close-out hours (10:00 AM - 11:30 PM EST, Tue-Sun):
#   */30 10-23 * * 0,2-6 /home/atools/Documents/GitHub/yellow-rose-bbq/scripts/cron_smokehouse_pipeline.sh --auto >> /home/atools/Documents/GitHub/yellow-rose-bbq/clover_api/analytics/cron.log 2>&1
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Guard against closed overnight hours (00:00 - 09:59 EST) and Mondays unless --force is passed
CURRENT_HOUR="$(TZ='America/New_York' date '+%H')"
CURRENT_DOW="$(TZ='America/New_York' date '+%u')" # 1=Monday
if [[ "$*" != *"--force"* ]] && [[ "$*" != *"--brief"* ]]; then
    if [ "${CURRENT_DOW}" -eq 1 ] || [ $((10#${CURRENT_HOUR})) -lt 10 ]; then
        echo "[CRON SKIP] $(date '+%Y-%m-%d %H:%M:%S %Z') — Restaurant is closed (DOW=${CURRENT_DOW}, Hour=${CURRENT_HOUR}). Skipping sync."
        exit 0
    fi
fi

# Choose Python executable
if [ -x "${REPO_ROOT}/.venv/bin/python3" ]; then
    PYTHON_BIN="${REPO_ROOT}/.venv/bin/python3"
else
    PYTHON_BIN="/usr/bin/python3"
fi

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "================================================================="
echo "[CRON PIPELINE START] ${TIMESTAMP}"
echo "Running in: ${REPO_ROOT}"
echo "Using Python: ${PYTHON_BIN}"
echo "================================================================="

# 1. Live Clover POS Ingestion & Master DB Merge
echo "--> [1/6] Ingesting Live Clover POS Orders & Itemized Line Items..."
PYTHONPATH="${REPO_ROOT}/clover_api:${REPO_ROOT}" ${PYTHON_BIN} clover_api/ingest.py || echo "[WARN] clover_api/ingest.py encountered non-fatal error"
PYTHONPATH="${REPO_ROOT}/clover_api:${REPO_ROOT}" ${PYTHON_BIN} clover_api/ingest_itemized.py || echo "[WARN] clover_api/ingest_itemized.py encountered non-fatal error"

${PYTHON_BIN} -c '
import sqlite3
from pathlib import Path
src = Path("clover_api/data/clover_sales.db")
dst = Path("data/clover_sales_master.db")
if src.exists() and dst.exists() and src.stat().st_size > 4096:
    conn = sqlite3.connect(str(dst))
    conn.execute(f"ATTACH DATABASE \"{src}\" AS live_db")
    conn.execute("""
        INSERT OR REPLACE INTO main.orders (
            order_id, created_time, total_cents, total_usd, currency, state, title, note, client_created_time
        )
        SELECT order_id, created_time, total_cents, total_usd, currency, state, title, note, client_created_time
        FROM live_db.orders
    """)
    conn.execute("""
        INSERT OR REPLACE INTO main.payments (
            payment_id, order_id, created_time, amount_cents, amount_usd, tender_type, result
        )
        SELECT payment_id, order_id, created_time, amount_cents, amount_usd, tender_type, result
        FROM live_db.payments
    """)
    conn.execute("""
        INSERT OR REPLACE INTO main.order_line_items (
            line_item_id, order_id, item_name, item_id, quantity, price_cents, price_usd,
            created_time, hour, order_type, discount_name, modifications
        )
        SELECT line_item_id, order_id, item_name, item_id, quantity, price_cents, price_usd,
               created_time, hour, order_type, discount_name, modifications
        FROM live_db.order_line_items
    """)
    conn.commit()
    conn.close()
' || true

# 2. Core Forecasting & Analytics Refresh
echo "--> [2/6] Refreshing Historical, ARIMA, Dashboard & Daily Brief Payloads..."
${PYTHON_BIN} generate_historical_payload.py || true
${PYTHON_BIN} clover_api/analytics/food_cost_engine.py || true
${PYTHON_BIN} clover_api/analytics/arima_baseline.py || true
${PYTHON_BIN} clover_api/analytics/dashboard.py || true
${PYTHON_BIN} scripts/update_predictive_cache.py || true
${PYTHON_BIN} scripts/daily_insight_engine.py || true

# 3. Multimodal ML Data Intelligence Engine
echo "--> [3/6] Running Multimodal ML Data Intelligence Engine..."
${PYTHON_BIN} scripts/ml_data_intelligence_engine.py || true

# 4. Hourly Quick-Wind Detector
echo "--> [4/6] Running Hourly Quick-Wind Detector..."
${PYTHON_BIN} scripts/hourly_quick_wind_detector.py || true

# 5. Analytics Payloads Bundler (clover_api/analytics/payloads.js & sync_status.json)
echo "--> [5/7] Bundling Analytics Payloads..."
${PYTHON_BIN} clover_api/analytics/build_payloads.py

# 6. Auto-Commit & Push Fresh Analytics Payloads to GitHub Pages (origin/master)
echo "--> [6/7] Publishing Fresh Payloads to GitHub Pages (origin/master)..."
git add -u clover_api/analytics/ analytics/ api/analytics/ WEBSITE_MENU.md 2>/dev/null || true
if ! git diff --staged --quiet; then
    git commit -m "chore(data): auto-update clover api analytics data (every 30 mins)" || true
    for attempt in 1 2 3; do
        if git pull --rebase -X theirs --autostash origin master && git push origin master; then
            echo "[GIT SYNC] Successfully pushed fresh analytics payloads to origin/master."
            break
        fi
        echo "[GIT SYNC WARN] Push attempt ${attempt}/3 failed; retrying in 2s..."
        sleep 2
    done
else
    echo "[GIT SYNC] No payload diffs to commit."
fi

# 7. Telegram Autonomous Dispatch & Inbound Interactivity
echo "--> [7/7] Executing Telegram Dispatcher (${*:-'--auto'})..."
${PYTHON_BIN} scripts/telegram_dispatcher.py "${@:---auto}" || true

COMPLETION_TIME="$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "[CRON PIPELINE COMPLETE] Finished at ${COMPLETION_TIME}"
echo ""
