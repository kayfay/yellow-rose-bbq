#!/usr/bin/env python3
"""
Diagnostic Root-Cause Trace for Brisket Over-Prediction (2026-11-14: 17 projected vs 12 actual).
"""
import json
import math
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRIEF_PATH = ROOT / "clover_api" / "analytics" / "daily_executive_brief.json"
PRED_PATH = ROOT / "clover_api" / "analytics" / "predictive_payload.json"
DB_PATH = ROOT / "clover_api" / "data" / "clover_sales.db"


def main():
    print("=" * 72)
    print("BRISKET VARIANCE DIAGNOSTIC TRACE (Target: Saturday 2026-11-14)")
    print("=" * 72)

    # 1. Check predictive_payload.json for 2026-11-14
    if PRED_PATH.exists():
        pred = json.loads(PRED_PATH.read_text(encoding="utf-8"))
        by_date = pred.get("by_date", {})
        sat = by_date.get("2026-11-14")
        if sat:
            print("\n[1] predictive_payload.json -> by_date['2026-11-14']:")
            for k in ["predicted_revenue", "brisket_raw_lbs", "brisket_cooked_lbs", "dow_name", "event_label"]:
                if k in sat:
                    print(f"    {k}: {sat[k]}")
            b_raw = float(sat.get("brisket_raw_lbs", 0.0))
            print(f"    Raw / 16.4 = {b_raw / 16.4:.2f} -> ceil = {math.ceil(b_raw / 16.4) if b_raw > 0 else 0} packers")
            print(f"    Cooked (35% of raw) = {b_raw * 0.35:.2f} lbs")
            print(f"    Cooked / 5.75 = {(b_raw * 0.35) / 5.75:.2f} packers")
        else:
            print("\n[1] 2026-11-14 not found in predictive_payload.json; checking recent Saturdays:")
            for d, v in sorted(by_date.items())[-10:]:
                print(f"    {d}: rev=${v.get('predicted_revenue', 0):,.0f}, brisket_raw={v.get('brisket_raw_lbs', 0)} lbs, packers={math.ceil(float(v.get('brisket_raw_lbs', 0))/16.4)}")

    # 2. Check daily_executive_brief.json
    if BRIEF_PATH.exists():
        brief = json.loads(BRIEF_PATH.read_text(encoding="utf-8"))
        by_dow = brief.get("by_dow", {})
        sat_brief = by_dow.get("Sat", {})
        print("\n[2] daily_executive_brief.json -> by_dow['Sat']:")
        print(f"    headline: {sat_brief.get('headline')}")
        print(f"    the_action: {sat_brief.get('the_action')}")

    # 3. Check catering outliers in clover_sales.db
    if DB_PATH.exists():
        conn = sqlite3.connect(str(DB_PATH))
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT o.date, COUNT(*), SUM(o.total)/100.0
                FROM orders o
                WHERE o.total >= 50000
                GROUP BY o.date
                ORDER BY o.date DESC
                LIMIT 10
            """)
            rows = cur.fetchall()
            print("\n[3] High-value orders (>= $500) in clover_sales.db (recent 10 dates):")
            for r in rows:
                print(f"    {r[0]}: {r[1]} orders >= $500 (sum=${r[2]:,.2f})")
        except Exception as e:
            print(f"\n[3] DB query note: {e}")
        finally:
            conn.close()

    # 4. Trace meat_forecast.py Saturday baseline + 1.10x margin
    print("\n[4] meat_forecast.py / app.js Margin Stacking Trace:")
    sat_base_cooked = 78.0
    print(f"    Saturday baseline (meat_forecast.py): {sat_base_cooked} lbs cooked")
    print(f"    With 1.10x revenue/event multiplier: {sat_base_cooked * 1.10:.1f} lbs cooked")
    print(f"    With additional 1.10x prep margin (app.js ~1078): {sat_base_cooked * 1.10 * 1.10:.1f} lbs cooked")
    print(f"    Divided by 5.75 lbs/packer (or 0.35 yield / 16.4): {(sat_base_cooked * 1.10 * 1.10) / 5.75:.2f} -> {math.ceil((sat_base_cooked * 1.10 * 1.10) / 5.75)} packers!")
    print(f"    Without compound 1.10x margin (78.0 / 5.75): {sat_base_cooked / 5.75:.2f} -> {math.ceil(sat_base_cooked / 5.75)} packers")


if __name__ == "__main__":
    main()
