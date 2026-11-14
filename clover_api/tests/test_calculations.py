import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from clover_api.analytics.food_cost_engine import batch_meat_cost, meat_cost_pct

RAW = {
    "raw_beef_brisket_per_lb": 5.0,
    "raw_pork_butt_per_lb": 2.0,
    "raw_turkey_breast_per_lb": 4.0,
    "raw_pork_sparerib_per_lb": 3.0,
}


class TestMeatCostFormula(unittest.TestCase):
    def test_batch_cost_is_sum_of_raw_lbs_times_price(self):
        # 100 lb brisket $500 + 50 lb pork $100 + 10 lb turkey $40
        # + 30 lb sausage = 90 links x $1.25 = $112.50 + 4 racks x 5.6 lb x $3 = $67.20 + 2 dino x $14.50 = $29
        cost = batch_meat_cost(100, 50, 10, 30, 4, 2, raw_costs=RAW)
        self.assertEqual(cost, 848.70)

    def test_pct_uses_cost_over_revenue(self):
        self.assertEqual(meat_cost_pct(848.70, 3000.0), 28.3)
        self.assertEqual(meat_cost_pct(500.0, 2000.0), 25.0)

    def test_pct_changes_with_inputs_never_constant_29_5(self):
        values = {meat_cost_pct(c, 3000.0) for c in (300, 600, 900)}
        self.assertEqual(len(values), 3)
        self.assertNotIn(29.5, values)

    def test_closed_day_has_no_pct(self):
        self.assertIsNone(meat_cost_pct(0.0, 0.0))
        self.assertIsNone(meat_cost_pct(100.0, 0))
        self.assertIsNone(meat_cost_pct(100.0, None))
        self.assertEqual(batch_meat_cost(raw_costs=RAW), 0.0)


if __name__ == "__main__":
    unittest.main()


import re

from clover_api.analytics.unit_conversions import UNIT_CONVERSIONS, units_for_raw_lbs


class TestUnitConversions(unittest.TestCase):
    def test_cooked_lbs_per_unit_is_raw_times_yield(self):
        self.assertAlmostEqual(UNIT_CONVERSIONS["brisket"]["lbs_per_unit"], 5.74, places=2)
        self.assertEqual(UNIT_CONVERSIONS["brisket"]["owner_reported_cooked_lbs_per_unit"], 5.75)
        self.assertAlmostEqual(UNIT_CONVERSIONS["pork_butt"]["lbs_per_unit"], 3.52, places=2)
        self.assertAlmostEqual(UNIT_CONVERSIONS["ribs"]["lbs_per_unit"], 3.36, places=2)
        self.assertAlmostEqual(UNIT_CONVERSIONS["sausage"]["lbs_per_unit"], 0.33, places=2)
        self.assertAlmostEqual(UNIT_CONVERSIONS["turkey"]["lbs_per_unit"], 3.0, places=1)
        self.assertEqual(UNIT_CONVERSIONS["turkey"]["owner_reported_cooked_lbs_per_unit"], 3.0)

    def test_case_weights_match_invoice(self):
        self.assertEqual(UNIT_CONVERSIONS["brisket"]["lbs_per_case"], 82.0)   # 3 cs = $1,257.15 / $5.10
        self.assertEqual(UNIT_CONVERSIONS["ribs"]["lbs_per_case"], 33.6)      # 5 cs = $402.72 / $2.40
        self.assertEqual(UNIT_CONVERSIONS["turkey"]["lbs_per_case"], 20.0)

    def test_pieces_round_up(self):
        self.assertEqual(units_for_raw_lbs("brisket", 140), 9)
        self.assertEqual(units_for_raw_lbs("brisket", 16.4), 1)
        self.assertEqual(units_for_raw_lbs("brisket", 16.5), 2)
        self.assertEqual(units_for_raw_lbs("turkey", 4.29), 1)
        self.assertEqual(units_for_raw_lbs("turkey", 8.58), 2)
        self.assertEqual(units_for_raw_lbs("turkey", 8.6), 3)

    def test_js_kitchen_specs_match_python_dictionary(self):
        js = (ROOT_DIR / "modules" / "shared" / "core_utils.js").read_text()

        def spec_block(key):
            start = js.index(f"    {key}: {{")
            return js[start:js.index("\n    },", start)]

        def num(block, field):
            return float(re.search(rf"{field}:\s*([0-9.]+)", block).group(1))

        brisket = spec_block("brisket")
        self.assertEqual(num(brisket, "lbsPerCase"), UNIT_CONVERSIONS["brisket"]["lbs_per_case"])
        self.assertEqual(num(brisket, "lbsPerCut"), UNIT_CONVERSIONS["brisket"]["raw_lbs_per_unit"])
        self.assertEqual(num(brisket, "yieldRatio"), UNIT_CONVERSIONS["brisket"]["cook_yield"])
        ribs = spec_block("pork_ribs")
        self.assertEqual(num(ribs, "lbsPerRack"), UNIT_CONVERSIONS["ribs"]["raw_lbs_per_unit"])
        self.assertEqual(num(ribs, "lbsPerCase"), UNIT_CONVERSIONS["ribs"]["lbs_per_case"])
        pork = spec_block("pork")
        self.assertEqual(num(pork, "lbsPerCase"), UNIT_CONVERSIONS["pork_butt"]["lbs_per_case"])
        self.assertEqual(num(pork, "lbsPerCut"), UNIT_CONVERSIONS["pork_butt"]["raw_lbs_per_unit"])
        self.assertEqual(num(pork, "yieldRatio"), UNIT_CONVERSIONS["pork_butt"]["cook_yield"])
        turkey = spec_block("turkey")
        self.assertEqual(num(turkey, "lbsPerCase"), UNIT_CONVERSIONS["turkey"]["lbs_per_case"])
        self.assertEqual(num(turkey, "lbsPerCut"), UNIT_CONVERSIONS["turkey"]["raw_lbs_per_unit"])
        self.assertEqual(num(turkey, "yieldRatio"), UNIT_CONVERSIONS["turkey"]["cook_yield"])


