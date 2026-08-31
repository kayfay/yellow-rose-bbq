"""
Shift Forecasting and Demand Curve Generation.
Produces shift_payload.json with hourly order counts.
"""

import json
import sqlite3
import pandas as pd
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent.parent))
from clover_api.secure_config import DB_PATH, ANALYTICS_DIR

def build_shift_forecast():
    if not DB_PATH.exists():
        print("[ERROR] Database not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        df_orders = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE state='locked' OR state is null", conn)
    except Exception as e:
        print(f"[WARN] DB Read failed: {e}")
        df_orders = pd.DataFrame()
    finally:
        conn.close()
        
    if len(df_orders) == 0:
        return
    
    df_orders['dt'] = pd.to_datetime(df_orders['created_time'])
    if df_orders['dt'].dt.tz is None:
        df_orders['dt'] = df_orders['dt'].dt.tz_localize('UTC').dt.tz_convert('America/Chicago')
        
    df_orders['day_of_week'] = df_orders['dt'].dt.day_name()
    df_orders['hour'] = df_orders['dt'].dt.hour
    
    df_orders['date'] = df_orders['dt'].dt.date
    day_counts = df_orders.groupby('day_of_week')['date'].nunique()
    
    heatmap_data = df_orders.groupby(['day_of_week', 'hour']).size().reset_index(name='total_orders')
    
    heatmap_data['avg_orders'] = heatmap_data.apply(
        lambda row: round(row['total_orders'] / day_counts.get(row['day_of_week'], 1), 1), 
        axis=1
    )
    
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    hours = list(range(24))
    
    z_data = []
    text_data = []
    for day in days:
        day_data = []
        text_row = []
        for hour in hours:
            val = heatmap_data[(heatmap_data['day_of_week'] == day) & (heatmap_data['hour'] == hour)]
            orders = 0
            if len(val) > 0:
                orders = val['avg_orders'].values[0]
            day_data.append(orders)
            
            # Actionable insights based on volume
            if orders < 3:
                text_row.append(f"{day} {hour:02d}:00<br>{orders} Orders/hr<br><i>Dead period. Prep/Cleaning time.</i>")
            elif orders < 8:
                text_row.append(f"{day} {hour:02d}:00<br>{orders} Orders/hr<br><i>Normal volume. 1 Cashier, 1 Pit.</i>")
            else:
                text_row.append(f"{day} {hour:02d}:00<br>{orders} Orders/hr<br><b>RUSH HOUR. 2 Cashiers, 2 Pit required.</b>")
        z_data.append(day_data)
        text_data.append(text_row)
        
    payload = {
        "plotly_heatmap": {
            "data": [{
                "x": [f"{h:02d}:00" for h in hours],
                "y": days,
                "z": z_data,
                "text": text_data,
                "hoverinfo": "text",
                "type": "heatmap",
                "colorscale": "Hot",
                "reversescale": False
            }],
            "layout": {
                "title": "Labor Optimization: Hourly Foot Traffic by Shift",
                "xaxis": {"title": "Hour of Day (Central Time)", "gridcolor": "rgba(255,255,255,0.1)", "tickangle": -45},
                "yaxis": {"title": "Day of Week — Identifies Required Staffing Levels", "gridcolor": "rgba(255,255,255,0.1)"},
                "paper_bgcolor": "rgba(0,0,0,0)",
                "plot_bgcolor": "rgba(0,0,0,0)",
                "font": {"color": "#f8fafc", "family": "Outfit, sans-serif"},
                "margin": {"l": 100, "r": 30, "t": 60, "b": 60}
            }
        }
    }
    
    out_file = ANALYTICS_DIR / "shift_payload.json"
    with open(out_file, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"[SHIFT] Saved shift forecasting payload to {out_file}")

if __name__ == "__main__":
    try:
        build_shift_forecast()
    except Exception as e:
        import traceback
        import sys
        print(f"[FATAL ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        sys.exit(1)
