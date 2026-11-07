#!/usr/bin/env python3
"""
Recalibrates clover_api/analytics/calendar_events.json multipliers from real sales.

Each event gets its category's measured multiplier (weekday-matched, see event_multipliers.py), or 1.0 when there are
too few usable days to measure. Run after new event days have sales history:
    .venv/bin/python scripts/calibrate_calendar_multipliers.py          # report only
    .venv/bin/python scripts/calibrate_calendar_multipliers.py --write  # update calendar_events.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from clover_api.analytics.event_multipliers import measure_multipliers, applied_multiplier, NOISE_BAND  # noqa: E402

CAL = ROOT / "clover_api" / "analytics" / "calendar_events.json"
HIST = ROOT / "clover_api" / "analytics" / "historical_payload.json"
SKIP = {"operational"}  # not demand events


def main(write=False):
    cal = json.loads(CAL.read_text())
    hist = json.loads(HIST.read_text()).get("historical_records", [])
    daily = {r["date"]: float(r.get("actual_revenue") or 0) for r in hist}
    cats = {}
    for e in cal:
        if e["category"] not in SKIP:
            cats.setdefault(e["category"], set()).add(e["date"])
    measured = measure_multipliers(daily, cats)
    for cat, m in sorted(measured.items()):
        print(f"{cat:10s} multiplier={m['multiplier']} from {m['days']} usable days {m['ratios']}")
    if not write:
        print("(report only; pass --write to update the calendar)")
        return
    for e in cal:
        if e["category"] in SKIP:
            e["multiplier"] = 1.0
            e["multiplier_basis"] = "not a demand event"
            continue
        m = measured[e["category"]]
        e["measured_multiplier"] = m["multiplier"]
        e["multiplier"] = applied_multiplier(m["multiplier"])
        if m["multiplier"] is None:
            e["multiplier_basis"] = f"not enough event days to measure ({m['days']} usable); treated as no effect"
        elif e["multiplier"] == 1.0:
            e["multiplier_basis"] = f"measured {m['multiplier']}x over {m['days']} days, within the +/-{int(NOISE_BAND*100)}% normal day-to-day swing; treated as no effect"
        else:
            e["multiplier_basis"] = f"measured {m['multiplier']}x over {m['days']} {e['category']} days (weekday-matched median)"
    CAL.write_text(json.dumps(cal, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {CAL}")


if __name__ == "__main__":
    main("--write" in sys.argv)