import json

from clover_api.analytics.hourly_feature_engineering import build_feature_engineered_dataset


class TestHourlyForecastScale(unittest.TestCase):
    def test_hourly_revenue_matches_real_pos_history(self):
        path = ROOT_DIR / "clover_api" / "analytics" / "hourly_actuals.json"
        if not path.exists():
            self.skipTest("hourly_actuals.json not generated")
        base = json.loads(path.read_text())["weekday_baseline"]
        rows = build_feature_engineered_dataset()
        checked = 0
        for d in range(1, 7):  # Tue-Sun
            b = base.get(str(d))
            if not b or b.get("n", 0) == 0:
                continue
            real_day = sum(b["sales_sum"]) / b["n"]
            model_day = sum(r["est_revenue_usd"] for r in rows if r["day_of_week"] == d)
            self.assertAlmostEqual(model_day, real_day, delta=real_day * 0.02, msg=f"weekday {d}")
            checked += 1
        self.assertGreaterEqual(checked, 1)

    def test_monday_stays_closed(self):
        rows = build_feature_engineered_dataset()
        self.assertEqual(sum(r["est_revenue_usd"] for r in rows if r["day_of_week"] == 0), 0.0)


class TestJsFallbackParity(unittest.TestCase):
    """Literal fallbacks in app.js / d3_charts.js must equal the dictionary (they only apply if the shared spec fails to load)."""

    def test_fallback_literals_match_dictionary(self):
        app = (ROOT_DIR / "app.js").read_text()
        d3 = (ROOT_DIR / "d3_charts.js").read_text()
        self.assertIn(f"|| {UNIT_CONVERSIONS['brisket']['lbs_per_case']}", app)
        self.assertIn(f"|| {UNIT_CONVERSIONS['brisket']['raw_lbs_per_unit']}", app)
        self.assertIn(f"|| {UNIT_CONVERSIONS['ribs']['raw_lbs_per_unit']}", app)
        self.assertIn(f"|| {UNIT_CONVERSIONS['ribs']['raw_lbs_per_unit']}", d3)


