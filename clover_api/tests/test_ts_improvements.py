import unittest
from clover_api.analytics.modules.hierarchical import MinTraceReconciler, HierarchicalForecaster
from clover_api.analytics.modules.probabilistic import DartsQuantilePipeline
from clover_api.analytics.modules.motifs import detect_regime_shifts, compute_matrix_profile_motifs
from clover_api.analytics.modules.causal import estimate_causal_impact, extract_rolling_features
from clover_api.analytics.modules.smokehouse_translator import (
    contains_banned_jargon,
    format_quantile_prep_summary,
)


class TestTSImprovements(unittest.TestCase):
    def test_mintrace_hierarchy_coherence(self):
        rec = MinTraceReconciler()
        out = rec.reconcile(
            store_base=5000.0,
            category_base={"Brisket": 1800.0, "Pork": 900.0, "Ribs": 800.0, "Turkey": 500.0, "Sausage": 400.0, "Sides": 600.0},
            item_base={
                "Sliced Brisket": 1500.0,
                "Chopped Brisket": 350.0,
                "Pulled Pork": 920.0,
                "Spare Ribs": 600.0,
                "Beef Dino Ribs": 210.0,
                "Smoked Turkey Breast": 510.0,
                "House Sausage": 390.0,
                "Sides & Fixins": 610.0,
            },
        )
        self.assertLessEqual(out["coherence_error"], 0.01)
        self.assertAlmostEqual(out["store_total"], sum(out["categories"].values()), places=2)
        self.assertAlmostEqual(out["store_total"], sum(out["items"].values()), places=2)

    def test_quantile_buffer_brisket_cap(self):
        pipe = DartsQuantilePipeline(max_brisket_buffer=1)
        res = pipe.forecast_quantiles("brisket", [57.5, 63.25, 63.25, 63.25, 86.25, 92.0])
        self.assertLessEqual(res["extra_weekend_prep"], 1)
        summary = format_quantile_prep_summary(res)
        self.assertFalse(contains_banned_jargon(summary))
        self.assertIn("Brisket", summary)

    def test_regime_shift_and_motifs(self):
        dates = [f"2026-10-{i+1:02d}" for i in range(20)]
        vals = [3000.0] * 10 + [4500.0] * 10
        shifts = detect_regime_shifts(dates, vals, min_segment=7, alpha=0.01)
        self.assertEqual(len(shifts), 1)
        self.assertEqual(shifts[0]["direction"], "up")

        motifs = compute_matrix_profile_motifs([10, 20, 30, 40, 10, 20, 30, 40, 10, 20, 30, 40, 10, 20], window=4)
        self.assertIsNotNone(motifs["motif_index"])

    def test_causal_impact_and_jargon_quarantine(self):
        res = estimate_causal_impact("Jaguars Home Game", [3500.0, 3600.0, 3550.0], [4200.0])
        self.assertGreater(res["lift_usd"], 0)
        self.assertFalse(contains_banned_jargon(res["summary_text"]))

        feats = extract_rolling_features([100.0, 105.0, 102.0, 98.0, 500.0])
        self.assertTrue(feats["outlier_mask"][-1])


if __name__ == "__main__":
    unittest.main()
