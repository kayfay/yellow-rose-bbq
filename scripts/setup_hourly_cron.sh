#!/bin/bash
# Sets up local Linux cron jobs for the Autonomous Smokehouse Intelligence & Telegram Agent
# 100% Local Execution • Zero Cloud Cost • Zero Persistent Daemons
# Monday Closed Policy: Only runs Tuesday through Sunday (Tue-Sun)
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CRON_JOB_AUTO="0 * * * 0,2-6 cd $REPO_DIR && bash scripts/cron_smokehouse_pipeline.sh --auto >> $REPO_DIR/clover_api/analytics/cron.log 2>&1"
CRON_JOB_BRIEF="30 6 * * 0,2-6 cd $REPO_DIR && bash scripts/cron_smokehouse_pipeline.sh --brief >> $REPO_DIR/clover_api/analytics/cron.log 2>&1"
CRON_JOB_INBOUND="*/10 11-20 * * 0,2-6 cd $REPO_DIR && python3 scripts/telegram_dispatcher.py --inbound >> $REPO_DIR/clover_api/analytics/cron.log 2>&1"

echo "======================================================================"
echo "Yellow Rose BBQ — Autonomous Smokehouse Crontab Configuration"
echo "Schedule: Tuesday–Sunday Active (Mondays Dark & Suppressed)"
echo "======================================================================"
echo "To install or update your user crontab, run:"
echo "  crontab -e"
echo ""
echo "And paste the following lines:"
echo "----------------------------------------------------------------------"
echo "# 1. Hourly Multimodal Scan, Quick-Wind Alerts & Inbound Message Processing (Tue-Sun)"
echo "$CRON_JOB_AUTO"
echo ""
echo "# 2. Daily Morning Pitmaster Briefing (Tue-Sun 6:30 AM EDT)"
echo "$CRON_JOB_BRIEF"
echo ""
echo "# 3. Rapid Inbound Telegram Query Sweep (Tue-Sun every 10 mins during active service 11 AM - 8 PM)"
echo "$CRON_JOB_INBOUND"
echo "----------------------------------------------------------------------"

# Attempt automatic install if crontab write permission is available
if crontab -l >/dev/null 2>&1; then
    (crontab -l 2>/dev/null | grep -F -v "cron_smokehouse_pipeline.sh" | grep -F -v "hourly_sync_job.py" ; echo "$CRON_JOB_AUTO" ; echo "$CRON_JOB_BRIEF" ; echo "$CRON_JOB_INBOUND") | crontab -
    echo "[SUCCESS] Crontab successfully updated automatically!"
    crontab -l | grep "cron_smokehouse_pipeline.sh"
else
    echo "[NOTE] Standard cron lines are printed above for manual pasting via 'crontab -e'."
fi
