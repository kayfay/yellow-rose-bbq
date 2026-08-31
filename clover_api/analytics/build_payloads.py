import json
import os
from pathlib import Path
from datetime import datetime, timedelta

def build_payloads():
    analytics_dir = Path(__file__).parent
    
    payloads = {}
    for filename in ["dashboard_payload", "weather_payload", "event_payload", "shift_payload", "category_payload", "advanced_payload", "calendar_events"]:
        filepath = analytics_dir / (filename + ".json")
        if filepath.exists():
            with open(filepath, 'r') as f:
                try:
                    data = json.load(f)
                    
                    # Shift forecast dates in dashboard_payload to start from today
                    if filename == "dashboard_payload":
                        today = datetime.now()
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

if __name__ == "__main__":
    build_payloads()
