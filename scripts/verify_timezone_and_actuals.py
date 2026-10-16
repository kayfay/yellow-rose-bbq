#!/usr/bin/env python3
"""
Tier 1 & Tier 2 verification for the timezone fix and hourly actuals feature.

Tier 1 (deterministic, fixture-based): exact-value assertions.
Tier 2 (structural): the real generated hourly_actuals.json. Missing file =>
  FAIL when CI=1/true, otherwise SKIPPED (exit stays 0).
Regression: live hourly export runs against a copy of the real DB schema.

Run: .venv4/bin/python scripts/verify_timezone_and_actuals.py
"""
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "clover_api" / "analytics"))

import hourly_actuals as ha  # noqa: E402
from clover_api.analytics import dashboard  # noqa: E402

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" -> {detail}" if detail else ""))


def node_eval(script, payload=None):
    proc = subprocess.run(
        ["node", "-e", script],
        input=json.dumps(payload) if payload is not None else "",
        capture_output=True, text=True, cwd=ROOT,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr)
    return proc.stdout.strip()


def make_fixture_db(path):
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE orders (order_id TEXT PRIMARY KEY, created_time TIMESTAMP, "
                 "total_usd REAL, state TEXT)")
    rows = [
        ("a", "2026-10-13 14:30:00", 100.00, "locked"),   # 10:30 ET Oct 13
        ("b", "2026-10-13 14:45:00", 50.50, "locked"),    # 10:45 ET Oct 13
        ("c", "2026-10-14 03:30:00", 20.00, "locked"),    # 23:30 ET Oct 13 (UTC says Oct 14)
        ("d", "2026-10-14 04:30:00", 7.00, "locked"),     # 00:30 ET Oct 14
        ("e", "2026-10-13 15:00:00", 999.0, "open"),      # ignored: not locked
        ("f", "2026-11-01 05:30:00", 11.00, "locked"),    # 01:30 EDT (fall-back day)
        ("g", "2026-11-01 06:30:00", 13.00, "locked"),    # 01:30 EST (same local hour)
    ]
    conn.executemany("INSERT INTO orders VALUES (?,?,?,?)", rows)
    conn.commit()
    return conn


