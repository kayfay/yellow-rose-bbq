#!/usr/bin/env python3
"""
Yellow Rose BBQ — Plain-English Daily Actionable Insight Engine (PAL Pipeline)
Computes rolling day-of-week baselines, anomaly z-scores, % variance, meat cost
vs. gross leftover dollars, and 7-day mini-trends. Synthesizes a 2-part
Plain-English Daily Shop Brief (1. What's Happening + 2. Recommended Next Step)
with zero statistical jargon in user-facing text.
"""

from __future__ import annotations

import datetime
import json
import math
import os
import statistics
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

os.umask(0o022)

ROOT = Path(__file__).resolve().parent.parent
ANALYTICS_DIR = ROOT / "clover_api" / "analytics"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ANALYTICS_DIR))
from clover_api.analytics.food_cost_engine import record_batch_cost, meat_cost_pct as calc_meat_cost_pct

DAY_FULL_NAMES = {
    "Mon": "Monday",
    "Tue": "Tuesday",
    "Wed": "Wednesday",
    "Thu": "Thursday",
    "Fri": "Friday",
    "Sat": "Saturday",
    "Sun": "Sunday",
}

TYPICAL_DOW_SALES = {
    "Mon": 0.0,
    "Tue": 3850.0,
    "Wed": 3050.0,
    "Thu": 3900.0,
    "Fri": 5100.0,
    "Sat": 6200.0,
    "Sun": 4650.0,
}

TYPICAL_DOW_STD = {
    "Mon": 1.0,
    "Tue": 320.0,
    "Wed": 290.0,
    "Thu": 340.0,
    "Fri": 450.0,
    "Sat": 520.0,
    "Sun": 410.0,
}

PEAK_RUSH_BY_DOW = {
    "Mon": "Closed (Monday Maintenance)",
    "Tue": "12:00 PM – 1:30 PM Lunch Counter Rush",
    "Wed": "12:00 PM – 1:30 PM Midweek Lunch Rush",
    "Thu": "12:00 PM – 2:00 PM Lunch & Early Dinner",
    "Fri": "12:00 PM – 2:00 PM Lunch & 6:00 PM – 8:00 PM Dinner Rush",
    "Sat": "12:00 PM – 3:00 PM Weekend Peak Block & 6:00 PM Dinner",
    "Sun": "12:00 PM – 2:30 PM Sunday Family Platter Rush",
}



def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


MOVER_ITEMS = [
    ("Brisket", "brisket_raw_lbs", "typical_brisket_raw_lbs"),
    ("Pulled Pork", "pork_shoulder_raw_lbs", "typical_pork_raw_lbs"),
    ("Sausage", "sausage_lbs", "typical_sausage_lbs"),
    ("Spare Ribs", "pork_ribs_racks", "typical_ribs_racks"),
]


def top_movers(record: dict, base: dict, limit: int = 2, min_pct: float = 10.0) -> list[tuple[str, float]]:
    """Items whose volume differs most from a typical day of this weekday, biggest swing first."""
    moves = []
    for name, field, base_key in MOVER_ITEMS:
        typ = float(base.get(base_key, 0) or 0)
        if typ <= 0:
            continue
        val = float(record.get(field, 0) or 0)
        pct = round((val - typ) / typ * 100.0, 1)
        if abs(pct) >= min_pct:
            moves.append((name, pct))
    moves.sort(key=lambda m: abs(m[1]), reverse=True)
    return moves[:limit]


def describe_movers(movers: list[tuple[str, float]], full_day: str) -> str:
    if not movers:
        return f"order volume close to a typical {full_day} across all meats"
    parts = [f"{name} {'up' if pct > 0 else 'down'} {abs(pct):g}%" for name, pct in movers]
    return " and ".join(parts) + f" vs a typical {full_day}"


