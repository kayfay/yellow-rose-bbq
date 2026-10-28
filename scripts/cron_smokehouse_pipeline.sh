#!/usr/bin/env bash
# ==============================================================================
# Yellow Rose BBQ — Unified Autonomous Smokehouse Intelligence Cron Pipeline
# 100% Local Execution • Zero Cloud Cost • Zero Persistent Daemons
#
# Schedulable via crontab:
#   0 * * * *       /home/atools/Documents/GitHub/yellow-rose-bbq/scripts/cron_smokehouse_pipeline.sh --auto >> /home/atools/Documents/GitHub/yellow-rose-bbq/clover_api/analytics/cron.log 2>&1
#   30 6 * * *      /home/atools/Documents/GitHub/yellow-rose-bbq/scripts/cron_smokehouse_pipeline.sh --brief >> /home/atools/Documents/GitHub/yellow-rose-bbq/clover_api/analytics/cron.log 2>&1
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Choose Python executable
if [ -x "${REPO_ROOT}/.venv/bin/python3" ]; then
    PYTHON_BIN="${REPO_ROOT}/.venv/bin/python3"
elif [ -x "${REPO_ROOT}/.venv4/bin/python3" ]; then
    PYTHON_BIN="${REPO_ROOT}/.venv4/bin/python3"
else
    PYTHON_BIN="/usr/bin/python3"
fi

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "================================================================="
echo "[CRON PIPELINE START] ${TIMESTAMP}"
echo "Running in: ${REPO_ROOT}"
echo "Using Python: ${PYTHON_BIN}"
echo "================================================================="

# 1. Multimodal ML Data Intelligence Engine
echo "--> [1/4] Running Multimodal ML Data Intelligence Engine..."
${PYTHON_BIN} scripts/ml_data_intelligence_engine.py

# 2. Hourly Quick-Wind Detector
echo "--> [2/4] Running Hourly Quick-Wind Detector..."
${PYTHON_BIN} scripts/hourly_quick_wind_detector.py

# 3. Analytics Payloads Bundler (clover_api/analytics/payloads.js)
echo "--> [3/4] Bundling Analytics Payloads..."
${PYTHON_BIN} clover_api/analytics/build_payloads.py

# 4. Telegram Autonomous Dispatch & Inbound Interactivity
echo "--> [4/4] Executing Telegram Dispatcher (${*:-'--auto'})..."
${PYTHON_BIN} scripts/telegram_dispatcher.py "${@:---auto}"

COMPLETION_TIME="$(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "[CRON PIPELINE COMPLETE] Finished at ${COMPLETION_TIME}"
echo ""
