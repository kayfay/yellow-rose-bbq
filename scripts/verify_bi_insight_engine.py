#!/usr/bin/env python3
"""
Deterministic PAL Verification Suite for v2.1.0 Executive BI Dashboard &
Plain-English Daily Actionable Insight Engine (Tasks 18-22).
"""

from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from daily_insight_engine import generate_daily_executive_brief


def assert_true(cond: bool, label: str) -> None:
    if not cond:
        print(f"[BI-PAL FAIL] {label}")
        sys.exit(1)
    print(f"[BI-PAL PASS] {label}")


def verify_daily_insight_engine() -> None:
    payload = generate_daily_executive_brief()
    brief_path = ROOT / "clover_api" / "analytics" / "daily_executive_brief.json"
    assert_true(brief_path.exists(), "daily_executive_brief.json generated on disk")

    active = payload.get("active_service_brief", {})
    assert_true(
        bool(active.get("the_insight")) and bool(active.get("the_action")),
        "Active service brief contains both 1. What's Happening (the_insight) and 2. Recommended Next Step (the_action)",
    )

    exp_sales = active.get("expected_sales_usd", 0)
    meat_cost = active.get("estimated_meat_cost_usd", 0)
    leftover = active.get("left_after_meat_cost_usd", 0)
    assert_true(
        exp_sales > 0 and (exp_sales - meat_cost == leftover),
        f"Financial bridge identity holds: ${exp_sales} sales - ${meat_cost} meat cost == ${leftover} leftover",
    )

    sb = active.get("sales_bridge", {})
    bridge_sum = (
        sb.get("typical_day_usd", 0)
        + sb.get("rush_hour_delta_usd", 0)
        + sb.get("weather_event_delta_usd", 0)
    )
    assert_true(
        bridge_sum == sb.get("expected_sales_usd", 0),
        f"Sales breakdown bridge sums to expected sales (${bridge_sum} == ${sb.get('expected_sales_usd', 0)})",
    )

    banned_jargon = [
        "sarimax",
        "arima",
        "z-score",
        "sigma",
        "exogenous",
        "elasticity",
        "dow base",
        "huber",
        "cogs",
    ]
    for day_key, day_brief in payload.get("by_day_name", {}).items():
        combined_text = (day_brief.get("the_insight", "") + " " + day_brief.get("the_action", "")).lower()
        for term in banned_jargon:
            assert_true(
                term not in combined_text,
                f"Zero statistical/BI jargon ('{term}') in {day_key} plain-English brief",
            )
        if not day_brief.get("is_closed"):
            assert_true(
                "$" in day_brief.get("the_insight", "") and "typical" in day_brief.get("the_insight", "").lower(),
                f"{day_key} insight grounded in dollar sales and comparison to a typical {day_key}",
            )
            assert_true(
                "lbs raw brisket" in day_brief.get("the_action", "").lower()
                and "racks of spare ribs" in day_brief.get("the_action", "").lower(),
                f"{day_key} action specifies concrete raw/cooked lbs and rib racks to prep",
            )

    sparks = payload.get("sparklines_7d", {})
    for key in ("sales_usd", "meat_cost_usd", "left_after_meat_usd", "brisket_raw_lbs", "pork_raw_lbs", "ribs_racks"):
        assert_true(
            isinstance(sparks.get(key), list) and len(sparks[key]) >= 5,
            f"7-day sparkline series '{key}' populated ({len(sparks.get(key, []))} open days)",
        )

    payloads_js = (ROOT / "clover_api" / "analytics" / "payloads.js").read_text(encoding="utf-8")
    assert_true(
        '"daily_executive_brief"' in payloads_js,
        "daily_executive_brief bundled into clover_api/analytics/payloads.js",
    )


def verify_ui_and_viz_standards() -> None:
    assert_true((ROOT / "VIZ_PLAN.md").exists(), "VIZ_PLAN.md specification exists")

    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    app_js = (ROOT / "app.js").read_text(encoding="utf-8")
    d3_js = (ROOT / "d3_charts.js").read_text(encoding="utf-8")
    style_css = (ROOT / "style.css").read_text(encoding="utf-8")

    assert_true(
        'id="daily-executive-brief-banner"' in index_html
        and 'id="btn-print-daily-brief"' in index_html
        and 'id="daily-sales-bridge-container"' in index_html,
        "Top-of-dashboard Daily Shop Brief banner, 1-Page Print button, and Sales Breakdown strip in index.html",
    )
    assert_true(
        'data-vp="1440"' in index_html
        and 'data-cb-mode="deuteranopia"' in index_html
        and 'data-cb-mode="protanopia"' in index_html,
        "1440px viewport preset and Deuteranopia/Protanopia colorblind simulation controls in index.html",
    )
    assert_true(
        "renderDailyExecutiveBrief" in app_js
        and "renderKPIBulletAndSparklines" in app_js
        and "buildSparklineSVG" in app_js
        and "okabeItoPalette" in app_js,
        "Stephen Few Bullet Bars, Tufte 7-Day Sparklines, and Okabe-Ito tokens wired in app.js",
    )
    assert_true(
        "injectMobileFaceCallouts" in d3_js and "injectMobileFaceCallouts" in app_js,
        "Mobile pre-baked Peak/Low/Current face annotations wired in d3_charts.js and app.js",
    )
    assert_true(
        ".mobile-chart-face-badges" in style_css
        and "@media print" in style_css
        and 'body[data-cb-mode="deuteranopia"]' in style_css,
        "Mobile face badge styles, >=16px mobile legibility, colorblind filters, and @media print rules in style.css",
    )

    ww_files = []
    for root_dir, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", ".venv", "node_modules")]
        for name in dirs + files:
            p = Path(root_dir) / name
            if not p.is_symlink() and (p.stat().st_mode & stat.S_IWOTH):
                ww_files.append(str(p.relative_to(ROOT)))
    assert_true(len(ww_files) == 0, f"Zero world-writable files in workspace (found {len(ww_files)})")


if __name__ == "__main__":
    print("=== RUNNING v2.1.0 EXECUTIVE BI & PLAIN-ENGLISH INSIGHT ENGINE PAL VERIFICATION ===")
    verify_daily_insight_engine()
    verify_ui_and_viz_standards()
    print("=== ALL BI & INSIGHT ENGINE PAL CHECKS PASSED (100%) ===")
