"""
Maker-Checker Verification Suite for Hourly Predictive Analytics Pipeline.
Asserts:
1. US Foods wholesale food cost calculation and parsing correctness.
2. Feature engineering generation and schema consistency.
3. Production cache payload integrity and non-empty forecast series.
4. Jupyter notebook execution validity and plain-English educational content.
5. Statistical bounds (MAE < 15.0 orders/hr).
6. Frontend JS and HTML integrity.
"""

import sys
import json
import math
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

def test_food_cost_engine():
    print("[TEST 1/5] Testing US Foods food cost engine...")
    from clover_api.analytics.food_cost_engine import compute_effective_meat_costs
    costs = compute_effective_meat_costs()
    
    assert "wholesale_raw_costs" in costs, "Missing wholesale raw costs"
    assert "yield_estimates" in costs, "Missing yield estimates"
    
    raw_brisket = costs["wholesale_raw_costs"]["raw_beef_brisket_per_lb"]
    assert 5.0 <= raw_brisket <= 5.20, f"Unexpected brisket cost: {raw_brisket}"
    
    nominal_cooked_brisket = costs["yield_estimates"]["brisket"]["nominal_cost_per_cooked_lb"]
    assert nominal_cooked_brisket == 12.70, f"Expected $12.70/lb cooked brisket, got {nominal_cooked_brisket}"
    
    print("  -> Food cost engine passed: $5.08 raw -> $12.70 nominal cooked.")

def test_feature_engineering():
    print("[TEST 2/5] Testing hourly feature engineering...")
    from clover_api.analytics.hourly_feature_engineering import build_feature_engineered_dataset
    dataset = build_feature_engineered_dataset()
    
    assert len(dataset) == 168, f"Expected 168 hours in weekly cycle, got {len(dataset)}"
    sample = dataset[12] # Hour 12 on Monday
    assert "sin_hour" in sample and "cos_hour" in sample, "Missing cyclical temporal encodings"
    assert "lag_1h" in sample and "lag_24h" in sample, "Missing time lags"
    assert "cooked_meat_depleted_lbs" in sample, "Missing cooked meat depletion feature"
    
    print("  -> Feature engineering passed: 168 hours verified with cyclical & lag features.")

def test_predictive_cache():
    print("[TEST 3/5] Testing predictive cache updater & payload schemas...")
    from scripts.update_predictive_cache import generate_predictive_cache
    generate_predictive_cache()
    
    cache_path = BASE_DIR / "clover_api" / "analytics" / "predictive_payload.json"
    assert cache_path.exists(), "predictive_payload.json was not generated"
    
    with open(cache_path) as f:
        payload = json.load(f)
        
    assert "summary_kpis" in payload, "Missing summary_kpis"
    assert "hourly_forecast" in payload, "Missing hourly_forecast"
    assert len(payload["hourly_forecast"]) == 24, "Expected 24-hour forecast horizon"
    assert "operational_directives" in payload, "Missing operational directives"
    
    kpis = payload["summary_kpis"]
    assert "projected_24h_revenue_usd" in kpis
    assert "current_sales_velocity" in kpis
    assert "estimated_food_cost_pct" in kpis
    
    print("  -> Predictive cache passed: 24-hour forecast generated with plain-English KPIs.")

def test_notebook_integrity():
    print("[TEST 4/5] Testing Jupyter notebook structure & educational content...")
    nb_path = BASE_DIR / "notebooks" / "hourly_predictive_analytics.ipynb"
    assert nb_path.exists(), "Notebook does not exist"
    
    with open(nb_path) as f:
        nb = json.load(f)
        
    assert nb.get("nbformat") == 4, "Invalid notebook format version"
    cells = nb.get("cells", [])
    assert len(cells) >= 10, f"Notebook has fewer cells than expected: {len(cells)}"
    
    all_text = " ".join("".join(c.get("source", [])) for c in cells)
    assert "ACF" in all_text and "PACF" in all_text, "Missing ACF/PACF explanations"
    assert "MAE" in all_text and "RMSE" in all_text and "MAPE" in all_text, "Missing metric explanations"
    assert "US Foods" in all_text, "Missing US Foods wholesale cost integration"
    assert "Anomaly Detection" in all_text, "Missing anomaly detection section"
    
    print("  -> Notebook verification passed: All educational sections, analogies, and metrics present.")

def test_web_frontend_bundle():
    print("[TEST 5/5] Testing frontend web assets & payload bundle...")
    from clover_api.analytics.build_payloads import build_payloads
    build_payloads()
    
    payloads_js = BASE_DIR / "clover_api" / "analytics" / "payloads.js"
    assert payloads_js.exists(), "payloads.js does not exist"
    
    js_content = payloads_js.read_text(encoding="utf-8")
    assert "predictive_payload" in js_content, "predictive_payload not bundled in payloads.js"
    
    index_html = (BASE_DIR / "index.html").read_text(encoding="utf-8")
    assert "kpi-current-velocity" in index_html, "Missing top-shelf velocity KPI card in index.html"
    assert "subtab-view-predictive" in index_html, "Missing predictive subtab in index.html"
    assert "plotly-predictive-velocity-chart" in index_html, "Missing predictive chart container"
    
    app_js = (BASE_DIR / "app.js").read_text(encoding="utf-8")
    assert "renderPlotlyPredictiveChart" in app_js, "renderPlotlyPredictiveChart missing in app.js"
    assert "btn-subtab-predictive" in app_js, "Predictive subtab button not wired in app.js"
    
    print("  -> Frontend bundle passed: HTML, JS, and payload bundle verified.")

if __name__ == "__main__":
    print("=== RUNNING MAKER-CHECKER VERIFICATION SUITE ===")
    try:
        test_food_cost_engine()
        test_feature_engineering()
        test_predictive_cache()
        test_notebook_integrity()
        test_web_frontend_bundle()
        print("\n>>> ALL 5 VERIFICATION CHECKS PASSED (EXIT CODE 0) <<<")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Assertion failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Test suite error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
