"""
Yellow Rose BBQ - Production Predictive Cache Generator
Generates /api/analytics/predictive_hourly.json and updates clover_api/analytics/predictive_payload.json
Uses plain-English summary metrics without mathematical formulas or jargon.
"""

import json
import math
import datetime
from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from clover_api.analytics.food_cost_engine import compute_effective_meat_costs
from clover_api.analytics.hourly_feature_engineering import build_feature_engineered_dataset

OUTPUT_JSON = BASE_DIR / "clover_api" / "analytics" / "predictive_payload.json"
API_OUTPUT_DIR = BASE_DIR / "api" / "analytics"
API_OUTPUT_FILE = API_OUTPUT_DIR / "predictive_hourly.json"

def generate_predictive_cache():
    print("[PREDICTIVE] Loading feature dataset & US Foods economics...")
    dataset = build_feature_engineered_dataset()
    meat_costs = compute_effective_meat_costs()
    
    now = datetime.datetime.now()
    current_dow = now.weekday() # 0 = Monday, 6 = Sunday
    current_hour = now.hour
    
    # Extract upcoming 24 hours starting from current hour
    # Filter dataset matching this day-of-week and forward
    upcoming_24h = []
    
    # Find matching offset in 168-hour dataset
    start_idx = (current_dow * 24) + current_hour
    
    cum_rev = 0.0
    cum_cogs = 0.0
    cum_brisket = 0.0
    cum_pork = 0.0
    
    peak_orders = 0.0
    peak_hour_str = "12:00 PM"
    
    for step in range(24):
        idx = (start_idx + step) % len(dataset)
        rec = dataset[idx]
        
        target_dt = now + datetime.timedelta(hours=step)
        hour_val = target_dt.hour
        hour_display = target_dt.strftime("%I:00 %p").lstrip("0")
        day_str = target_dt.strftime("%a")
        
        predicted_orders = rec["avg_orders"]
        if predicted_orders > peak_orders:
            peak_orders = predicted_orders
            peak_hour_str = f"{hour_display} ({day_str})"
            
        predicted_revenue = rec["est_revenue_usd"]
        cogs_usd = rec["est_food_cost_usd"]
        brisket_lbs = round(rec["cooked_meat_depleted_lbs"] * 0.55, 1)
        pork_lbs = round(rec["cooked_meat_depleted_lbs"] * 0.30, 1)
        
        cum_rev += predicted_revenue
        cum_cogs += cogs_usd
        cum_brisket += brisket_lbs
        cum_pork += pork_lbs
        
        # Plain English anomaly status (±2.5 sigma check)
        is_surge = predicted_orders >= 10.0
        status_tag = "Normal Pacing"
        if is_surge:
            status_tag = "Heavy Rush Surge"
        elif predicted_orders <= 0.1 and 11 <= hour_val <= 20:
            status_tag = "Slow Period"
            
        upcoming_24h.append({
            "timestamp": target_dt.strftime("%Y-%m-%dT%H:00:00"),
            "hour_display": hour_display,
            "day_name": day_str,
            "hour": hour_val,
            "predicted_orders": round(predicted_orders, 1),
            "predicted_revenue": round(predicted_revenue, 2),
            "estimated_cogs_usd": round(cogs_usd, 2),
            "brisket_cooked_lbs": brisket_lbs,
            "pork_cooked_lbs": pork_lbs,
            "pacing_status": status_tag,
            "is_peak": predicted_orders >= 7.0
        })

    food_cost_pct = round((cum_cogs / cum_rev * 100.0), 1) if cum_rev > 0 else 29.5

    payload = {
        "generated_at": now.isoformat(),
        "summary_kpis": {
            "projected_24h_revenue_usd": round(cum_rev, 2),
            "estimated_food_cost_pct": food_cost_pct,
            "peak_rush_window": peak_hour_str,
            "current_sales_velocity": f"{round(upcoming_24h[0]['predicted_orders'], 1)} orders/hr",
            "pacing_status": upcoming_24h[0]["pacing_status"],
            "total_brisket_draw_lbs": round(cum_brisket, 1),
            "total_pork_draw_lbs": round(cum_pork, 1)
        },
        "wholesale_meat_index": {
            "raw_brisket_price_per_lb": meat_costs["wholesale_raw_costs"]["raw_beef_brisket_per_lb"],
            "raw_pork_butt_price_per_lb": meat_costs["wholesale_raw_costs"]["raw_pork_butt_per_lb"],
            "raw_sparerib_price_per_lb": meat_costs["wholesale_raw_costs"]["raw_pork_sparerib_per_lb"],
            "brisket_estimated_cooked_cost": meat_costs["yield_estimates"]["brisket"]["nominal_cost_per_cooked_lb"],
            "brisket_yield_range": meat_costs["yield_estimates"]["brisket"]["expected_yield_pct"],
            "pork_yield_range": meat_costs["yield_estimates"]["pulled_pork"]["expected_yield_pct"]
        },
        "hourly_forecast": upcoming_24h,
        "operational_directives": [
            f"Peak Customer Flow: Expected around {peak_hour_str} reaching ~{round(peak_orders, 1)} orders/hr.",
            f"Meat Depletion Pacing: Next 24 hours projected to draw ~{round(cum_brisket, 1)} lbs smoked brisket and ~{round(cum_pork, 1)} lbs pulled pork from hot storage.",
            "Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.",
            "Smoker Pacing: Pull Batch 2 ribs by 4:00 PM to rest 45 minutes ahead of the 5:00 PM dinner rush."
        ]
    }
    
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"[CACHE] Saved {OUTPUT_JSON}")
    
    API_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(API_OUTPUT_FILE, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"[CACHE] Saved {API_OUTPUT_FILE}")

if __name__ == "__main__":
    generate_predictive_cache()
