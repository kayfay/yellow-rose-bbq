import json
import sqlite3
import pandas as pd
import polars as pl
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from clover_api.secure_config import DB_PATH, ANALYTICS_DIR
def run_event_impact_analysis():
    """
    Analyzes the correlation between live events (Jaguars games, Holidays) and BBQ sales spikes.
    Calculates operational multipliers and exports a Plotly JSON payload for the dashboard.
    """
    if not DB_PATH.exists():
        print("[ERROR] Database not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        # Load orders and aggregate by date
        df_orders = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE lower(state)='locked' OR state is null", conn)
        df_orders['date'] = pd.to_datetime(df_orders['created_time']).dt.strftime('%Y-%m-%d')
        
        # Load weather/event flags
        df_events = pd.read_sql_query("SELECT date, is_holiday, is_jaguars_game FROM weather_events", conn)
    except Exception as e:
        print(f"[ERROR] Database query failed: {e}")
        return
    finally:
        conn.close()

    pl_orders = pl.from_pandas(df_orders)
    pl_events = pl.from_pandas(df_events)

    pl_daily_sales = (
        pl_orders.group_by("date")
        .agg(pl.sum("total_usd").alias("daily_revenue"))
        .sort("date")
    )

    pl_merged = pl_daily_sales.join(pl_events, on="date", how="inner")

    if pl_merged.height == 0:
        print("[WARN] No overlapping dates between sales and event data.")
        return

    # Calculate average revenue for each category
    stats = (
        pl_merged.with_columns(
            pl.when(pl.col("is_jaguars_game") == 1).then(pl.lit("Jaguars Game"))
            .when(pl.col("is_holiday") == 1).then(pl.lit("Holiday"))
            .otherwise(pl.lit("Normal Day"))
            .alias("day_type")
        )
        .group_by("day_type")
        .agg([
            pl.mean("daily_revenue").alias("avg_revenue"),
            pl.len().alias("days_count")
        ])
    )

    df_stats = stats.to_pandas().set_index("day_type")
    
    normal_avg = df_stats.loc["Normal Day", "avg_revenue"] if "Normal Day" in df_stats.index else 4500.0
    jags_avg = df_stats.loc["Jaguars Game", "avg_revenue"] if "Jaguars Game" in df_stats.index else normal_avg * 3.5
    holiday_avg = df_stats.loc["Holiday", "avg_revenue"] if "Holiday" in df_stats.index else normal_avg * 1.8

    jags_multiplier = jags_avg / normal_avg
    holiday_multiplier = holiday_avg / normal_avg

    print(f"[EVENT ANALYTICS] Normal Day Avg Revenue: ${normal_avg:.2f}")
    print(f"[EVENT ANALYTICS] Jaguars Game Avg Revenue: ${jags_avg:.2f} ({jags_multiplier:.2f}x Multiplier)")
    print(f"[EVENT ANALYTICS] Holiday Avg Revenue: ${holiday_avg:.2f} ({holiday_multiplier:.2f}x Multiplier)")

    # Generate Sanitized Plotly Bar Chart comparing day types (Demand Multipliers, No raw $)
    categories = ["Normal Day", "State/Federal Holiday", "Jaguars Game Day"]
    multipliers = [1.0, round(holiday_multiplier, 2), round(jags_multiplier, 2)]

    tooltips = [
        "Normal Day<br>Action: Standard Prep",
        "Major Holiday<br>Action: Pre-smoke starting Tuesday. Scale family-style sides.",
        "Jaguars Home Game<br>Action: Massive Surge. Activate Drive-Thru Express Lane."
    ]

    fig_data = [
        {
            "x": categories,
            "y": multipliers,
            "type": "bar",
            "marker": {
                "color": ["#7f8c8d", "#e67e22", "#006778"],  # Jags Teal color
                "opacity": 0.9
            },
            "text": [f"{m:.1f}x" for m in multipliers],
            "textposition": "auto",
            "hovertext": tooltips,
            "hovertemplate": "<b>%{y:.2f}x Multiplier</b><br>%{hovertext}<extra></extra>"
        }
    ]

    fig_layout = {
        "title": "Event Action Plan: Expected Revenue Surges",
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(20,20,30,0.6)",
        "font": {"color": "#f8fafc", "family": "Outfit, sans-serif"},
        "xaxis": {
            "title": "Event Type — Determines Special Menu & Drive-Thru Operations",
            "gridcolor": "rgba(255,255,255,0.1)"
        },
        "yaxis": {
            "title": "Surge Multiplier vs. Baseline (x) — Scale Prep Volume Accordingly",
            "gridcolor": "rgba(255,255,255,0.1)"
        },
        "margin": {"l": 60, "r": 50, "t": 80, "b": 80},
        "hoverlabel": {"bgcolor": "rgba(15, 23, 42, 0.95)", "font": {"family": "Outfit, sans-serif"}},
        "shapes": [
            {
                "type": "line",
                "xref": "paper",
                "x0": 0,
                "x1": 1,
                "y0": 1.0,
                "y1": 1.0,
                "line": {
                    "color": "#94a3b8",
                    "width": 2,
                    "dash": "dash"
                }
            }
        ]
    }

    payload = {
        "plotly_event_chart": {"data": fig_data, "layout": fig_layout},
        "event_stats": {
            "normal_avg_usd": round(normal_avg, 2),
            "jags_avg_usd": round(jags_avg, 2),
            "jags_multiplier": round(jags_multiplier, 1),
            "holiday_avg_usd": round(holiday_avg, 2),
            "holiday_multiplier": round(holiday_multiplier, 1)
        }
    }

    out_file = ANALYTICS_DIR / "event_payload.json"
    with open(out_file, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"[EVENTS] Saved event impact payload to {out_file}")

if __name__ == "__main__":
    try:
        run_event_impact_analysis()
    except Exception as e:
        import traceback
        import sys
        print(f"[FATAL ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        sys.exit(1)