def compute_dow_baselines(historical_records: list[dict], forecast_records: list[dict]) -> dict:
    baselines = {}
    for short_day in DAY_FULL_NAMES:
        if short_day == "Mon":
            baselines[short_day] = {
                "typical_sales_usd": 0.0,
                "std_sales_usd": 1.0,
                "typical_brisket_raw_lbs": 0.0,
                "typical_pork_raw_lbs": 0.0,
                "typical_ribs_racks": 0.0,
                "typical_sausage_lbs": 0.0,
                "typical_turkey_cooked_lbs": 0.0,
            }
            continue

        day_hist = [
            r for r in historical_records
            if r.get("day_name") == short_day and float(r.get("actual_revenue", 0) or 0) > 500
        ]
        day_fc = [
            r for r in forecast_records
            if r.get("day_name") == short_day and not r.get("is_closed")
        ]

        revs = [float(r["actual_revenue"]) for r in day_hist]
        if len(revs) >= 3:
            mu_rev = round(statistics.median(revs), 2)
            std_rev = round(statistics.pstdev(revs) or TYPICAL_DOW_STD[short_day], 2)
        else:
            mu_rev = TYPICAL_DOW_SALES[short_day]
            std_rev = TYPICAL_DOW_STD[short_day]

        ref_rec = day_fc[0] if day_fc else {}

        def typical(field, fallback, scale=0.94):
            vals = [float(r.get(f"actual_{field}", r.get(field, 0)) or 0) for r in day_hist]
            vals = [v for v in vals if v > 0]
            if len(vals) >= 3:
                return round(statistics.median(vals), 1)
            return round(float(ref_rec.get(field, fallback)) * scale, 1)

        baselines[short_day] = {
            "typical_sales_usd": mu_rev,
            "std_sales_usd": max(std_rev, 100.0),
            "typical_brisket_raw_lbs": typical("brisket_raw_lbs", 120.0),
            "typical_pork_raw_lbs": typical("pork_shoulder_raw_lbs", 20.0),
            "typical_ribs_racks": max(1, round(typical("pork_ribs_racks", 7))),
            "typical_sausage_lbs": typical("sausage_lbs", 12.0),
            "typical_turkey_cooked_lbs": round(
                float(ref_rec.get("turkey_cooked_lbs", ref_rec.get("turkey_lbs", 7.5))) * 0.94, 1
            ),
        }
    return baselines


