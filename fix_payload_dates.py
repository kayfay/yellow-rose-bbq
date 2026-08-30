import json
import os
from datetime import datetime, timedelta
from pathlib import Path

analytics_dir = Path("clover_api/analytics")
filepath = analytics_dir / "dashboard_payload.json"

with open(filepath, "r") as f:
    payload = json.load(f)

today = datetime.now()

# Shift dates in dashboard_payload.json to start from today
records = payload["forecast"]["forecast_records"]
for i, record in enumerate(records):
    new_date = today + timedelta(days=i)
    record["date"] = new_date.strftime("%Y-%m-%d")
    record["day_name"] = new_date.strftime("%a")

with open(filepath, "w") as f:
    json.dump(payload, f, indent=2)

print("Dates shifted to start from today in dashboard_payload.json")
