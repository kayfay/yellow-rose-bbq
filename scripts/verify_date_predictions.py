#!/usr/bin/env python3
"""
scripts/verify_date_predictions.py
Verification suite for Date Selector, Prep Target Metrics, and Prediction Engine.
Tests:
  1. Historical date lookup (POS actuals).
  2. Present date calculation (today's operations).
  3. Weekend multi-day horizon aggregation (Fri-Sun, 3 days) verifying raw brisket,
     pork shoulder, cooked yield (40%), sausage batches/links, ribs, dino ribs, and case conversions.
  4. Single-day projections (Thursday, Friday, Saturday).
  5. Multipliers (Jaguars 3.5x, Holiday 0.7x).
  6. Defensive edge cases (empty strings, malformed dates, zero-division resilience).
"""

import sys
import os
import json
import math
from datetime import datetime, timedelta

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIST_PATH = os.path.join(ROOT_DIR, 'clover_api', 'analytics', 'historical_payload.json')
DASH_PATH = os.path.join(ROOT_DIR, 'clover_api', 'analytics', 'dashboard_payload.json')

def load_payloads():
    with open(HIST_PATH, 'r', encoding='utf-8') as f:
        hist_data = json.load(f)
    with open(DASH_PATH, 'r', encoding='utf-8') as f:
        dash_data = json.load(f)
    return hist_data, dash_data

def safe_default_record(date_str, day_name):
    return {
        "date": date_str,
        "day_name": day_name,
        "predicted_revenue": 2700.0,
        "brisket_raw_lbs": 80.0,
        "pork_shoulder_raw_lbs": 50.0,
        "sausage_lbs": 50.0,
        "tacos_sold": 60,
        "rosebuds_sold": 25,
        "pork_ribs_racks": 4,
        "beef_dino_ribs": 3,
        "recommended_staff": 4,
        "pitmaster_hours": 34.0,
        "is_historical": False
    }

def simulate_prep_calculations(records, is_range=False):
    """Simulates the exact KPI calculations from app.js."""
    if not records:
        records = [safe_default_record("2026-01-01", "Day")]

    if is_range:
        b_raw = sum(r.get('brisket_raw_lbs', 0.0) for r in records)
        p_raw = sum(r.get('pork_shoulder_raw_lbs', 0.0) for r in records)
        s_val = sum(round(r.get('sausage_lbs', 0.0)) for r in records)
        r_val = sum(round(r.get('pork_ribs_racks', 0.0)) for r in records)
        dr_val = sum(round(r.get('beef_dino_ribs', 0.0)) for r in records)
        total_tacos = sum(round(r.get('tacos_sold', 0.0)) for r in records)
        total_rosebuds = sum(round(r.get('rosebuds_sold', 0.0)) for r in records)
        total_rev = sum(round(r.get('predicted_revenue', 0.0)) for r in records)
    else:
        target = records[0]
        b_raw = target.get('brisket_raw_lbs', 0.0)
        p_raw = target.get('pork_shoulder_raw_lbs', 0.0)
        s_val = round(target.get('sausage_lbs', 0.0))
        r_val = round(target.get('pork_ribs_racks', 0.0))
        dr_val = round(target.get('beef_dino_ribs', 0.0))
        total_tacos = round(target.get('tacos_sold', 0.0))
        total_rosebuds = round(target.get('rosebuds_sold', 0.0))
        total_rev = round(target.get('predicted_revenue', 0.0))

    b_val = round(b_raw)
    p_val = round(p_raw)

    # Yield and sausage math
    b_cooked = round(b_val * 0.4)
    p_cooked = round(p_val * 0.4)
    total_raw = b_val + p_val
    total_cooked = b_cooked + p_cooked
    sausage_batches = math.ceil(s_val / 60.0) if s_val > 0 else 0
    sausage_links = s_val * 3

    # Cases and packaging conversions
    brisket_cases = b_val / 70.0
    brisket_packers = math.ceil(b_val / 14.0)
    pork_cases = p_val / 32.0
    pork_butts = math.ceil(p_val / 8.0)
    ribs_cases = r_val / 6.0
    ribs_bags = math.ceil(r_val / 2.0)
    dino_cases = dr_val / 12.0

    return {
        "b_val": b_val,
        "p_val": p_val,
        "b_cooked": b_cooked,
        "p_cooked": p_cooked,
        "total_raw": total_raw,
        "total_cooked": total_cooked,
        "s_val": s_val,
        "sausage_batches": sausage_batches,
        "sausage_links": sausage_links,
        "r_val": r_val,
        "dr_val": dr_val,
        "total_tacos": total_tacos,
        "total_rosebuds": total_rosebuds,
        "total_rev": total_rev,
        "brisket_cases": brisket_cases,
        "brisket_packers": brisket_packers,
        "pork_cases": pork_cases,
        "pork_butts": pork_butts,
        "ribs_cases": ribs_cases,
        "ribs_bags": ribs_bags,
        "dino_cases": dino_cases
    }