def build_day_brief(record: dict, dow_baselines: dict) -> dict:
    short_day = record.get("day_name", "Tue")
    full_day = DAY_FULL_NAMES.get(short_day, short_day)
    date_str = record.get("date", "")
    is_closed = bool(record.get("is_closed")) or short_day == "Mon"

    if is_closed:
        return {
            "date": date_str,
            "day_name": short_day,
            "day_full_name": full_day,
            "is_closed": True,
            "status_badge": "Closed Monday — Pit Cold",
            "status_tone": "neutral",
            "z_score": 0.0,
            "pct_vs_typical": 0.0,
            "expected_sales_usd": 0,
            "typical_day_sales_usd": 0,
            "sales_diff_usd": 0,
            "estimated_meat_cost_usd": 0,
            "left_after_meat_cost_usd": 0,
            "meat_cost_pct": None,
            "leftover_pct": None,
            "primary_driver": "Monday scheduled pit cleanout and Day 1 sausage cure prep",
            "peak_rush_window": PEAK_RUSH_BY_DOW["Mon"],
            "the_insight": (
                f"The shop is closed on {full_day} ({date_str}) with $0 in counter sales "
                f"(typical {full_day} baseline) and 0 lbs of hot-holding barbecue required."
            ),
            "the_action": (
                "Keep main offset smokers cold, deep-clean the firebox, inspect Tuesday opening "
                "Brisket trims, and grind/cure Day 1 sausage batches for Tuesday's opening smoke."
            ),
            "sales_bridge": {
                "typical_day_label": f"Typical {full_day}",
                "typical_day_usd": 0,
                "rush_hour_delta_label": "Lunch & Dinner Rush",
                "rush_hour_delta_usd": 0,
                "weather_event_delta_label": "Weather & Local Crowd",
                "weather_event_delta_usd": 0,
                "expected_sales_usd": 0,
                "estimated_meat_cost_usd": 0,
                "left_after_meat_cost_usd": 0,
            },
        }

    base = dow_baselines.get(short_day, dow_baselines["Tue"])
    typical_sales = float(base["typical_sales_usd"] or TYPICAL_DOW_SALES.get(short_day, 3850.0))
    std_sales = float(base["std_sales_usd"] or 320.0)

    raw_rev = float(
        record.get("actual_revenue")
        if record.get("is_historical") and float(record.get("actual_revenue", 0) or 0) > 0
        else record.get("predicted_revenue", typical_sales)
    )
    expected_sales = round(raw_rev)
    typical_sales_round = round(typical_sales)
    diff_usd = expected_sales - typical_sales_round

    z_score = round((raw_rev - typical_sales) / max(std_sales, 1.0), 2)
    pct_vs_typical = round(((raw_rev - typical_sales) / max(typical_sales, 1.0)) * 100.0, 1)

    meat_cost_usd = round(record_batch_cost(record))
    leftover_usd = expected_sales - meat_cost_usd
    meat_cost_pct = calc_meat_cost_pct(meat_cost_usd, expected_sales)
    leftover_pct = round(100.0 - meat_cost_pct, 1) if meat_cost_pct is not None else None

    brisket_raw = round(float(record.get("brisket_raw_lbs", 0.0)))
    brisket_cooked = round(brisket_raw * 0.40)
    pork_raw = round(float(record.get("pork_shoulder_raw_lbs", 0.0)))
    pork_cooked = round(pork_raw * 0.44)
    ribs_racks = int(round(float(record.get("pork_ribs_racks", 0))))
    turkey_cooked = round(float(record.get("turkey_cooked_lbs", record.get("turkey_lbs", 0.0))))
    turkey_raw = round(turkey_cooked / 0.70)

    # Split difference into Rush Hour demand vs Weather/Local Events in plain dollars
    rush_delta = round(diff_usd * 0.62)
    weather_event_delta = diff_usd - rush_delta

    # Movers compare real POS volumes to a typical day, so only days with actuals qualify;
    # a forecast day would just be comparing the model to history.
    has_actuals = bool(record.get("is_historical"))
    movers = top_movers(record, base) if has_actuals else []
    driver_phrase = describe_movers(movers, full_day) if has_actuals else ""
    if pct_vs_typical >= 10.0:
        status_badge = f"Busy {full_day} Rush (+{pct_vs_typical}% vs. Typical {full_day})"
        status_tone = "surge"
    elif pct_vs_typical <= -10.0:
        status_badge = f"Lighter {full_day} Pace ({pct_vs_typical}% vs. Typical {full_day})"
        status_tone = "lull"
    else:
        sign = "+" if pct_vs_typical >= 0 else ""
        status_badge = f"Steady {full_day} Pace ({sign}{pct_vs_typical}% vs. Typical {full_day})"
        status_tone = "steady"

    diff_word = "above" if diff_usd >= 0 else "below"
    abs_pct = abs(pct_vs_typical)
    abs_diff = abs(diff_usd)

    the_insight = (
        f"{full_day} sales (${expected_sales:,}) are tracking {abs_pct}% (${abs_diff:,}) {diff_word} "
        f"a typical {full_day} (${typical_sales_round:,})" + (f"; meat movement: {driver_phrase}" if driver_phrase else "") + ". That leaves "
        f"~${leftover_usd:,} for the shop after ~${meat_cost_usd:,} in estimated meat cost."
    )

    the_action = (
        f"Prep {brisket_raw} lbs raw Brisket (~{brisket_cooked} lbs cooked), "
        f"{pork_raw} lbs raw Pulled Pork (~{pork_cooked} lbs cooked), "
        f"{ribs_racks} racks of Spare Ribs, and {turkey_raw} lbs raw Turkey (~{turkey_cooked} lbs cooked); "
        f"stage sliced brisket on the cutting block 30 minutes before the {PEAK_RUSH_BY_DOW[short_day]}."
    )

    return {
        "date": date_str,
        "day_name": short_day,
        "day_full_name": full_day,
        "is_closed": False,
        "status_badge": status_badge,
        "status_tone": status_tone,
        "z_score": z_score,
        "pct_vs_typical": pct_vs_typical,
        "expected_sales_usd": expected_sales,
        "typical_day_sales_usd": typical_sales_round,
        "sales_diff_usd": diff_usd,
        "estimated_meat_cost_usd": meat_cost_usd,
        "left_after_meat_cost_usd": leftover_usd,
        "meat_cost_pct": meat_cost_pct,
        "leftover_pct": leftover_pct,
        "primary_driver": driver_phrase,
        "peak_rush_window": PEAK_RUSH_BY_DOW[short_day],
        "the_insight": the_insight,
        "the_action": the_action,
        "sales_bridge": {
            "typical_day_label": f"Typical {full_day}",
            "typical_day_usd": typical_sales_round,
            "rush_hour_delta_label": "Rush Hour Demand",
            "rush_hour_delta_usd": rush_delta,
            "weather_event_delta_label": "Weather & Local Crowd",
            "weather_event_delta_usd": weather_event_delta,
            "expected_sales_usd": expected_sales,
            "estimated_meat_cost_usd": meat_cost_usd,
            "left_after_meat_cost_usd": leftover_usd,
        },
    }


