import re
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

# Wording the owner asked to remove from everything the browser can render.
BANNED = [
    r"plain[- ]english", r"extra prep", r"cushion", r"shift directive", r"labor",
    r"lbs actual", r"actual\b[^.\n]{0,40}\bsold", r"\bactual to\b", r"hourly sales pace",
    # superseded invoice-based weights (brisket 16.4 lb / 82 lb case, rib 5.6 lb / 33.6 lb case)
    r"~70 lbs", r"\b70 lbs raw", r"at 5 lbs/rack", r"\(5 lbs/rack\)", r"~30 lbs raw",
    # typed-in demand numbers that disagreed with the payloads, and the old 35/15 70:30 sausage blend
    r"peak saturday surge", r"high friday run", r"heavy rain \(31", r"stadium game day",
    r"97\.37", r"17\.4k", r"17\.3k", r"13\.8k", r"\b3\.5x\b", r"5\.8%", r"\(-37%\)", r"2,330", r"70:30",
]
FILES = ["index.html", "app.js", "d3_charts.js", "modules/forecaster/analytics_subtabs.js",
         "modules/reports/shop_reports.js", "modules/recipes/sausage_calc.js", "modules/shared/core_utils.js"]


def rendered_lines(path):
    in_block = False
    for n, line in enumerate((ROOT_DIR / path).read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if path.endswith(".html"):
            if "<!--" in stripped:
                continue
        else:
            if in_block:
                if "*/" in stripped:
                    in_block = False
                continue
            if stripped.startswith("/*"):
                in_block = "*/" not in stripped
                continue
            if stripped.startswith(("//", "*")):
                continue
            line = re.sub(r"\s//\s.*$", "", line)  # trailing comment
        yield n, line


class TestCopyAudit(unittest.TestCase):
    def test_no_banned_copy_in_rendered_source(self):
        hits = []
        for path in FILES:
            for n, line in rendered_lines(path):
                # dead locals (totalLaborHours, totalStaff) are not rendered
                if re.search(r"\b(let|const)\b.*Labor|Labor\w*\s*[+=]", line):
                    continue
                for pat in BANNED:
                    if re.search(pat, line, re.IGNORECASE):
                        hits.append(f"{path}:{n} [{pat}] {line.strip()[:90]}")
        self.assertEqual(hits, [], "\n".join(hits))


if __name__ == "__main__":
    unittest.main()


class TestRenderedPayloadText(unittest.TestCase):
    """Generated JSON that the pages render must not carry superseded numbers or banned labels."""

    PAYLOADS = ["ml_insights.json", "quick_wind_alerts.json", "daily_executive_brief.json", "shift_payload.json"]
    STALE = [r"14\.0 lbs raw", r"\b336 lbs", r"134(\.4)? lbs cooked", r"29\.5%", r"labor optimization", r"plain[- ]english", r"97\.37", r"70:30", r"\b3\.5x\b"]

    def test_generated_payload_text(self):
        hits = []
        for name in self.PAYLOADS:
            path = ROOT_DIR / "clover_api" / "analytics" / name
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8")
            for pat in self.STALE:
                if re.search(pat, text, re.IGNORECASE):
                    hits.append(f"{name} [{pat}]")
        self.assertEqual(hits, [], "stale text in generated payloads (regenerate with the producing script): " + ", ".join(hits))
