import json
import os
import sqlite3
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from clover_api.secure_config import DB_PATH, ANALYTICS_DIR
from clover_api.analytics.event_multipliers import (
    MIN_EVENT_DAYS, MIN_REVENUE, applied_multiplier, measure_multipliers,
)

CALENDAR_PATH = ANALYTICS_DIR / "calendar_events.json"
HISTORICAL_PATH = ANALYTICS_DIR / "historical_payload.json"


def _load_from_database():
    """Daily revenue and event dates from the POS database, or None if it has no event table / data."""
    if not DB_PATH.exists():
        return None
    import pandas as pd
    conn = sqlite3.connect(DB_PATH)
    try:
        df_orders = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE lower(state)='locked' OR state is null", conn)
        df_orders["date"] = pd.to_datetime(df_orders["created_time"]).dt.strftime("%Y-%m-%d")
        df_orders["total_usd"] = pd.to_numeric(df_orders["total_usd"], errors="coerce").fillna(0.0)
        df_events = pd.read_sql_query("SELECT date, is_holiday, is_jaguars_game FROM weather_events", conn)
    except Exception as e:
        print(f"[WARN] Database event query unavailable ({e}); falling back to payload history.")
        return None
    finally:
        conn.close()
    daily = df_orders.groupby("date")["total_usd"].sum().to_dict()
    jags = set(df_events.loc[df_events["is_jaguars_game"] == 1, "date"])
    holidays = set(df_events.loc[df_events["is_holiday"] == 1, "date"])
    if not daily or not (jags or holidays):
        return None
    return daily, {"jaguars": jags, "holiday": holidays}


def _load_from_payloads():
    """Same inputs from the committed sales history and the event calendar."""
    if not (CALENDAR_PATH.exists() and HISTORICAL_PATH.exists()):
        return None
    cal = json.loads(CALENDAR_PATH.read_text())
    hist = json.loads(HISTORICAL_PATH.read_text()).get("historical_records", [])
    daily = {r["date"]: float(r.get("actual_revenue") or 0) for r in hist}
    cats = {"jaguars": set(), "holiday": set()}
    for e in cal:
        if e.get("category") in cats:
            cats[e["category"]].add(e["date"])
    return (daily, cats) if daily else None


def run_event_impact_analysis():
    """
    Measures how Jaguars game days and holidays compare with normal days of the SAME weekday.
    Writes a Plotly bar chart payload plus event_stats for the dashboard. No invented fallback multipliers:
    an event type with too few usable days is left out and reported as None.
    """
    loaded = _load_from_database() or _load_from_payloads()
    if loaded is None:
        print("[WARN] No sales or event data available for event analytics.")
        return
    daily, cats = loaded

    measured = measure_multipliers(daily, cats)
    event_dates = set().union(*cats.values())
    normal = [rev for d, rev in daily.items() if d not in event_dates and rev >= MIN_REVENUE]
    if len(normal) < MIN_EVENT_DAYS:
        print("[WARN] Not enough normal days to compare event days against.")
        return
    normal_avg = sum(normal) / len(normal)

    def avg_for(category):
        vals = [daily[d] for d in cats[category] if daily.get(d, 0) >= MIN_REVENUE]
        return (sum(vals) / len(vals)) if len(vals) >= MIN_EVENT_DAYS else None

    jags_avg, holiday_avg = avg_for("jaguars"), avg_for("holiday")
    jags, holiday = measured["jaguars"], measured["holiday"]
    print(f"[EVENT ANALYTICS] Normal days: ${normal_avg:.2f} average over {len(normal)} days")
    for label, m, avg in (("Jaguars", jags, jags_avg), ("Holiday", holiday, holiday_avg)):
        if m["multiplier"] is None:
            print(f"[EVENT ANALYTICS] {label}: not enough usable days ({m['days']})")
        else:
            print(f"[EVENT ANALYTICS] {label}: {m['multiplier']:.2f}x same-weekday multiplier, ${avg:.2f} average ({m['days']} days)")

    categories, multipliers, tooltips, colors = ["Normal Day"], [1.0], ["Normal Day<br>Action: Standard Prep"], ["#7f8c8d"]
    if holiday["multiplier"] is not None:
        categories.append("State/Federal Holiday")
        multipliers.append(holiday["multiplier"])
        tooltips.append("Holiday<br>Measured against normal days of the same weekday.")
        colors.append("#e67e22")
    if jags["multiplier"] is not None:
        categories.append("Jaguars Game Day")
        multipliers.append(jags["multiplier"])
        tooltips.append("Jaguars Home Game<br>Measured against normal days of the same weekday.")
        colors.append("#006778")

    fig_data = [{
        "x": categories,
        "y": multipliers,
        "type": "bar",
        "marker": {"color": colors, "opacity": 0.9},
        "text": [f"{m:.2f}x" for m in multipliers],
        "textposition": "auto",
        "hovertext": tooltips,
        "hovertemplate": "<b>%{y:.2f}x vs a normal day</b><br>%{hovertext}<extra></extra>"
    }]

    fig_layout = {
        "title": "Event Days vs. Normal Days (Same Weekday)",
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(20,20,30,0.6)",
        "font": {"color": "#f8fafc", "family": "Outfit, sans-serif"},
        "xaxis": {"title": "Day Type", "gridcolor": "rgba(255,255,255,0.1)"},
        "yaxis": {"title": "Sales vs. Normal Day (x)", "gridcolor": "rgba(255,255,255,0.1)"},
        "margin": {"l": 60, "r": 50, "t": 80, "b": 80},
        "hoverlabel": {"bgcolor": "rgba(15, 23, 42, 0.95)", "font": {"family": "Outfit, sans-serif"}},
        "shapes": [{
            "type": "line", "xref": "paper", "x0": 0, "x1": 1, "y0": 1.0, "y1": 1.0,
            "line": {"color": "#94a3b8", "width": 2, "dash": "dash"}
        }]
    }

    payload = {
        "plotly_event_chart": {"data": fig_data, "layout": fig_layout},
        "event_stats": {
            "normal_avg_usd": round(normal_avg, 2),
            "normal_days": len(normal),
            "jags_avg_usd": round(jags_avg, 2) if jags_avg is not None else None,
            "jags_multiplier": jags["multiplier"],
            "jags_applied_multiplier": applied_multiplier(jags["multiplier"]),
            "jags_days": jags["days"],
            "holiday_avg_usd": round(holiday_avg, 2) if holiday_avg is not None else None,
            "holiday_multiplier": holiday["multiplier"],
            "holiday_applied_multiplier": applied_multiplier(holiday["multiplier"]),
            "holiday_days": holiday["days"]
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
        print(f"[FATAL ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        sys.exit(1)