def generate_daily_executive_brief() -> dict:
    dashboard_payload = _load_json(ANALYTICS_DIR / "dashboard_payload.json")
    historical_payload = _load_json(ANALYTICS_DIR / "historical_payload.json")

    forecast_records = dashboard_payload.get("forecast", {}).get("forecast_records", [])
    historical_records = historical_payload.get("historical_records", [])

    # Ensure forecast records start from current America/New_York date if needed
    now_ny = datetime.datetime.now(ZoneInfo("America/New_York"))
    today_str = now_ny.strftime("%Y-%m-%d")

    dow_baselines = compute_dow_baselines(historical_records, forecast_records)

    by_date = {}
    by_day_name = {}

    for rec in forecast_records:
        brief = build_day_brief(rec, dow_baselines)
        if brief["date"]:
            by_date[brief["date"]] = brief
        if brief["day_name"] not in by_day_name:
            by_day_name[brief["day_name"]] = brief

    for rec in historical_records[-30:]:
        brief = build_day_brief(rec, dow_baselines)
        if brief["date"] and brief["date"] not in by_date:
            by_date[brief["date"]] = brief

    # Select primary active service brief (if today is closed Monday, feature next open day as primary active service brief)
    open_forecasts = [r for r in forecast_records if not r.get("is_closed") and r.get("day_name") != "Mon"]
    primary_rec = open_forecasts[0] if open_forecasts else (forecast_records[0] if forecast_records else {})
    active_brief = build_day_brief(primary_rec, dow_baselines)

    # Build 7-day open-day sparkline & target progress metrics
    seven_day_window = [r for r in forecast_records if not r.get("is_closed") and r.get("day_name") != "Mon"][:7]
    if not seven_day_window:
        seven_day_window = forecast_records[:7]

    sparklines_7d = {
        "labels": [f"{r.get('day_name', '')} ({r.get('date', '')[-5:]})" for r in seven_day_window],
        "sales_usd": [round(float(r.get("predicted_revenue", 0))) for r in seven_day_window],
        "meat_cost_usd": [round(record_batch_cost(r)) for r in seven_day_window],
        "left_after_meat_usd": [
            round(float(r.get("predicted_revenue", 0)) - record_batch_cost(r)) for r in seven_day_window
        ],
        "brisket_raw_lbs": [round(float(r.get("brisket_raw_lbs", 0)), 1) for r in seven_day_window],
        "pork_raw_lbs": [round(float(r.get("pork_shoulder_raw_lbs", 0)), 1) for r in seven_day_window],
        "ribs_racks": [int(round(float(r.get("pork_ribs_racks", 0)))) for r in seven_day_window],
        "sausage_batches": [round(float(r.get("sausage_lbs", 0)) / 60.0, 2) for r in seven_day_window],
        "turkey_cooked_lbs": [
            round(float(r.get("turkey_cooked_lbs", r.get("turkey_lbs", 0))), 1) for r in seven_day_window
        ],
    }

    payload = {
        "generated_at": now_ny.isoformat(timespec="seconds"),
        "timezone": "America/New_York",
        "today_date": today_str,
        "active_service_brief": active_brief,
        "dow_baselines": dow_baselines,
        "sparklines_7d": sparklines_7d,
        "by_day_name": by_day_name,
        "by_date": by_date,
    }

    out_file = ANALYTICS_DIR / "daily_executive_brief.json"
    with open(out_file, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)

    print(f"[DAILY INSIGHT ENGINE] Wrote {out_file}")
    print(f"  -> Headline: {active_brief['status_badge']}")
    print(f"  -> What's Happening: {active_brief['the_insight']}")
    print(f"  -> Recommended Next Step: {active_brief['the_action']}")

    from build_payloads import build_payloads
    build_payloads()
    return payload


if __name__ == "__main__":
    generate_daily_executive_brief()
