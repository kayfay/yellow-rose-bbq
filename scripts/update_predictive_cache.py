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
    
    DAY_TARGET_COOKED = {
        'Monday': {'brisket': 0.0, 'pork': 0.0},
        'Tuesday': {'brisket': 41.4, 'pork': 13.7},
        'Wednesday': {'brisket': 44.4, 'pork': 7.2},
        'Thursday': {'brisket': 48.3, 'pork': 7.0},
        'Friday': {'brisket': 79.4, 'pork': 21.8},
        'Saturday': {'brisket': 90.8, 'pork': 23.5},
        'Sunday': {'brisket': 68.9, 'pork': 10.0}
    }

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
        
        d_day_name = rec["day_name"]
        day_total = sum(r["avg_orders"] for r in dataset if r["day_name"] == d_day_name)
        if day_total > 0:
            brisket_lbs = round(DAY_TARGET_COOKED.get(d_day_name, {}).get('brisket', 0.0) * (predicted_orders / day_total), 1)
            pork_lbs = round(DAY_TARGET_COOKED.get(d_day_name, {}).get('pork', 0.0) * (predicted_orders / day_total), 1)
        else:
            brisket_lbs = 0.0
            pork_lbs = 0.0
        
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

    # Build Day Profiles for all 7 days so frontend date selection can show each day dynamically
    day_profiles = {}
    DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    for d_idx, day_name in enumerate(DAYS_LIST):
        short_name = SHORT_DAYS[d_idx]
        is_closed = (day_name == 'Monday')
        day_recs = dataset[d_idx * 24 : (d_idx + 1) * 24]
        day_total_orders = sum(r["avg_orders"] for r in day_recs)
        
        target_brisket = DAY_TARGET_COOKED[day_name]['brisket']
        target_pork = DAY_TARGET_COOKED[day_name]['pork']
        
        d_cum_rev = 0.0
        d_cum_cogs = 0.0
        d_cum_brisket = 0.0
        d_cum_pork = 0.0
        d_peak_orders = 0.0
        d_peak_hour = 12
        d_peak_hour_str = f"12:00 PM ({short_name})"
        
        day_hourly = []
        for r in day_recs:
            h_val = r["hour"]
            h_dt = datetime.datetime(2026, 1, 1, h_val, 0)
            h_disp = h_dt.strftime("%I:00 %p").lstrip("0")
            
            p_orders = r["avg_orders"]
            p_rev = r["est_revenue_usd"]
            p_cogs = r["est_food_cost_usd"]
            
            if day_total_orders > 0:
                b_lbs = round(target_brisket * (p_orders / day_total_orders), 1)
                pk_lbs = round(target_pork * (p_orders / day_total_orders), 1)
            else:
                b_lbs = 0.0
                pk_lbs = 0.0
            
            if p_orders > d_peak_orders:
                d_peak_orders = p_orders
                d_peak_hour = h_val
                d_peak_hour_str = f"{h_disp} ({short_name})"
                
            d_cum_rev += p_rev
            d_cum_cogs += p_cogs
            d_cum_brisket += b_lbs
            d_cum_pork += pk_lbs
            
            pacing_tag = "Normal Pacing"
            if is_closed:
                pacing_tag = "Closed"
            elif p_orders >= 10.0:
                pacing_tag = "Heavy Rush Surge"
            elif p_orders <= 0.1 and 11 <= h_val <= 20:
                pacing_tag = "Slow Period"
                
            day_hourly.append({
                "timestamp": f"2026-10-0{5+d_idx}T{h_val:02d}:00:00",
                "hour_display": h_disp,
                "day_name": short_name,
                "hour": h_val,
                "predicted_orders": round(p_orders, 1),
                "predicted_revenue": round(p_rev, 2),
                "estimated_cogs_usd": round(p_cogs, 2),
                "brisket_cooked_lbs": b_lbs,
                "pork_cooked_lbs": pk_lbs,
                "pacing_status": pacing_tag,
                "is_peak": p_orders >= 7.0
            })
            
        d_food_cost = round((d_cum_cogs / d_cum_rev * 100.0), 1) if d_cum_rev > 0 else 29.5
        
        # Day-specific operational directives
        if is_closed:
            d_directives = [
                "Closed Today (Monday): Yellow Rose BBQ is closed on Mondays for pit maintenance, smoker seasoning, and equipment sanitization.",
                "Production Schedule: No smoking runs scheduled today. Overnight rub and prep begins Monday evening for Tuesday 11:00 AM opening.",
                "Inventory & Restock: Cold storage inspection and US Foods wholesale delivery intake underway."
            ]
        elif day_name == 'Tuesday':
            d_directives = [
                f"Peak Customer Flow: Expected around {d_peak_hour_str} reaching ~{d_peak_orders:.1f} orders/hr; steady weekday lunch flow.",
                f"Meat Depletion Pacing: Day projected to draw ~{d_cum_brisket:.1f} lbs smoked brisket and ~{d_cum_pork:.1f} lbs pulled pork from hot storage.",
                "Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.",
                "Smoker Pacing: Stage lean and moist brisket cuts for 11:30 AM initial opening rush."
            ]
        elif day_name == 'Wednesday':
            d_directives = [
                f"Peak Customer Flow: Expected around {d_peak_hour_str} reaching ~{d_peak_orders:.1f} orders/hr; steady weekday lunch flow.",
                f"Meat Depletion Pacing: Day projected to draw ~{d_cum_brisket:.1f} lbs smoked brisket and ~{d_cum_pork:.1f} lbs pulled pork from hot storage.",
                "Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.",
                "Smoker Pacing: Pull Batch 1 meats by 10:30 AM to rest ahead of 11:00 AM opening."
            ]
        elif day_name == 'Thursday':
            d_directives = [
                f"Peak Customer Flow: Expected around {d_peak_hour_str} reaching ~{d_peak_orders:.1f} orders/hr; lunch rush into early afternoon.",
                f"Meat Depletion Pacing: Day projected to draw ~{d_cum_brisket:.1f} lbs smoked brisket and ~{d_cum_pork:.1f} lbs pulled pork from hot storage.",
                "Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.",
                "Smoker Pacing: Prep smoker racks for Friday high-capacity smoke."
            ]
        elif day_name == 'Friday':
            d_directives = [
                f"Peak Customer Flow: Expected around {d_peak_hour_str} reaching ~{d_peak_orders:.1f} orders/hr; dinner rush sustains ~12.5 orders/hr through 7:00 PM.",
                f"Meat Depletion Pacing: Day projected to draw ~{d_cum_brisket:.1f} lbs smoked brisket and ~{d_cum_pork:.1f} lbs pulled pork from hot storage.",
                "Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.",
                "Smoker Pacing: Pull Batch 2 ribs by 4:00 PM to rest 45 minutes ahead of the 5:00 PM dinner rush."
            ]
        elif day_name == 'Saturday':
            d_directives = [
                f"Peak Customer Flow: Expected around {d_peak_hour_str} reaching ~{d_peak_orders:.1f} orders/hr; heavy continuous service across lunch and dinner.",
                f"Meat Depletion Pacing: Day projected to draw ~{d_cum_brisket:.1f} lbs smoked brisket and ~{d_cum_pork:.1f} lbs pulled pork from hot storage.",
                "Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.",
                "Smoker Pacing: Stage double cutting stations by 11:30 AM for brisket board rush."
            ]
        else: # Sunday
            d_directives = [
                f"Peak Customer Flow: Expected around {d_peak_hour_str} reaching ~{d_peak_orders:.1f} orders/hr; steady family pack and lunch crowd.",
                f"Meat Depletion Pacing: Day projected to draw ~{d_cum_brisket:.1f} lbs smoked brisket and ~{d_cum_pork:.1f} lbs pulled pork from hot storage.",
                "Weather / Service Action: In high humidity (>85%) or rain (>5mm), stage additional takeout packaging; walk-in dine-in will drop ~15% into to-go family packs.",
                "Smoker Pacing: Monitor hot hold levels closely by 4:00 PM to avoid leftover waste before Monday closure."
            ]
            
        profile_obj = {
            "day_name": day_name,
            "short_day": short_name,
            "is_closed": is_closed,
            "peak_orders": round(d_peak_orders, 1),
            "peak_hour": d_peak_hour,
            "peak_rush_window": d_peak_hour_str,
            "total_orders": round(sum(r["predicted_orders"] for r in day_hourly), 1),
            "projected_revenue_usd": round(d_cum_rev, 2),
            "estimated_food_cost_pct": d_food_cost,
            "total_brisket_draw_lbs": round(d_cum_brisket, 1),
            "total_pork_draw_lbs": round(d_cum_pork, 1),
            "current_sales_velocity": f"{round(d_peak_orders, 1)} orders/hr (Peak)" if not is_closed else "0 orders/hr (Closed)",
            "pacing_status": "Heavy Rush Surge" if d_peak_orders >= 10.0 else ("Normal Pacing" if not is_closed else "Closed"),
            "hourly_forecast": day_hourly,
            "operational_directives": d_directives
        }
        
        # Index by multiple lookup keys for resilient lookup in JS
        day_profiles[day_name] = profile_obj
        day_profiles[short_name] = profile_obj
        day_profiles[day_name.lower()] = profile_obj
        day_profiles[short_name.lower()] = profile_obj

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
        ],
        "day_profiles": day_profiles
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
