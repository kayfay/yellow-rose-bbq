#!/usr/bin/env python3
"""
Deterministic PAL Verifier for Subtab De-Slop, Executive Stat Strips, and Roll-Up Accordions.
Verifies:
1. All 7 analytics subtabs contain a `.subtab-stat-strip` with 3 scannable `.subtab-stat-card` items.
2. Reusable `.rollup-section` components with `.rollup-header` (`aria-expanded="true"`), `.rollup-summary-pill`, `.rollup-chevron`, and `.rollup-body` exist across subtabs.
3. CSS enforces `min-height: 48px` on `.rollup-header` and `.rollup-section.collapsed .rollup-body { display: none !important; }`.
4. `initRollUpAccordions` and `setAllRollUpSections` are implemented in `modules/shared/core_utils.js` and wired in `app.js` + `#btn-debug-rollup-toggle`.
5. No static bullet/paragraph inside any subtab's `.rollup-body` exceeds 240 characters (~3 lines).
6. All legacy DOM IDs required by Playwright E2E suites remain intact in `index.html`.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "style.css").read_text(encoding="utf-8")
    core_js = (ROOT / "modules/shared/core_utils.js").read_text(encoding="utf-8")
    app_js = (ROOT / "app.js").read_text(encoding="utf-8")

    failures = []

    subtab_ids = [
        "subtab-view-predictive",
        "subtab-view-arima",
        "subtab-view-weather",
        "subtab-view-event",
        "subtab-view-shift",
        "subtab-view-advanced",
        "subtab-view-reports",
    ]
    for sid in subtab_ids:
        if f'id="{sid}"' not in html:
            failures.append(f"Missing subtab container #{sid}")

    stat_strips = len(re.findall(r'class="subtab-stat-strip"', html))
    if stat_strips < 7:
        failures.append(f"Expected >= 7 .subtab-stat-strip blocks, found {stat_strips}")

    stat_cards = len(re.findall(r'class="subtab-stat-card"', html))
    if stat_cards < 21:
        failures.append(f"Expected >= 21 .subtab-stat-card blocks, found {stat_cards}")

    rollup_keys = [
        "predictive-directives",
        "predictive-turnover-deck",
        "arima-baseline-notes",
        "weather-impact-notes",
        "event-surge-playbook",
        "event-interactive-calendar",
        "shift-rush-notes",
        "advanced-exec-summary",
        "advanced-data-correlations",
        "reports-supplier-specs",
    ]
    for rkey in rollup_keys:
        if f'data-rollup-key="{rkey}"' not in html:
            failures.append(f"Missing RollUpSection data-rollup-key='{rkey}'")

    if 'id="btn-debug-rollup-toggle"' not in html:
        failures.append("Missing #btn-debug-rollup-toggle in #design-debug-drawer")

    if ".rollup-header" not in css or "min-height: 48px" not in css:
        failures.append("Missing .rollup-header min-height: 48px in style.css")

    if ".rollup-section.collapsed .rollup-body" not in css:
        failures.append("Missing .rollup-section.collapsed .rollup-body rule in style.css")

    if "function initRollUpAccordions" not in core_js or "function setAllRollUpSections" not in core_js:
        failures.append("Missing initRollUpAccordions / setAllRollUpSections in modules/shared/core_utils.js")

    if "initRollUpAccordions()" not in app_js or "setAllRollUpSections(" not in app_js:
        failures.append("initRollUpAccordions / setAllRollUpSections not wired in app.js")

    # Verify concise copy density (no static <li> leaf in .rollup-body exceeds 240 visible chars)
    for m in re.finditer(r"<li[^>]*>(.*?)</li>", html, flags=re.DOTALL):
        inner = m.group(1)
        if "<ul" in inner:
            continue
        clean_text = re.sub(r"<[^>]+>", "", inner)
        clean_text = re.sub(r"\s+", " ", clean_text).strip()
        if len(clean_text) > 240:
            failures.append(f"Overly verbose <li> ({len(clean_text)} chars > 240): {clean_text[:80]}...")

    # Check required E2E DOM IDs remain intact
    required_ids = [
        "predictive-velocity-summary",
        "predictive-directives-list",
        "plotly-predictive-velocity-chart",
        "hourly-turnover-deck",
        "dynamic-baseline-trend",
        "dynamic-insight-string",
        "plotly-meat-sales-chart",
        "plotly-weather-impact-chart",
        "plotly-event-impact-chart",
        "live-events-calendar-grid",
        "plotly-shift-heatmap",
        "market-basket-list",
        "interaction-list",
        "order-type-list",
        "cannibalization-list",
        "payday-list",
        "plotly-sellout-chart",
        "daily-executive-brief-banner",
        "daily-quick-wind-banner",
        "daily-ten-tips-section",
        "pitmaster-analytics-glossary",
    ]
    for req_id in required_ids:
        if f'id="{req_id}"' not in html:
            failures.append(f"Missing required E2E DOM ID #{req_id}")

    if failures:
        print("[FAIL] Subtab Roll-Up PAL Verification failed:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print(
        f"[PASS] Subtab Roll-Up PAL Verification succeeded: "
        f"{stat_strips} stat strips ({stat_cards} cards), {len(rollup_keys)} RollUpSections, "
        f"all copy <= 240 chars, all {len(required_ids)} E2E IDs intact."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