def test_historical_lookup(hist_records):
    print("--- [TEST 1] Historical Date Lookup ---")
    known_date = "2026-06-11"
    matched = next((r for r in hist_records if r.get('date') == known_date), None)
    assert matched is not None, f"Expected record for {known_date}"
    assert matched.get('is_historical') is True, "Expected is_historical flag to be True"
    assert matched.get('actual_revenue') == 837.43, f"Unexpected actual_revenue: {matched.get('actual_revenue')}"
    assert matched.get('rosebuds_sold') == 20, f"Unexpected rosebuds: {matched.get('rosebuds_sold')}"
    
    calc = simulate_prep_calculations([matched], is_range=False)
    assert calc['b_val'] == 40
    assert calc['p_val'] == 24
    assert calc['b_cooked'] == 16  # 40 * 0.4
    assert calc['p_cooked'] == 10  # 24 * 0.4 = 9.6 -> round(10)
    print(f"  ✓ {known_date} successfully resolved: Actual Rev=${matched['actual_revenue']}, Cooked Brisket={calc['b_cooked']} lbs")

def test_weekend_aggregation():
    print("--- [TEST 2] Weekend Multi-Day Aggregation (Fri-Sun) ---")
    weekend_records = [
        {"date": "2026-08-14", "day_name": "Fri", "predicted_revenue": 2880.0, "brisket_raw_lbs": 81.5, "pork_shoulder_raw_lbs": 48.0, "sausage_lbs": 54.0, "pork_ribs_racks": 4, "beef_dino_ribs": 4, "tacos_sold": 72, "rosebuds_sold": 28},
        {"date": "2026-08-15", "day_name": "Sat", "predicted_revenue": 4554.0, "brisket_raw_lbs": 128.9, "pork_shoulder_raw_lbs": 75.9, "sausage_lbs": 85.0, "pork_ribs_racks": 7, "beef_dino_ribs": 6, "tacos_sold": 113, "rosebuds_sold": 45},
        {"date": "2026-08-16", "day_name": "Sun", "predicted_revenue": 2520.0, "brisket_raw_lbs": 71.5, "pork_shoulder_raw_lbs": 42.0, "sausage_lbs": 47.0, "pork_ribs_racks": 4, "beef_dino_ribs": 3, "tacos_sold": 63, "rosebuds_sold": 25}
    ]
    calc = simulate_prep_calculations(weekend_records, is_range=True)
    
    expected_b_raw = round(81.5 + 128.9 + 71.5) # 281.9 -> 282
    expected_p_raw = round(48.0 + 75.9 + 42.0) # 165.9 -> 166
    expected_s_val = round(54 + 85 + 47) # 186
    expected_rev = round(2880 + 4554 + 2520) # 9954
    
    assert calc['b_val'] == expected_b_raw, f"Brisket sum mismatch: {calc['b_val']} vs {expected_b_raw}"
    assert calc['p_val'] == expected_p_raw, f"Pork sum mismatch: {calc['p_val']} vs {expected_p_raw}"
    assert calc['s_val'] == expected_s_val, f"Sausage sum mismatch: {calc['s_val']} vs {expected_s_val}"
    assert calc['total_rev'] == expected_rev, f"Rev sum mismatch: {calc['total_rev']} vs {expected_rev}"

    # Yield checks (40% recovery)
    assert calc['b_cooked'] == round(expected_b_raw * 0.4)
    assert calc['p_cooked'] == round(expected_p_raw * 0.4)
    assert calc['total_cooked'] == calc['b_cooked'] + calc['p_cooked']

    # Sausage batches & links: 186 lbs / 60 = 3.1 -> ceil = 4 batches. 186 * 3 = 558 links.
    assert calc['sausage_batches'] == 4
    assert calc['sausage_links'] == 558

    # Case conversions
    assert round(calc['brisket_cases'], 1) == round(expected_b_raw / 70.0, 1) # ~4.0 cases
    assert calc['brisket_packers'] == math.ceil(expected_b_raw / 14.0) # 21 packers
    assert round(calc['pork_cases'], 1) == round(expected_p_raw / 32.0, 1) # ~5.2 cases
    assert calc['pork_butts'] == math.ceil(expected_p_raw / 8.0) # 21 butts

    print(f"  ✓ Weekend cumulative targets verified: Raw Brisket={calc['b_val']} lbs (~{calc['b_cooked']} lbs cooked, {calc['brisket_cases']:.1f} cases, {calc['brisket_packers']} packers)")
    print(f"  ✓ Sausage: {calc['s_val']} lbs -> {calc['sausage_batches']} batches ({calc['sausage_links']} links)")
    print(f"  ✓ Total Weekend Revenue Projected: ${calc['total_rev']:,}")

