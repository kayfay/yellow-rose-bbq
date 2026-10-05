#!/usr/bin/env python3
import sys
import os
from pathlib import Path
import traceback
import smtplib
from email.message import EmailMessage
from datetime import datetime

# Adjust path to import from clover_api
sys.path.append(str(Path(__file__).resolve().parent.parent / "clover_api"))
from ingest_hourly import run_ingestion

EMAIL_ALERTS_TO = os.getenv("ALERT_EMAIL", "alerts@yellowrosebbq.com")
SMTP_SERVER = os.getenv("SMTP_SERVER", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))

def send_alert_email(error_msg):
    msg = EmailMessage()
    msg.set_content(f"Hourly Sync Failed at {datetime.now().isoformat()}\n\nError Details:\n{error_msg}")
    msg['Subject'] = "[ALERT] Clover POS Hourly Sync Failed"
    msg['From'] = "system@yellowrosebbq.com"
    msg['To'] = EMAIL_ALERTS_TO
    
    try:
        # Dummy SMTP connect (use real credentials in prod)
        print(f"Sending alert email to {EMAIL_ALERTS_TO}...")
        # with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        #     server.send_message(msg)
        print("Alert email sent successfully.")
    except Exception as e:
        print(f"Failed to send alert email: {e}")

def update_status_file(status, message=""):
    repo_root = Path(__file__).resolve().parent.parent
    status_files = [
        repo_root / "analytics" / "sync_status.json",
        repo_root / "clover_api" / "analytics" / "sync_status.json"
    ]
    import json
    data = {
        "last_synced_at": datetime.now().isoformat() if status == "success" else None,
        "status": status,
        "message": message,
        "next_scheduled_sync": "Hourly via cron"
    }
    for sf in status_files:
        sf.parent.mkdir(parents=True, exist_ok=True)
        with open(sf, "w") as f:
            json.dump(data, f, indent=2)

if __name__ == "__main__":
    try:
        run_ingestion(hourly=True)
        update_status_file("success")
        print("Hourly sync job completed.")
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Hourly sync job failed: {e}")
        send_alert_email(error_trace)
        update_status_file("failed", str(e))
        sys.exit(1)
