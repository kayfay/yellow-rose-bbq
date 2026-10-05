#!/bin/bash
# Sets up the hourly cron job for Yellow Rose BBQ data ingestion and forecasting
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_EXEC="$(which python3 || which python)"
CRON_CMD="0 * * * * cd $REPO_DIR && $PYTHON_EXEC scripts/hourly_sync_job.py >> $REPO_DIR/analytics/hourly_sync.log 2>&1"

echo "Setting up hourly cron job for user: $(whoami)..."
(crontab -l 2>/dev/null | grep -F -v "hourly_sync_job.py" ; echo "$CRON_CMD") | crontab -

echo "Successfully configured crontab:"
crontab -l | grep "hourly_sync_job.py"
