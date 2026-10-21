#!/usr/bin/env python3
"""
Yellow Rose BBQ - Real-Time POS Turnover Engine Verification Suite

Tier 1: Deterministic fixture tests asserting turnover boundaries (7 PM vs 8 PM),
        blended total summation math, status transitions, and variance calculations.
Tier 2: Structural validation of real payloads and simulation helpers.

Run: .venv4/bin/python scripts/verify_turnover_engine.py
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

RESULTS = []


def check(name: str, cond: bool, detail: str = ""):
    RESULTS.append((name, bool(cond)))
    status = "PASS" if cond else "FAIL"
    msg = f"[{status}] {name}"
    if detail:
        msg += f" -> {detail}"
    print(msg)


def node_eval(script: str, payload=None) -> str:
    proc = subprocess.run(
        ["node", "-e", script],
        input=json.dumps(payload) if payload is not None else "",
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr)
    return proc.stdout.strip()


def run_tier1_tests():
    print("=== TIER 1: Turnover State & Boundary Math (Node + tz_utils.js) ===")

    # Fixture: 24 actual buckets and 24 forecast records for Friday 2026-10-16
    actual_buckets = [{"hour": h, "sales_usd": 0.0, "orders": 0} for h in range(24)]
    # Hour 18 (6 PM): $450, 10 orders
    actual_buckets[18] = {"hour": 18, "sales_usd": 450.0, "orders": 10}
    # Hour 19 (7 PM dinner rush): $680, 15 orders
    actual_buckets[19] = {"hour": 19, "sales_usd": 680.0, "orders": 15}
    # Hour 20 (8 PM): $510, 11 orders
    actual_buckets[20] = {"hour": 20, "sales_usd": 510.0, "orders": 11}

    actuals_payload = {
        "timezone": "America/New_York",
        "days": {
            "2026-10-16": {
                "buckets": actual_buckets,
                "total_sales_usd": 1640.0,
                "total_orders": 36,
            }
        },
    }

    forecast_records = [
        {
            "hour": h,
            "predicted_orders": 10.0 if 11 <= h <= 21 else 1.0,
            "predicted_revenue": 500.0 if 11 <= h <= 21 else 50.0,
            "brisket_cooked_lbs": 15.0 if 11 <= h <= 21 else 1.0,
            "pork_cooked_lbs": 5.0 if 11 <= h <= 21 else 0.5,
        }
        for h in range(24)
    ]
    # Forecast for 7 PM was $600 and 12 orders
    forecast_records[19]["predicted_revenue"] = 600.0
    forecast_records[19]["predicted_orders"] = 12.0

    script = """
    const t = require('./tz_utils.js');
    let s = '';
    process.stdin.on('data', d => s += d).on('end', () => {
      const p = JSON.parse(s);
      
      // Simulation 1: Friday at 7:15 PM (19:15)
      const at7pm = new Date('2026-10-16T23:15:00Z'); // 19:15 EDT
      const res7pm = t.computeBlendedDayMetrics(p.actuals, p.forecast, at7pm, '2026-10-16');

      // Simulation 2: Friday at 8:05 PM (20:05) -> 7 PM rush has turned over
      const at8pm = new Date('2026-10-17T00:05:00Z'); // 20:05 EDT
      const res8pm = t.computeBlendedDayMetrics(p.actuals, p.forecast, at8pm, '2026-10-16');

      console.log(JSON.stringify({
        cutoff7: res7pm.cutoffHour,
        h18_status7: res7pm.hourly[18].status,
        h19_status7: res7pm.hourly[19].status,
        h20_status7: res7pm.hourly[20].status,
        cutoff8: res8pm.cutoffHour,
        h19_status8: res8pm.hourly[19].status,
        h19_sales8: res8pm.hourly[19].actualSales,
        h19_orders8: res8pm.hourly[19].actualOrders,
        h19_varSales8: res8pm.hourly[19].varianceSales,
        h19_varPct8: res8pm.hourly[19].variancePct,
        h20_status8: res8pm.hourly[20].status,
        blended7: res7pm.summary.blendedTotalRevenue,
        blended8: res8pm.summary.blendedTotalRevenue,
        actualSoFar8: res8pm.summary.actualSalesSoFar
      }));
    });
    """

    res_raw = node_eval(script, {"actuals": actuals_payload, "forecast": forecast_records})
    data = json.loads(res_raw)

    check("At 7:15 PM ET: cutoff hour is 19", data["cutoff7"] == 19, f"cutoff={data['cutoff7']}")
    check("At 7:15 PM ET: 6 PM (hour 18) is actual", data["h18_status7"] == "actual")
    check("At 7:15 PM ET: 7 PM (hour 19) is live", data["h19_status7"] == "live")
    check("At 7:15 PM ET: 8 PM (hour 20) is predicted", data["h20_status7"] == "predicted")

    check("At 8:05 PM ET: cutoff hour transitions to 20", data["cutoff8"] == 20, f"cutoff={data['cutoff8']}")
    check("At 8:05 PM ET: 7 PM (hour 19 dinner rush) turns over to POS actual", data["h19_status8"] == "actual")
    check("At 8:05 PM ET: 7 PM displays verified POS sales ($680)", data["h19_sales8"] == 680.0, f"sales={data['h19_sales8']}")
    check("At 8:05 PM ET: 7 PM displays verified POS orders (15)", data["h19_orders8"] == 15, f"orders={data['h19_orders8']}")
    check("At 8:05 PM ET: 7 PM variance is +$80 (+13.3%) vs $600 forecast",
          data["h19_varSales8"] == 80.0 and abs(data["h19_varPct8"] - 13.3) < 0.1,
          f"varSales={data['h19_varSales8']}, varPct={data['h19_varPct8']}")
    check("At 8:05 PM ET: 8 PM is live pacing", data["h20_status8"] == "live")

    # Math assertion: At 8 PM, actual so far includes hours 0..20 = 450 + 680 + 510 = 1640
    check("Actual so far correctly sums elapsed and live hours ($1,640)", data["actualSoFar8"] == 1640.0)

    # Test simulation helper API
    sim_script = """
    const t = require('./tz_utils.js');
    t.clearSimulatedNow();
    const isLive = !t.isSimulating();
    t.setSimulatedNow('2026-10-16T20:00:00-04:00');
    const isSim = t.isSimulating();
    const simHour = t.shopHour();
    const simDate = t.shopDateStr();
    t.clearSimulatedNow();
    const cleared = !t.isSimulating();
    console.log(JSON.stringify({ isLive, isSim, simHour, simDate, cleared }));
    """
    sim_data = json.loads(node_eval(sim_script))
    check("ShopTime simulator sets custom time", sim_data["isSim"] and sim_data["simHour"] == 20)
    check("ShopTime simulator sets shop date (2026-10-16)", sim_data["simDate"] == "2026-10-16")
    check("ShopTime simulator reset restores live clock", sim_data["cleared"] and sim_data["isLive"])


def run_tier2_tests():
    print("=== TIER 2: Live Payload Structural Integration ===")
    actuals_path = ROOT / "clover_api" / "analytics" / "hourly_actuals.json"
    pred_path = ROOT / "clover_api" / "analytics" / "predictive_payload.json"

    if not actuals_path.exists() or not pred_path.exists():
        check("Payload files exist for structural tests", False, "Missing json payloads")
        return

    actuals = json.loads(actuals_path.read_text())
    predictive = json.loads(pred_path.read_text())

    forecast_recs = predictive.get("hourly_forecast", [])
    check("predictive_payload contains hourly_forecast list", len(forecast_recs) > 0, f"count={len(forecast_recs)}")

    # Test computeBlendedDayMetrics with real payloads under Node
    script = """
    const t = require('./tz_utils.js');
    let s = '';
    process.stdin.on('data', d => s += d).on('end', () => {
      const p = JSON.parse(s);
      const dates = Object.keys(p.actuals.days || {}).sort();
      if (dates.length === 0) {
        console.log(JSON.stringify({ ok: false, err: 'no dates' }));
        return;
      }
      const testDate = dates[dates.length - 1]; // most recent date in actuals
      const metrics = t.computeBlendedDayMetrics(p.actuals, p.predictive.hourly_forecast, null, testDate);
      console.log(JSON.stringify({
        ok: true,
        testDate,
        hourlyCount: metrics.hourly.length,
        hasActuals: metrics.hasActuals,
        blendedTotal: metrics.summary.blendedTotalRevenue
      }));
    });
    """
    res = json.loads(node_eval(script, {"actuals": actuals, "predictive": predictive}))
    check("Real payload metrics computed successfully", res.get("ok") is True)
    check("Real payload produces exactly 24 hourly buckets", res.get("hourlyCount") == 24, f"count={res.get('hourlyCount')}")
    check("Real payload recognizes actuals data", res.get("hasActuals") is True, f"date={res.get('testDate')}")


def main():
    try:
        run_tier1_tests()
        run_tier2_tests()
    except Exception as e:
        check(f"Exception during test execution: {e}", False)

    total = len(RESULTS)
    passed = sum(1 for _, ok in RESULTS if ok)
    failed = total - passed

    print(f"\nSummary: {passed}/{total} tests passed ({failed} failed)")
    if failed > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
