#!/usr/bin/env python3
"""
Deterministic PAL Verification Suite for Smokehouse UX Overhaul (v2.2.2):
1. Plain-English Smokehouse Copywriting ("De-Jargon Pass"):
   - Asserts zero occurrences of banned statistical jargon ('multimeatforecaster',
     'safety buffer', 'model evaluation', 'variance') in index.html, app.js,
     modules/*.js, and ml_insights.json.
   - Asserts presence of plain-English replacements ('Pitmaster Daily Forecast',
     'Difference from Target', 'Cook Accuracy Audit') and
     1-line '.audit-plain-takeaway' banner.
2. Practical Unit Display (`KitchenQuantityDisplay`):
   - Verifies US Foods case/cut conversion math in modules/shared/core_utils.js
     (Brisket 82 lbs/case & 5 packers, Pork 32 lbs/case & 4 butts, Pork Ribs 6 racks/case,
     Dino Ribs 12 ribs/case, Turkey 20 lbs/case & 2 breasts, Sausage 60 lbs/batch & 180 links).
   - Verifies #btn-debug-unit-mode toggle & unitDisplayMode JSON export.
3. Blank Black Space / Large Black Square Fix & Prep Cushion Status Strip:
   - Verifies #js-plotly-tester zero-size rule in style.css.
   - Verifies #prep-safety-margin-strip and status classes (.status-safe, .status-tight, .status-under).
   - Verifies embedded fallback traces for #plotly-sellout-chart and explicit Plotly heights.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def fail(msg: str) -> None:
    print(f"[PAL FAIL] {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    app_js = (ROOT / "app.js").read_text(encoding="utf-8")
    style_css = (ROOT / "style.css").read_text(encoding="utf-8")
    core_utils_js = (ROOT / "modules" / "shared" / "core_utils.js").read_text(encoding="utf-8")
    subtabs_js = (ROOT / "modules" / "forecaster" / "analytics_subtabs.js").read_text(encoding="utf-8")
    reports_js = (ROOT / "modules" / "reports" / "shop_reports.js").read_text(encoding="utf-8")
    ml_insights_raw = (ROOT / "clover_api" / "analytics" / "ml_insights.json").read_text(encoding="utf-8")

    # 1. De-Jargon Pass Audit
    banned_phrases = [
        "multimeatforecaster",
        "safety buffer",
        "model evaluation",
        "calculating variance",
        "total day variance",
        "model variance pacing",
        "+$4.00 variance",
    ]
    combined_ui_sources = {
        "index.html": index_html,
        "app.js": app_js,
        "modules/shared/core_utils.js": core_utils_js,
        "modules/reports/shop_reports.js": reports_js,
        "clover_api/analytics/ml_insights.json": ml_insights_raw,
    }
    for filename, text in combined_ui_sources.items():
        lower_text = text.lower()
        for phrase in banned_phrases:
            if phrase in lower_text:
                fail(f"Banned statistical jargon '{phrase}' found in {filename}")

    # Check that 'Variance:' badge label is replaced in app.js
    if ">Variance:<" in app_js:
        fail("Legacy '>Variance:<' label still present in app.js")

    required_plain_terms = [
        ("index.html", "End-of-Day Cook Accuracy Audit"),
        ("index.html", "Checking difference from target..."),
        ("app.js", "Difference from Target"),
        ("app.js", "Pitmaster Daily Forecast"),
        ("app.js", "Cook Accuracy Audits"),
        ("app.js", "audit-plain-takeaway"),
        ("clover_api/analytics/ml_insights.json", "difference from target"),
    ]
    for filename, term in required_plain_terms:
        src = combined_ui_sources[filename]
        if term not in src:
            fail(f"Required plain-English term '{term}' missing from {filename}")

    # 2. Practical Unit Display (`KitchenQuantityDisplay`) & Case/Cut Math Audit
    for fn_name in ["KitchenQuantityDisplay", "formatKitchenQuantity", "getUnitDisplayMode", "setUnitDisplayMode"]:
        if fn_name not in core_utils_js:
            fail(f"Missing {fn_name} in modules/shared/core_utils.js")

    # Verify US Foods Case & Cut constants in core_utils.js
    expected_specs = [
        ("lbsPerCase: 82.0", "Brisket 82 lbs/case (invoice)"),
        ("lbsPerCut: 16.4", "Brisket 16.4 lbs/packer (invoice)"),
        ("lbsPerCase: 32.0", "Pork 32 lbs/case"),
        ("lbsPerCut: 8.0", "Pork 8 lbs/butt"),
        ("racksPerCase: 6", "Pork Spare Ribs 6 racks/case"),
        ("ribsPerCase: 12", "Beef Dino Ribs 12 ribs/case"),
        ("lbsPerCase: 20.0", "Turkey Breast 20 lbs/case"),
        ("lbsPerBatch: 60.0", "Sausage 60 lbs/batch"),
    ]
    for snippet, desc in expected_specs:
        if snippet not in core_utils_js:
            fail(f"Missing US Foods unit spec {desc} ({snippet}) in modules/shared/core_utils.js")

    if 'id="btn-debug-unit-mode"' not in index_html:
        fail("Missing #btn-debug-unit-mode toggle button in index.html")
    if "unitDisplayMode:" not in app_js:
        fail("Missing unitDisplayMode in Copy Settings as JSON token export in app.js")

    # 3. Black Square / 24-Hour Velocity Gap Fix & Prep Safety Margin Strip Audit
    if "#js-plotly-tester" not in style_css:
        fail("Missing #js-plotly-tester offscreen black SVG suppression rule in style.css")
    # 2026-11-05: owner removed the cushion strip and its copy from the UI (prd 39); assert it stays gone.
    if 'id="prep-safety-margin-strip"' in index_html or "Extra Prep / Cushion" in index_html or "Extra Prep / Cushion" in app_js:
        fail("Removed cushion strip / 'Extra Prep / Cushion' copy is back in index.html or app.js")
    for status_cls in [".status-safe", ".status-tight", ".status-under"]:
        if status_cls not in style_css:
            fail(f"Missing {status_cls} color-coding rule in style.css")

    if "defaultSelloutTraces" not in subtabs_js:
        fail("Missing embedded fallback traces (defaultSelloutTraces) for #plotly-sellout-chart in analytics_subtabs.js")
    if "height: mobile ? 300 : 340" not in subtabs_js:
        fail("Missing explicit compact height on 24-hour predictive velocity chart in analytics_subtabs.js")
    if not re.search(r"\?v=2\.2\.[2-9]", index_html):
        fail("Cache-buster >= ?v=2.2.2 not applied in index.html")

    print("[PAL PASS] Smokehouse UX v2.2.2 verification passed (De-Jargon, Case/Cut Units, Black Square Fix, Prep Cushion Strip).")


if __name__ == "__main__":
    main()
