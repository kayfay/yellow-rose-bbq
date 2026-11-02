import json
import os
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

os.umask(0o022)

def build_payloads():
    analytics_dir = Path(__file__).parent

    # Refresh hourly actuals (America/New_York buckets) before bundling.
    try:
        import sys
        sys.path.insert(0, str(analytics_dir))
        from hourly_actuals import export_hourly_actuals
        export_hourly_actuals()
    except Exception as e:
        print(f"[WARN] hourly actuals not refreshed: {e}")
    
    payloads = {}
    for filename in ["dashboard_payload", "weather_payload", "event_payload", "shift_payload", "category_payload", "advanced_payload", "predictive_payload", "historical_payload", "calendar_events", "hourly_actuals", "forecast_snapshots", "daily_executive_brief", "ml_insights", "quick_wind_alerts"]:
        filepath = analytics_dir / (filename + ".json")
        if filepath.exists():
            with open(filepath, 'r') as f:
                try:
                    data = json.load(f)
                    
                    # Shift forecast dates in dashboard_payload to start from today
                    if filename == "dashboard_payload":
                        today = datetime.now(ZoneInfo("America/New_York"))
                        if "forecast" in data:
                            data["forecast"]["generated_at"] = today.isoformat()
                            if "forecast_records" in data["forecast"]:
                                day_map = {}
                                for r in data["forecast"]["forecast_records"]:
                                    if r["day_name"] not in day_map:
                                        day_map[r["day_name"]] = r
                                
                                new_records = []
                                for i in range(14):
                                    new_date = today + timedelta(days=i)
                                    target_day = new_date.strftime("%a")
                                    base_record = dict(day_map.get(target_day, data["forecast"]["forecast_records"][0]))
                                    base_record["date"] = new_date.strftime("%Y-%m-%d")
                                    base_record["day_name"] = target_day
                                    if target_day == "Mon":
                                        base_record["is_closed"] = True
                                        base_record["predicted_revenue"] = 0.0
                                        base_record["brisket_raw_lbs"] = 0.0
                                        base_record["pork_shoulder_raw_lbs"] = 0.0
                                        base_record["sausage_lbs"] = 0.0
                                        base_record["turkey_lbs"] = 0.0
                                        base_record["turkey_cooked_lbs"] = 0.0
                                        base_record["turkey_raw_lbs"] = 0.0
                                        base_record["tacos_sold"] = 0
                                        base_record["rosebuds_sold"] = 0
                                        base_record["pork_ribs_racks"] = 0
                                        base_record["beef_dino_ribs"] = 0
                                        base_record["recommended_staff"] = 0
                                        base_record["pitmaster_hours"] = 0.0
                                    new_records.append(base_record)
                                
                                data["forecast"]["forecast_records"] = new_records
                                
                    payloads[filename] = data
                except json.JSONDecodeError:
                    print(f"Error parsing {filename}")
        else:
            print(f"Missing {filename}.json")
            
    js_content = f"window.BBQ_PAYLOADS = {json.dumps(payloads, indent=2)};\n"
    
    outpath = analytics_dir / "payloads.js"
    with open(outpath, 'w') as f:
        f.write(js_content)
        
    print(f"Successfully generated {outpath}")

    # Generate sync_status.json so payload and sync status are always in sync
    now_ny = datetime.now(ZoneInfo("America/New_York"))
    p_data = payloads.get("predictive_payload", {})
    sk = p_data.get("summary_kpis", {})
    cogs = sk.get("estimated_24h_cogs_usd", 0)
    staff = sk.get("recommended_staff", 0)
    hours = sk.get("pitmaster_hours", 0)
    fc = sk.get("estimated_food_cost_pct", 29.5)
    msg = f"COGS: ${cogs:,.2f} ({fc}%) | Labor: {staff} crew ({hours}h)" if cogs else "Live POS & Analytics Data Synchronized"

    status = {
        "last_synced_at": now_ny.isoformat(),
        "status": "success",
        "message": msg,
        "next_scheduled_sync": "Hourly via GitHub Actions"
    }

    for target_dir in [analytics_dir, analytics_dir.parent.parent / "analytics"]:
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            with open(target_dir / "sync_status.json", "w") as sf:
                json.dump(status, sf, indent=2)
            print(f"Successfully generated {target_dir / 'sync_status.json'}")
        except Exception as e:
            print(f"[WARN] Failed to write sync_status.json to {target_dir}: {e}")

if __name__ == "__main__":
    build_payloads()