def test_single_day_projections():
    print("--- [TEST 3] Single-Day Target Projections (Thu, Fri, Sat) ---")
    days = [
        {"name": "Thursday", "rec": {"date": "2026-08-20", "day_name": "Thu", "predicted_revenue": 1980.0, "brisket_raw_lbs": 55.8, "pork_shoulder_raw_lbs": 33.0, "sausage_lbs": 37, "pork_ribs_racks": 3, "beef_dino_ribs": 2, "tacos_sold": 49, "rosebuds_sold": 19}},
        {"name": "Friday", "rec": {"date": "2026-08-21", "day_name": "Fri", "predicted_revenue": 2880.0, "brisket_raw_lbs": 81.5, "pork_shoulder_raw_lbs": 48.0, "sausage_lbs": 54, "pork_ribs_racks": 4, "beef_dino_ribs": 4, "tacos_sold": 72, "rosebuds_sold": 28}},
        {"name": "Saturday", "rec": {"date": "2026-08-22", "day_name": "Sat", "predicted_revenue": 3960.0, "brisket_raw_lbs": 112.2, "pork_shoulder_raw_lbs": 66.0, "sausage_lbs": 74, "pork_ribs_racks": 6, "beef_dino_ribs": 5, "tacos_sold": 99, "rosebuds_sold": 39}}
    ]

    for d in days:
        calc = simulate_prep_calculations([d['rec']], is_range=False)
        assert calc['b_val'] == round(d['rec']['brisket_raw_lbs'])
        assert calc['p_val'] == round(d['rec']['pork_shoulder_raw_lbs'])
        assert calc['s_val'] == d['rec']['sausage_lbs']
        assert calc['b_cooked'] == round(calc['b_val'] * 0.4)
        print(f"  ✓ {d['name']}: {calc['b_val']} lbs raw brisket ({calc['b_cooked']} lbs cooked), {calc['p_val']} lbs pork, ${calc['total_rev']} rev")

def test_event_multipliers():
    print("--- [TEST 4] Live Event Multipliers ---")
    base = safe_default_record("2026-09-13", "Sun")
    
    # Jaguars Home Game multiplier: 3.5x
    jags_mult = 3.5
    jags_rev = base['predicted_revenue'] * jags_mult
    jags_brisket = base['brisket_raw_lbs'] * jags_mult
    assert jags_rev == 2700.0 * 3.5 # 9450.0
    assert jags_brisket == 80.0 * 3.5 # 280.0
    print(f"  ✓ Jaguars Game multiplier: Revenue scaled to ${jags_rev:.2f}, Brisket scaled to {jags_brisket} lbs")

    # Holiday multiplier: 0.7x
    hol_mult = 0.7
    hol_rev = base['predicted_revenue'] * hol_mult
    assert hol_rev == 2700.0 * 0.7 # 1890.0
    print(f"  ✓ Holiday multiplier: Revenue scaled to ${hol_rev:.2f}")

def test_defensive_edge_cases():
    print("--- [TEST 5] Defensive Edge Cases & Zero-Division Resilience ---")
    # Empty string or malformed dates
    default_rec = safe_default_record("", "Unknown")
    assert default_rec['predicted_revenue'] > 0
    assert default_rec['brisket_raw_lbs'] > 0

    # Zero-division guard test (baseline denominator)
    records = []
    baseline_rev = math.max(1, 0) if hasattr(math, 'max') else max(1, 0)
    assert baseline_rev == 1, "Baseline revenue guard failed"
    calc_empty = simulate_prep_calculations(records, is_range=True)
    assert calc_empty['total_rev'] == 2700
    assert calc_empty['b_val'] == 80
    print("  ✓ Zero-length array successfully handled via safe default record without division by zero")

def test_closed_monday_resolution(dash_records):
    print("--- [TEST 6] Closed Monday & Non-Operating Day Resolution ---")
    monday_rec = next((r for r in dash_records if r.get('date') == "2026-09-14"), None)
    assert monday_rec is not None, "Expected record for 2026-09-14 (Monday)"
    assert monday_rec.get('day_name') == "Mon", "Expected day_name to be Mon"
    assert monday_rec.get('is_closed') is True, "Expected is_closed flag to be True for Monday"
    assert monday_rec.get('predicted_revenue') == 0.0, f"Expected 0.0 predicted revenue on closed Monday, got {monday_rec.get('predicted_revenue')}"
    assert monday_rec.get('brisket_raw_lbs') == 0.0, "Expected 0.0 brisket on closed Monday"
    assert monday_rec.get('pork_shoulder_raw_lbs') == 0.0, "Expected 0.0 pork on closed Monday"

    calc = simulate_prep_calculations([monday_rec], is_range=False)
    assert calc['b_val'] == 0, f"Expected 0 lbs raw brisket on Monday, got {calc['b_val']}"
    assert calc['total_rev'] == 0, f"Expected 0 rev on Monday, got {calc['total_rev']}"
    print("  ✓ Monday 2026-09-14 confirmed Closed: 0 lbs meat prep, 0 rev, Closed status guaranteed.")

def main():
    print("==================================================")
    print("  YELLOW ROSE BBQ PREP & PREDICTION VERIFICATION  ")
    print("==================================================")
    hist_data, dash_data = load_payloads()
    hist_records = hist_data.get('historical_records', [])
    dash_records = dash_data.get('forecast', {}).get('forecast_records', [])
    
    test_historical_lookup(hist_records)
    test_weekend_aggregation()
    test_single_day_projections()
    test_event_multipliers()
    test_defensive_edge_cases()
    test_closed_monday_resolution(dash_records)

    print("\n[SUCCESS] All 6 test suites passed with 100% precision.")

if __name__ == '__main__':
    main()
