"""
MinTrace (Minimum Trace / Shrinkage) Hierarchical Reconciliation.
Ensures 3-level coherence: Store Revenue == sum(Categories) == sum(Items).
"""
from typing import Dict, List
import numpy as np


DEFAULT_HIERARCHY: Dict[str, List[str]] = {
    "Brisket": ["Sliced Brisket", "Chopped Brisket"],
    "Pork": ["Pulled Pork"],
    "Ribs": ["Spare Ribs", "Beef Dino Ribs"],
    "Turkey": ["Smoked Turkey Breast"],
    "Sausage": ["House Sausage"],
    "Sides": ["Sides & Fixins"],
}


class MinTraceReconciler:
    """Reconciles base forecasts across Store -> Category -> Item using MinTrace OLS/WLS."""

    def __init__(self, hierarchy: Dict[str, List[str]] | None = None):
        self.hierarchy = hierarchy or DEFAULT_HIERARCHY
        self.categories = list(self.hierarchy.keys())
        self.items = [item for cat in self.categories for item in self.hierarchy[cat]]

    def build_summing_matrix(self) -> np.ndarray:
        """Build summing matrix S mapping bottom-level items to [Store, Categories..., Items...]."""
        n_items = len(self.items)
        n_cats = len(self.categories)
        S = np.zeros((1 + n_cats + n_items, n_items), dtype=float)
        S[0, :] = 1.0  # Store total
        col = 0
        for r_idx, cat in enumerate(self.categories):
            k = len(self.hierarchy[cat])
            S[1 + r_idx, col : col + k] = 1.0
            for j in range(k):
                S[1 + n_cats + col + j, col + j] = 1.0
            col += k
        return S

    def reconcile(
        self,
        store_base: float,
        category_base: Dict[str, float],
        item_base: Dict[str, float],
        weights: np.ndarray | None = None,
    ) -> Dict[str, object]:
        """
        Compute MinTrace reconciled forecasts:
            y_tilde = S (S^T W^-1 S)^-1 S^T W^-1 y_hat
        """
        S = self.build_summing_matrix()
        y_hat = np.array(
            [float(store_base)]
            + [float(category_base.get(c, 0.0)) for c in self.categories]
            + [float(item_base.get(i, 0.0)) for i in self.items],
            dtype=float,
        )
        m = len(y_hat)
        W_inv = np.eye(m, dtype=float) if weights is None else np.diag(1.0 / np.maximum(weights, 1e-6))
        G = np.linalg.pinv(S.T @ W_inv @ S) @ (S.T @ W_inv)
        y_tilde = np.maximum(0.0, S @ (G @ y_hat))

        # Re-sum bottom-up after non-negativity clamp to guarantee exact 0.00 coherence
        n_cats = len(self.categories)
        items_out = {item: round(float(y_tilde[1 + n_cats + idx]), 2) for idx, item in enumerate(self.items)}
        cats_out = {
            cat: round(sum(items_out[it] for it in self.hierarchy[cat]), 2)
            for cat in self.categories
        }
        store_out = round(sum(cats_out.values()), 2)
        coherence_error = round(abs(store_out - sum(items_out.values())), 4)
        return {
            "store_total": store_out,
            "categories": cats_out,
            "items": items_out,
            "coherence_error": coherence_error,
        }
