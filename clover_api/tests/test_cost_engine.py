import unittest
from pathlib import Path

from clover_api.analytics.cost_engine import (
    build_daily_full_cogs_record,
    calculate_line_item_bom_cost,
    classify_pacing_band,
    load_recipe_bom,
    reconcile_vendor_unit_costs,
)


class TestCostEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bom = load_recipe_bom()

    def test_line_item_bom_math_parity(self):
        res = calculate_line_item_bom_cost("brisket_sandwich", 10, self.bom)
        self.assertGreater(res["meat_cost"], 0.0)
        self.assertAlmostEqual(
            res["non_meat_cost"],
            round(res["bakery_cost"] + res["sides_cost"] + res["packaging_cost"], 2),
            places=2,
        )
        self.assertAlmostEqual(
            res["total_cogs"],
            round(res["meat_cost"] + res["non_meat_cost"], 2),
            places=2,
        )
        self.assertGreaterEqual(res["total_cogs"], res["meat_cost"])

    def test_daily_record_parity_and_monotonicity(self):
        rec = build_daily_full_cogs_record(
            date_str="2026-11-18",
            day_name="Wed",
            gross_revenue=10000.0,
            meat_cost=2650.0,
            est_orders=200.0,
            bom=self.bom,
            is_closed=False,
        )
        self.assertEqual(rec["status"], "ok")
        self.assertAlmostEqual(
            rec["non_meat_cost"],
            round(rec["bakery_cost"] + rec["sides_cost"] + rec["packaging_cost"], 2),
            places=2,
        )
        self.assertAlmostEqual(
            rec["total_cogs"],
            round(rec["meat_cost"] + rec["non_meat_cost"], 2),
            places=2,
        )
        self.assertGreaterEqual(rec["cogs_pct"], rec["meat_cost_pct"])
        self.assertEqual(rec["pacing_band"], "amber")

    def test_closed_day_guard(self):
        rec = build_daily_full_cogs_record(
            date_str="2026-11-16",
            day_name="Mon",
            gross_revenue=0.0,
            meat_cost=0.0,
            est_orders=0.0,
            bom=self.bom,
            is_closed=True,
        )
        self.assertEqual(rec["status"], "closed")
        self.assertIsNone(rec["cogs_pct"])
        self.assertEqual(rec["pacing_label"], "$0 (Closed)")

    def test_zero_revenue_pending_guard(self):
        rec = build_daily_full_cogs_record(
            date_str="2026-11-19",
            day_name="Thu",
            gross_revenue=0.0,
            meat_cost=0.0,
            est_orders=0.0,
            bom=self.bom,
            is_closed=False,
        )
        self.assertEqual(rec["status"], "pending")
        self.assertIsNone(rec["cogs_pct"])
        self.assertEqual(rec["pacing_label"], "Pending Service")

    def test_pacing_band_thresholds(self):
        bands = {"green_max_pct": 32.0, "amber_max_pct": 36.0}
        self.assertEqual(classify_pacing_band(29.5, bands)[0], "green")
        self.assertEqual(classify_pacing_band(34.0, bands)[0], "amber")
        self.assertEqual(classify_pacing_band(37.5, bands)[0], "red")
        self.assertEqual(classify_pacing_band(None, bands)[0], "pending")

    def test_missing_invoices_dir_degrades_gracefully(self):
        costs = reconcile_vendor_unit_costs(self.bom, invoices_dir=Path("/nonexistent/invoices"))
        self.assertIn("brisket", costs)
        self.assertGreater(costs["brisket"], 0.0)


if __name__ == "__main__":
    unittest.main()