class TestSupplierSpecText(unittest.TestCase):
    def test_supplier_list_matches_dictionary(self):
        html = (ROOT_DIR / "index.html").read_text()
        b = UNIT_CONVERSIONS["brisket"]
        r = UNIT_CONVERSIONS["ribs"]
        self.assertIn(f"{b['units_per_case']} packers/case (~{b['lbs_per_case']:g} lbs raw, ~{b['raw_lbs_per_unit']:g} lbs each", html)
        self.assertIn(f"{r['units_per_case']} racks/case (~{round(r['lbs_per_case'])} lbs raw at {r['raw_lbs_per_unit']:g} lbs/rack", html)


from clover_api.analytics.event_multipliers import applied_multiplier, measure_multipliers


class TestEventMultipliers(unittest.TestCase):
    # 2026-09-05, 12, 19, 26, 10-03 are Saturdays; 09-13, 09-20 are Sundays.
    NORMAL_SATS = ["2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22", "2026-08-29"]

    def _daily(self, event_sats, event_rev):
        daily = {d: 4000.0 for d in self.NORMAL_SATS}
        daily.update({d: event_rev for d in event_sats})
        return daily

    def test_weekday_matched_multiplier(self):
        events = ["2026-09-05", "2026-09-12", "2026-09-19"]
        m = measure_multipliers(self._daily(events, 8000.0), {"jaguars": events})
        self.assertEqual(m["jaguars"]["multiplier"], 2.0)
        self.assertEqual(m["jaguars"]["days"], 3)

    def test_busy_weekend_is_not_mistaken_for_an_event_effect(self):
        # Saturdays are busy; an event Saturday that sells the same as a normal Saturday is 1.0x, not "+X%".
        events = ["2026-09-05", "2026-09-12", "2026-09-19"]
        m = measure_multipliers(self._daily(events, 4000.0), {"jaguars": events})
        self.assertEqual(m["jaguars"]["multiplier"], 1.0)

    def test_too_few_event_days_gives_none(self):
        events = ["2026-09-05", "2026-09-12"]
        m = measure_multipliers(self._daily(events, 8000.0), {"holiday": events})
        self.assertIsNone(m["holiday"]["multiplier"])

    def test_partial_or_closed_days_are_skipped(self):
        events = ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"]
        daily = self._daily(events[:3], 8000.0)
        daily[events[3]] = 666.0  # closed / partial day must not drag the result down
        m = measure_multipliers(daily, {"jaguars": events})
        self.assertEqual(m["jaguars"]["days"], 3)
        self.assertEqual(m["jaguars"]["multiplier"], 2.0)

    def test_noise_band(self):
        self.assertEqual(applied_multiplier(1.09), 1.0)
        self.assertEqual(applied_multiplier(0.92), 1.0)
        self.assertEqual(applied_multiplier(None), 1.0)
        self.assertEqual(applied_multiplier(1.6), 1.6)
        self.assertEqual(applied_multiplier(0.6), 0.6)


class TestCalendarMultipliers(unittest.TestCase):
    def test_calendar_multipliers_are_measured_not_typed(self):
        cal = json.loads((ROOT_DIR / "clover_api" / "analytics" / "calendar_events.json").read_text())
        for e in cal:
            self.assertIn("multiplier_basis", e, e["title"])
            self.assertEqual(e["multiplier"], applied_multiplier(e.get("measured_multiplier")) if e["category"] != "operational" else 1.0, e["title"])
            self.assertIsNone(re.search(r"\d(\.\d)?x\b", e["note"], re.I), f"{e['title']}: multiplier claim in note")

    def test_calendar_text_makes_no_unmeasured_demand_claims(self):
        cal = json.loads((ROOT_DIR / "clover_api" / "analytics" / "calendar_events.json").read_text())
        claim = re.compile(r"surge|high[- ]demand|massive|extremely|strong |rush|bump|volume|maximum|double|largest|expedite|hold brisket", re.I)
        for e in cal:
            self.assertIsNone(claim.search(e["title"] + " " + e["note"]), f"{e['title']}: demand claim not backed by measured data")

    def test_js_has_no_invented_event_multipliers(self):
        js = (ROOT_DIR / "modules" / "shared" / "core_utils.js").read_text()
        self.assertNotIn("multiplier: 3.5", js)
        self.assertNotIn("|| 3.5", js)
        self.assertNotIn("|| 0.7", js)
