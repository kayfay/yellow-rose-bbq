"""
Yellow Rose BBQ - Hourly Feature Engineering Pipeline
Constructs regularized hourly time-series data with cyclical temporal features,
lags, rolling averages, weather regressors, and food cost mappings.
"""

import math
import json
import sqlite3
import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "clover_api" / "data" / "clover_sales.db"
SHIFT_PAYLOAD = BASE_DIR / "clover_api" / "analytics" / "shift_payload.json"

DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

def load_hourly_baseline_series():
    """
    Extracts hourly baseline order volumes across the weekly cycle.
    Utilizes shift_payload.json (derived from aggregated POS line items & orders).
    """
    hourly_records = []
    
    if SHIFT_PAYLOAD.exists():
        with open(SHIFT_PAYLOAD, 'r') as f:
            data = json.load(f)
            traces = data.get("plotly_heatmap", {}).get("data", [])
            if traces:
                z_matrix = traces[0].get("z", []) # 7 days x 24 hours
                hours = traces[0].get("x", [f"{h:02d}:00" for h in range(24)])
                days = traces[0].get("y", DAYS_ORDER)
                
                # Base mock date anchor to construct consecutive timestamps
                base_monday = datetime.date(2026, 9, 21) # A Monday
                for d_idx, day_name in enumerate(days):
                    current_date = base_monday + datetime.timedelta(days=d_idx)
                    for h_idx in range(len(hours)):
                        avg_orders = z_matrix[d_idx][h_idx] if d_idx < len(z_matrix) and h_idx < len(z_matrix[d_idx]) else 0.0
                        dt = datetime.datetime.combine(current_date, datetime.time(h_idx, 0))
                        hourly_records.append({
                            "timestamp": dt.isoformat(),
                            "date": current_date.isoformat(),
                            "day_name": day_name,
                            "day_of_week": d_idx,
                            "hour": h_idx,
                            "avg_orders": float(avg_orders),
                            "is_closed": 1 if day_name == "Monday" else 0
                        })
    return hourly_records

def build_feature_engineered_dataset(records=None):
    """
    Computes cyclical time features, lags, rolling averages, and COGS approximations.
    """
    if records is None:
        records = load_hourly_baseline_series()
        
    enriched = []
    n = len(records)
    
    for i, r in enumerate(records):
        h = r["hour"]
        dow = r["day_of_week"]
        
        # 1. Cyclical time encoding (smooth transition from 23:00 to 00:00)
        sin_hour = round(math.sin(2 * math.pi * h / 24.0), 4)
        cos_hour = round(math.cos(2 * math.pi * h / 24.0), 4)
        
        # 2. Lag features (handling boundaries safely)
        lag_1h = records[i - 1]["avg_orders"] if i > 0 else r["avg_orders"]
        lag_24h = records[i - 24]["avg_orders"] if i >= 24 else r["avg_orders"]
        
        # 3. Rolling window averages
        window_3h = [records[j]["avg_orders"] for j in range(max(0, i - 2), i + 1)]
        rolling_3h_mean = round(sum(window_3h) / len(window_3h), 2)
        
        # 4. Estimated sales revenue and meat draw
        # Average ticket is approx $48.50 at Yellow Rose BBQ
        orders = r["avg_orders"]
        est_revenue = round(orders * 48.50, 2)
        
        # Draw rates: each order consumes ~0.45 lbs cooked meat equivalent (yielding 1.1 lbs raw meat draw)
        cooked_meat_lbs = round(orders * 0.45, 2)
        raw_meat_prep_lbs = round(cooked_meat_lbs / 0.40, 2)
        
        # Wholesale Food Cost (approx 29.5% food cost ratio)
        est_food_cost_usd = round(est_revenue * 0.295, 2)
        
        # 5. Rush Classification
        if orders >= 7.0:
            rush_status = "Peak Rush"
        elif orders >= 3.0:
            rush_status = "Steady Flow"
        elif orders > 0.3:
            rush_status = "Prep & Light Service"
        else:
            rush_status = "Dead / Smoker Watch"
            
        feature_row = dict(r)
        feature_row.update({
            "sin_hour": sin_hour,
            "cos_hour": cos_hour,
            "lag_1h": lag_1h,
            "lag_24h": lag_24h,
            "rolling_3h_mean": rolling_3h_mean,
            "est_revenue_usd": est_revenue,
            "cooked_meat_depleted_lbs": cooked_meat_lbs,
            "raw_meat_draw_lbs": raw_meat_prep_lbs,
            "est_food_cost_usd": est_food_cost_usd,
            "rush_status": rush_status
        })
        enriched.append(feature_row)
        
    return enriched

if __name__ == "__main__":
    data = build_feature_engineered_dataset()
    print(f"Engineered {len(data)} hourly records across full weekly operating cycle.")
    sample = [r for r in data if r["hour"] in [12, 18]][:2]
    print("Sample Lunch & Dinner records:")
    print(json.dumps(sample, indent=2))
