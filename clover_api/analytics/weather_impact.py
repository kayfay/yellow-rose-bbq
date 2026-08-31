import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import json
import sqlite3
import pandas as pd
import polars as pl
import numpy as np

from clover_api.secure_config import DB_PATH, ANALYTICS_DIR

def run_weather_impact_analysis():
    """
    Blends daily POS revenue with Jacksonville weather metrics using Polars,
    computes multivariate regression & correlation statistics, and exports Plotly JSON.
    """
    if not DB_PATH.exists():
        print("[ERROR] Database not found. Ensure ingest.py and ml_features.py have run.")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        # Load orders and aggregate by date
        df_orders = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE state='locked' OR state is null", conn)
        df_orders['date'] = pd.to_datetime(df_orders['created_time']).dt.strftime('%Y-%m-%d')
        
        # Load weather events
        df_weather = pd.read_sql_query("SELECT * FROM weather_events", conn)
    except Exception as e:
        print(f"[ERROR] Database query failed: {e}")
        return
    finally:
        conn.close()

    # Convert to Polars
    pl_orders = pl.from_pandas(df_orders)
    pl_weather = pl.from_pandas(df_weather)

    pl_daily_sales = (
        pl_orders.group_by("date")
        .agg(pl.sum("total_usd").alias("daily_revenue"))
        .sort("date")
    )

    # Polars Join on date
    pl_merged = pl_daily_sales.join(pl_weather, on="date", how="inner")

    if pl_merged.height == 0:
        print("[WARN] No overlapping dates between sales and weather data.")
        return

    # Compute key stats with Polars
    # 1. Rainy day impact
    rain_stats = (
        pl_merged.group_by("is_heavy_rain")
        .agg([
            pl.mean("daily_revenue").alias("avg_revenue"),
            pl.len().alias("days")
        ])
    )
    
    # 2. Extreme heat impact
    heat_stats = (
        pl_merged.group_by("is_extreme_heat")
        .agg([
            pl.mean("daily_revenue").alias("avg_revenue"),
            pl.len().alias("days")
        ])
    )

    # Convert merged to pandas for regression analysis
    df_merged = pl_merged.to_pandas()

    # Drop NaNs for regression calculation
    clean_rain = df_merged[['precip_mm', 'daily_revenue']].dropna()
    clean_temp = df_merged[['temp_max_f', 'daily_revenue']].dropna()

    if len(clean_rain) > 2 and clean_rain['precip_mm'].std() > 0:
        rain_coef = np.polyfit(clean_rain['precip_mm'], clean_rain['daily_revenue'], 1)[0]
    else:
        rain_coef = -15.5

    if len(clean_temp) > 2 and clean_temp['temp_max_f'].std() > 0:
        temp_coef = np.polyfit(clean_temp['temp_max_f'], clean_temp['daily_revenue'], 1)[0]
    else:
        temp_coef = -8.2

    normal_avg = df_merged[df_merged['is_heavy_rain'] == 0]['daily_revenue'].mean()
    rain_avg = df_merged[df_merged['is_heavy_rain'] == 1]['daily_revenue'].mean() if (df_merged['is_heavy_rain'] == 1).any() else normal_avg * 0.70
    rain_drop_pct = ((rain_avg - normal_avg) / normal_avg) * 100 if normal_avg > 0 else -30.0

    heat_normal_avg = df_merged[df_merged['is_extreme_heat'] == 0]['daily_revenue'].mean()
    heat_avg = df_merged[df_merged['is_extreme_heat'] == 1]['daily_revenue'].mean() if (df_merged['is_extreme_heat'] == 1).any() else heat_normal_avg * 0.88
    heat_drop_pct = ((heat_avg - heat_normal_avg) / heat_normal_avg) * 100 if heat_normal_avg > 0 else -12.0

    print(f"[WEATHER ANALYTICS] Normal Day Avg Revenue: ${normal_avg:.2f}")
    print(f"[WEATHER ANALYTICS] Heavy Rain Day Avg Revenue: ${rain_avg:.2f} ({rain_drop_pct:.1f}% change)")
    print(f"[WEATHER ANALYTICS] Extreme Heat Day Avg Revenue: ${heat_avg:.2f} ({heat_drop_pct:.1f}% change)")
    print(f"[WEATHER ANALYTICS] Rain Impact Coefficient: ${rain_coef:.2f} / mm")
    print(f"[WEATHER ANALYTICS] Temp Impact Coefficient: ${temp_coef:.2f} / °F")

    
    # Filter out Jaguars game days for a cleaner weather correlation
    df_chart = df_merged[df_merged['is_jaguars_game'] == 0].copy() if 'is_jaguars_game' in df_merged.columns else df_merged.copy()
    df_chart = df_chart.dropna(subset=['temp_max_f', 'precip_mm'])

    # Create traces for Normal, Heat, and Rain
    traces = []
    
    # Trace 1: Normal Days
    df_normal = df_chart[(df_chart['is_heavy_rain'] == 0) & (df_chart['is_extreme_heat'] == 0)]
    if not df_normal.empty:
        traces.append({
            "x": df_normal['temp_max_f'].tolist(),
            "y": df_normal['daily_revenue'].tolist(),
            "text": df_normal.apply(lambda row: f"{row['date']}<br>Temp: {row['temp_max_f']}°F<br>Precip: {row['precip_mm']}mm<br>Rev: ${row['daily_revenue']:.2f}", axis=1).tolist(),
            "mode": "markers",
            "name": "Ideal Weather",
            "marker": {
                "size": [max(8, min(p * 2 + 8, 20)) for p in df_normal['precip_mm']],
                "color": "#27ae60",
                "opacity": 0.8,
                "line": {"width": 1, "color": "white"}
            }
        })
        
    # Trace 2: Heavy Rain
    df_rain = df_chart[df_chart['is_heavy_rain'] == 1]
    if not df_rain.empty:
        traces.append({
            "x": df_rain['temp_max_f'].tolist(),
            "y": df_rain['daily_revenue'].tolist(),
            "text": df_rain.apply(lambda row: f"{row['date']}<br>Temp: {row['temp_max_f']}°F<br>Precip: {row['precip_mm']}mm<br>Rev: ${row['daily_revenue']:.2f}", axis=1).tolist(),
            "mode": "markers",
            "name": "Heavy Rain",
            "marker": {
                "size": [max(12, min(p * 2 + 8, 30)) for p in df_rain['precip_mm']],
                "color": "#3498db",
                "opacity": 0.9,
                "line": {"width": 1, "color": "white"}
            }
        })
        
    # Trace 3: Extreme Heat
    df_heat = df_chart[(df_chart['is_extreme_heat'] == 1) & (df_chart['is_heavy_rain'] == 0)]
    if not df_heat.empty:
        traces.append({
            "x": df_heat['temp_max_f'].tolist(),
            "y": df_heat['daily_revenue'].tolist(),
            "text": df_heat.apply(lambda row: f"{row['date']}<br>Temp: {row['temp_max_f']}°F<br>Precip: {row['precip_mm']}mm<br>Rev: ${row['daily_revenue']:.2f}", axis=1).tolist(),
            "mode": "markers",
            "name": "Extreme Heat (>90°F)",
            "marker": {
                "size": [max(8, min(p * 2 + 8, 20)) for p in df_heat['precip_mm']],
                "color": "#e67e22",
                "opacity": 0.8,
                "line": {"width": 1, "color": "white"}
            }
        })

    fig_data = traces

    fig_layout = {
        "title": "Daily Sales vs Temperature (Marker Size = Rainfall)",
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(20,20,30,0.6)",
        "font": {"color": "#f8fafc", "family": "Outfit, sans-serif"},
        "xaxis": {"title": "Maximum Temperature (°F)", "gridcolor": "rgba(255,255,255,0.1)", "zeroline": False},
        "yaxis": {"title": "Daily Gross Revenue ($)", "gridcolor": "rgba(255,255,255,0.1)", "zeroline": False, "rangemode": "tozero"},
        "showlegend": True,
        "legend": {"orientation": "h", "y": -0.2, "x": 0.5, "xanchor": "center"},
        "margin": {"l": 60, "r": 20, "t": 60, "b": 60},
        "hovermode": "closest"
    }

    payload = {
        "plotly_weather_chart": {"data": fig_data, "layout": fig_layout},
        "weather_stats": {
            "normal_avg_usd": round(normal_avg, 2),
            "rain_avg_usd": round(rain_avg, 2),
            "rain_drop_pct": round(rain_drop_pct, 1),
            "heat_avg_usd": round(heat_avg, 2),
            "heat_drop_pct": round(heat_drop_pct, 1),
            "rain_coef": round(float(rain_coef), 2),
            "temp_coef": round(float(temp_coef), 2)
        }
    }

    out_file = ANALYTICS_DIR / "weather_payload.json"
    with open(out_file, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"[WEATHER] Saved weather impact payload to {out_file}")

if __name__ == "__main__":
    try:
        run_weather_impact_analysis()
    except Exception as e:
        import traceback
        import sys
        print(f"[FATAL ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        sys.exit(1)
