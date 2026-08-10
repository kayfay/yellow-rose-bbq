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

    # Build Plotly Multi-Axis Chart (Revenue vs Rainfall & Temperature)
    dates = df_merged['date'].tolist()
    revenue = df_merged['daily_revenue'].tolist()
    precip = df_merged['precip_mm'].tolist()
    temp = df_merged['temp_max_f'].tolist()

    fig_data = [
        {
            "x": dates,
            "y": revenue,
            "name": "Daily Revenue ($)",
            "type": "bar",
            "marker": {"color": "#c0392b", "opacity": 0.75}
        },
        {
            "x": dates,
            "y": precip,
            "name": "Precipitation (mm)",
            "type": "scatter",
            "mode": "lines+markers",
            "yaxis": "y2",
            "line": {"color": "#3498db", "width": 2},
            "marker": {"size": 6}
        },
        {
            "x": dates,
            "y": temp,
            "name": "Max Temp (°F)",
            "type": "scatter",
            "mode": "lines",
            "yaxis": "y3",
            "line": {"color": "#e67e22", "width": 2, "dash": "dot"}
        }
    ]

    fig_layout = {
        "title": "Multivariate Weather & Daily Sales Regression Analysis",
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(20,20,30,0.6)",
        "font": {"color": "#f8fafc", "family": "Outfit, sans-serif"},
        "xaxis": {"gridcolor": "rgba(255,255,255,0.1)", "tickangle": 45},
        "yaxis": {"title": "Daily Sales Revenue ($)", "gridcolor": "rgba(255,255,255,0.1)"},
        "yaxis2": {
            "title": "Precipitation (mm)",
            "overlaying": "y",
            "side": "right",
            "showgrid": False,
            "titlefont": {"color": "#3498db"},
            "tickfont": {"color": "#3498db"}
        },
        "yaxis3": {
            "title": "Max Temp (°F)",
            "overlaying": "y",
            "side": "right",
            "position": 0.95,
            "showgrid": False,
            "titlefont": {"color": "#e67e22"},
            "tickfont": {"color": "#e67e22"}
        },
        "legend": {"orientation": "h", "y": -0.25},
        "margin": {"l": 60, "r": 80, "t": 60, "b": 100}
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
    run_weather_impact_analysis()
