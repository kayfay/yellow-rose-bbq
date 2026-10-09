"""
Maker-Checker Tier 1 & Tier 2 Automated Verification Suite: Turkey Demand Forecasting Engine
Asserts:
1. Historical 30-Day Backtest reduces overall projection MAPE below 15% (legacy MAPE > 150%).
2. Yesterday's Scenario Re-Run outputs realistic prep projection (9.0 - 11.5 lbs raw instead of 30 lbs).
3. Automated Drift Alert triggers when relative error |Projected - Actual| / Actual > 0.35 and logs to .loop/log.md.
4. Yield & conversion factors strictly obey 70% nominal yield invariants.
"""

import sys
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from scripts.turkey_forecast import (
    TurkeyForecaster, legacy_forecast,
    NOMINAL_YIELD, RAW_CASE_LBS, LOG_FILE
)
from scripts.backtest_turkey import run_30_day_historical_backtest

def test_historical_backtest():
    print("[TEST 1/4] Running 30-day historical chronological backtest...")
    results = run_30_day_historical_backtest(verbose=False)
    
    legacy_mape = results["legacy_mape"]
    cal_mape = results["calibrated_mape"]
    cal_mad = results["calibrated_mad"]
    
    print(f"  Legacy 30-Day MAPE:     {legacy_mape:.2f}%")
    print(f"  Calibrated 30-Day MAPE: {cal_mape:.2f}%")
    print(f"  Calibrated 30-Day MAD:  {cal_mad:.2f} lbs")
    
    assert legacy_mape > 150.0, f"Expected legacy MAPE > 150%, got {legacy_mape:.2f}%"
    assert cal_mape < 15.0, f"Expected calibrated MAPE < 15.0%, got {cal_mape:.2f}%"
    assert cal_mad < 2.0, f"Expected calibrated MAD < 2.0 lbs, got {cal_mad:.2f} lbs"
    print("  -> PASSED: Backtest confirmed calibrated model reduces MAPE below 15% threshold.\n")

def test_yesterday_rerun():
    print("[TEST 2/4] Testing yesterday's scenario re-run (Wednesday operating day)...")
    forecaster = TurkeyForecaster(safety_buffer_pct=0.10)
    
    # Input yesterday's parameters: Wednesday, typical weekday revenue ($2,800), actual sales were 8.0 lbs cooked
    yesterday_rev = 2800.0
    res = forecaster.predict("2026-10-07", revenue=yesterday_rev)
    
    legacy_output_raw = legacy_forecast(yesterday_rev)
    cal_demand_cooked = res["predicted_demand_cooked_lbs"]
    cal_target_cooked = res["target_prep_cooked_lbs"]
    cal_target_raw = res["target_prep_raw_lbs"]
    cases_req = res["cases_raw_required"]
    
    print(f"  Legacy Heuristic Projection: {legacy_output_raw:.1f} lbs Raw (Uncalibrated)")
    print(f"  Calibrated Predicted Demand: {cal_demand_cooked:.1f} lbs Cooked (Matches actual 8.0 lbs)")
    print(f"  Calibrated Target Prep Cooked (Ceiling): {cal_target_cooked:.1f} lbs Cooked (+10% buffer)")
    print(f"  Calibrated Target Prep Raw:  {cal_target_raw:.1f} lbs Raw ({cases_req} cases / ~1 breast)")
    
    # Assertions
    assert legacy_output_raw >= 30.0, f"Expected legacy output >= 30 lbs, got {legacy_output_raw}"
    assert 6.5 <= cal_demand_cooked <= 8.5, f"Expected calibrated cooked demand in [6.5, 8.5], got {cal_demand_cooked}"
    assert 9.0 <= cal_target_raw <= 11.5, f"Expected calibrated raw prep target in [9.0, 11.5] lbs, got {cal_target_raw}"
    print("  -> PASSED: Recalibrated model outputs realistic ~9-11 lbs raw prep target instead of 30 lbs.\n")

def test_drift_alert_trigger():
    print("[TEST 3/4] Testing automated drift alert and logging to .loop/log.md...")
    forecaster = TurkeyForecaster()
    
    # Simulate a 3x demand deviation (e.g. actual = 8 lbs, projected = 24 lbs)
    simulated_actual = 8.0
    simulated_projected = 24.0 # 3x deviation
    
    log_size_before = LOG_FILE.stat().st_size if LOG_FILE.exists() else 0
    
    drift_res = forecaster.evaluate_drift(
        actual_cooked=simulated_actual,
        projected_cooked=simulated_projected,
        historical_pairs=[(8.0, 24.0), (7.0, 25.0), (6.5, 26.0)],
        log_to_stream=True,
        context_note="Automated CoVe simulated 3x drift check"
    )
    
    print(f"  Simulated Actual:    {simulated_actual:.1f} lbs")
    print(f"  Simulated Projected: {simulated_projected:.1f} lbs")
    print(f"  Relative Error:      {drift_res['relative_error_pct']:.1f}%")
    print(f"  Drift Flag:          {drift_res['is_drift']}")
    print(f"  Tracking Signal:     {drift_res['tracking_signal']:.2f}")
    
    assert drift_res["is_drift"] is True, "Expected drift flag to be True for 3x deviation"
    assert drift_res["relative_error_pct"] > 35.0, "Expected relative error > 35.0%"
    
    # Verify stream layer logged the alert
    assert LOG_FILE.exists(), f"Log file {LOG_FILE} missing"
    log_content = LOG_FILE.read_text(encoding="utf-8")
    assert "ALERT: MODEL DRIFT DETECTED" in log_content, "Drift alert not found in .loop/log.md"
    assert "Automated CoVe simulated 3x drift check" in log_content, "Specific alert note not found in .loop/log.md"
    print("  -> PASSED: Drift detected (>35% threshold) and alert successfully recorded in .loop/log.md.\n")

def test_yield_conversion_invariants():
    print("[TEST 4/4] Testing raw-to-cooked yield conversion invariants...")
    forecaster = TurkeyForecaster(yield_factor=NOMINAL_YIELD)
    
    # 10 lbs cooked -> 10 / 0.70 = 14.285... -> 14.3 lbs raw
    # 8 lbs cooked -> 8 / 0.70 = 11.428... -> 11.4 lbs raw
    pred = forecaster.predict("2026-10-06", revenue=3000.0) # Tuesday
    cooked = pred["target_prep_cooked_lbs"]
    raw = pred["target_prep_raw_lbs"]
    
    expected_raw = round(cooked / NOMINAL_YIELD, 1)
    assert abs(raw - expected_raw) <= 0.1, f"Mismatch in yield conversion: raw {raw} vs expected {expected_raw}"
    assert RAW_CASE_LBS == 20.0, f"Expected 20.0 lbs per case, got {RAW_CASE_LBS}"
    print(f"  Cooked Prep: {cooked:.1f} lbs -> Raw Prep: {raw:.1f} lbs (Yield: {NOMINAL_YIELD*100:.0f}%)")
    print("  -> PASSED: Yield and pack size invariants strictly maintained.\n")

if __name__ == "__main__":
    print("================================================================================")
    print("TIER 1 & TIER 2 MAKER-CHECKER VERIFICATION: TURKEY DEMAND FORECASTING")
    print("================================================================================\n")
    try:
        test_historical_backtest()
        test_yesterday_rerun()
        test_drift_alert_trigger()
        test_yield_conversion_invariants()
        print("================================================================================")
        print("ALL 4 VERIFICATION SUITE TESTS PASSED WITH EXIT CODE 0.")
        print("================================================================================")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[VERIFICATION FAILURE] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected exception during verification: {e}")
        sys.exit(2)