def main():
    print("=== TIER 1: timezone formatting ===")
    out = node_eval("const t=require('./tz_utils.js');"
                    "console.log(t.formatShopTimestamp('2026-10-14T20:37:44-07:00'))")
    check("JS: 2026-10-14T20:37:44-07:00 -> October 14 (not 15)",
          out == "October 14, 2026 at 11:37 PM EDT", out)
    out = node_eval("const t=require('./tz_utils.js');"
                    "console.log(t.formatShopTimestamp('2026-10-15T03:43:00+00:00'))")
    check("JS: 03:43Z Oct 15 shows as Oct 14 evening ET",
          out == "October 14, 2026 at 11:43 PM EDT", out)
    out = node_eval("const t=require('./tz_utils.js');"
                    "console.log(t.formatShopTimestamp('2026-01-15T03:43:00Z'))")
    check("JS: winter timestamp uses EST", out == "January 14, 2026 at 10:43 PM EST", out)

    local = ha.utc_naive_to_local("2026-10-15 03:43:00")
    check("PY: naive UTC DB value -> aware NY", local.isoformat() == "2026-10-14T23:43:00-04:00", local.isoformat())
    parsed = dashboard._parse_to_local("2026-10-15T03:43:00", naive_is_utc=True)
    check("PY: dashboard parser treats DB naive as UTC", parsed.isoformat() == "2026-10-14T23:43:00-04:00")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        db_file = tmp / "fixture.db"
        conn = make_fixture_db(db_file)

        # Regression for the original bug: naive UTC DB time must beat nothing silently.
        saved = (dashboard.DB_PATH, dashboard.ANALYTICS_DIR)
        dashboard.DB_PATH, dashboard.ANALYTICS_DIR = db_file, tmp
        try:
            stamp = dashboard.get_last_updated_time()
        finally:
            dashboard.DB_PATH, dashboard.ANALYTICS_DIR = saved
        check("PY: get_last_updated_time is tz-aware NY and on Nov 1 local date",
              stamp.startswith("2026-11-01T01:30:00") and stamp.endswith("-05:00"), stamp)

        print("=== TIER 1: hourly bucketing (fixture) ===")
        b13 = ha.get_hourly_actuals_for_date(conn, "2026-10-13")
        check("Oct 13 returns exactly 24 buckets", len(b13) == 24 and [b["hour"] for b in b13] == list(range(24)))
        check("Oct 13 hour 10 = $150.50 / 2 orders", b13[10]["sales_usd"] == 150.50 and b13[10]["orders"] == 2, str(b13[10]))
        check("Oct 13 hour 23 gets 23:30 ET order (not Oct 14)", b13[23]["sales_usd"] == 20.0 and b13[23]["orders"] == 1)
        check("Open order excluded", sum(b["orders"] for b in b13) == 3)
        b14 = ha.get_hourly_actuals_for_date(conn, "2026-10-14")
        check("Oct 14 hour 0 = $7.00", b14[0]["sales_usd"] == 7.0 and sum(b["orders"] for b in b14) == 1)
        empty = ha.get_hourly_actuals_for_date(conn, "2026-10-12")
        check("Date with no orders -> 24 zero buckets", len(empty) == 24 and all(b["orders"] == 0 for b in empty))
        dst = ha.get_hourly_actuals_for_date(conn, "2026-11-01")
        check("DST fall-back: both 01:30 orders land in hour 1, 24 buckets",
              len(dst) == 24 and dst[1]["orders"] == 2 and dst[1]["sales_usd"] == 24.0, str(dst[1]))
        try:
            ha.get_hourly_actuals_for_date(conn, "10/13/2026")
            check("Malformed date rejected", False)
        except ValueError:
            check("Malformed date rejected", True)

        print("=== TIER 1: UI overlay math (node) ===")
        payload = ha.build_payload(conn, now=ha.local_now())
        forecast = [{"hour": h, "predicted_orders": 1.0, "predicted_revenue": 10.0} for h in range(24)]
        script = (
            "const t=require('./tz_utils.js');let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{"
            "const p=JSON.parse(s);"
            "const past=t.buildActualsOverlay(p.actuals,null,'2026-10-13',p.forecast,new Date('2026-10-16T15:00:00Z'));"
            "const today=t.buildActualsOverlay(p.actuals,null,'2026-10-14',p.forecast,new Date('2026-10-14T04:10:00Z'));"
            "const fut=t.buildActualsOverlay(p.actuals,null,'2026-10-20',p.forecast,new Date('2026-10-16T15:00:00Z'));"
            "console.log(JSON.stringify({past:past.summary,pastN:past.actualOrders.filter(x=>x!==null).length,"
            "todayCut:today.cutoffHour,todayVals:today.actualOrders.filter(x=>x!==null).length,fut:fut}))})"
        )
        res = json.loads(node_eval(script, {"actuals": payload, "forecast": forecast}))
        check("Past date summary: $170.50 actual / 3 orders / $240 forecast",
              res["past"]["actualSales"] == 170.5 and res["past"]["actualOrders"] == 3
              and res["past"]["forecastFullDay"] == 240.0, str(res["past"]))
        check("Past date plots all 24 hours", res["pastN"] == 24)
        check("Today (00:10 ET) stops at current hour 0", res["todayCut"] == 0 and res["todayVals"] == 1,
              f"cutoff={res['todayCut']} points={res['todayVals']}")
        check("Future date returns no actuals overlay (forecast only)", res["fut"] is None)

        # Baseline excludes the picked date
        sat = {"days": {"2026-10-10": {"buckets": [{"hour": h, "sales_usd": 0, "orders": 4} for h in range(24)]},
                        "2026-10-17": {"buckets": [{"hour": h, "sales_usd": 0, "orders": 8} for h in range(24)]}}}
        sat["weekday_baseline"] = ha.build_weekday_baseline(
            {k: v["buckets"] for k, v in sat["days"].items()})
        out = node_eval(
            "const t=require('./tz_utils.js');let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{"
            "const p=JSON.parse(s);const o=t.buildActualsOverlay(p.a,null,'2026-10-17',p.f,new Date('2026-10-18T15:00:00Z'));"
            "console.log(o.baselineOrders[12])})", {"a": sat, "f": forecast})
        check("Baseline for Sat Oct 17 excludes itself (=4.0, not 6.0)", float(out) == 4.0, out)
        conn.close()

    print("=== TIER 2: real hourly_actuals.json (structural) ===")
    real = ROOT / "clover_api" / "analytics" / "hourly_actuals.json"
    in_ci = os.environ.get("CI", "").lower() in ("1", "true")
    if not real.exists():
        if in_ci:
            check("real hourly_actuals.json exists (CI)", False, str(real))
        else:
            print(f"[SKIPPED] {real} not found (non-CI run)")
    else:
        data = json.loads(real.read_text())
        check("payload timezone is America/New_York", data.get("timezone") == "America/New_York")
        from datetime import datetime
        ga = datetime.fromisoformat(data["generated_at"])
        check("generated_at is tz-aware", ga.tzinfo is not None, data["generated_at"])
        ok = all(len(v["buckets"]) == 24
                 and [b["hour"] for b in v["buckets"]] == list(range(24))
                 and all({"hour", "sales_usd", "orders"} <= set(b) for b in v["buckets"])
                 for v in data["days"].values())
        check(f"all {len(data['days'])} day entries have 24 well-formed buckets", ok)
        if "2026-10-13" in data["days"]:
            check("2026-10-13 present with 24 buckets", len(data["days"]["2026-10-13"]["buckets"]) == 24)
        else:
            print("[INFO] 2026-10-13 not in real data (no orders locally); structure-only check")

    print("=== REGRESSION: live pipeline compatibility ===")
    real_db = ROOT / "clover_api" / "data" / "clover_sales.db"
    if real_db.exists():
        with tempfile.TemporaryDirectory() as tmp:
            db_copy = Path(tmp) / "copy.db"
            shutil.copy(real_db, db_copy)
            c = sqlite3.connect(db_copy)
            cols = {r[1] for r in c.execute("PRAGMA table_info(orders)")}
            c.close()
            check("orders schema has created_time/total_usd/state", {"created_time", "total_usd", "state"} <= cols, str(sorted(cols)))
            try:
                out_file = Path(tmp) / "out.json"
                ha.export_hourly_actuals(db_copy, out_file)
                check("hourly export runs against live schema without errors", out_file.exists())
            except Exception as exc:  # noqa: BLE001
                check("hourly export runs against live schema without errors", False, repr(exc))
    else:
        print("[SKIPPED] live DB not present")
    syn = subprocess.run(["node", "--check", "app.js", "d3_charts.js", "tz_utils.js"], cwd=ROOT, capture_output=True, text=True)
    check("JS syntax check (app.js, d3_charts.js, tz_utils.js)", syn.returncode == 0, syn.stderr.strip())

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    code = main()
    print(f"exit code {code}")
    sys.exit(code)
