import sqlite3
import json
import os
from collections import defaultdict
from datetime import datetime

conn = sqlite3.connect('clover_api/data/clover_sales.db')
cursor = conn.cursor()

# Get all unique dates in the db
cursor.execute("SELECT DISTINCT date(created_time) FROM orders ORDER BY date(created_time)")
dates = [r[0] for r in cursor.fetchall()]

historical_records = []

for d in dates:
    day_name = datetime.strptime(d, '%Y-%m-%d').strftime('%a')
    
    # Get total revenue
    cursor.execute("SELECT sum(total_usd) FROM orders WHERE date(created_time) = ?", (d,))
    revenue = cursor.fetchone()[0] or 0
    
    # Get all items sold that day
    cursor.execute("""
        SELECT item_name, count(*) as qty, sum(price_usd)
        FROM order_line_items
        WHERE date(created_time) = ?
        GROUP BY item_name
    """, (d,))
    items = cursor.fetchall()
    
    tacos_sold = 0
    rosebuds_sold = 0
    pork_ribs_racks = 0
    beef_dino_ribs = 0
    
    cooked_brisket_lbs = 0
    cooked_pork_lbs = 0
    sausage_lbs = 0
    
    for item_name, qty, _ in items:
        name = item_name.lower()
        
        # Exact counts
        if "taco" in name:
            tacos_sold += qty
            cooked_brisket_lbs += qty * 0.25
        if "rosebud" in name:
            rosebuds_sold += qty
            cooked_brisket_lbs += qty * 0.1
        if "dino" in name or "beef rib" in name:
            beef_dino_ribs += qty
        if "pork spare" in name or "pork rib" in name:
            if "half" in name:
                pork_ribs_racks += qty * 0.5
            elif "full" in name or "rack" in name:
                pork_ribs_racks += qty
            else:
                pork_ribs_racks += qty * 0.25 # assume plate portion
                
        # Meat weight approximations
        if "brisket" in name and "taco" not in name:
            cooked_brisket_lbs += qty * 0.4
        if "pork" in name and "rib" not in name:
            cooked_pork_lbs += qty * 0.4
        if "sausage" in name:
            sausage_lbs += qty * 0.33
            
        # Platters
        if "2 meat" in name:
            cooked_brisket_lbs += qty * 0.25
            cooked_pork_lbs += qty * 0.25
        if "3 meat" in name or "trinity" in name:
            cooked_brisket_lbs += qty * 0.25
            cooked_pork_lbs += qty * 0.25
            sausage_lbs += qty * 0.25
            pork_ribs_racks += qty * 0.15
        if "bbq plate" in name:
            cooked_brisket_lbs += qty * 0.3
            cooked_pork_lbs += qty * 0.1

    # Base baseline amounts if too low (catering/bulk not tracked in line items)
    base_rev = 2000
    rev_multiplier = max(1.0, revenue / base_rev)
    
    brisket_raw = max(40.0, cooked_brisket_lbs / 0.4) * (1 if cooked_brisket_lbs > 10 else rev_multiplier)
    pork_raw = max(24.0, cooked_pork_lbs / 0.4) * (1 if cooked_pork_lbs > 5 else rev_multiplier)
    sausage_final = max(20.0, sausage_lbs) * (1 if sausage_lbs > 5 else rev_multiplier)
    
    historical_records.append({
        "date": d,
        "day_name": day_name,
        "actual_revenue": round(revenue, 2),
        "predicted_revenue": round(revenue, 2), # for compatibility with app.js
        "brisket_raw_lbs": round(brisket_raw, 1),
        "pork_shoulder_raw_lbs": round(pork_raw, 1),
        "sausage_lbs": round(sausage_final, 1),
        "tacos_sold": tacos_sold,
        "rosebuds_sold": rosebuds_sold,
        "pork_ribs_racks": round(pork_ribs_racks, 1),
        "beef_dino_ribs": round(beef_dino_ribs, 1),
        "is_historical": True
    })

with open('clover_api/analytics/historical_payload.json', 'w') as f:
    json.dump({"historical_records": historical_records}, f, indent=2)

print(f"Generated {len(historical_records)} historical records in clover_api/analytics/historical_payload.json")
