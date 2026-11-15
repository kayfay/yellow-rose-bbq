"""
Hierarchical Multi-Seasonal Forecaster (MSTL 24h + 7d decomposition + MinTrace).
Uses statsmodels MSTL when series length >= 14, with fast seasonal-median fallback.
"""
from typing import Dict, List
import numpy as np
from statsmodels.tsa.seasonal import MSTL
from .reconciler import MinTraceReconciler, DEFAULT_HIERARCHY


class HierarchicalForecaster:
    """Produces coherent 3-level forecasts across Store -> Category -> Item."""

    def __init__(self, hierarchy: Dict[str, List[str]] | None = None):
        self.reconciler = MinTraceReconciler(hierarchy or DEFAULT_HIERARCHY)

    @staticmethod
    def decompose_mstl(series: List[float], periods: tuple[int, ...] = (7,)) -> Dict[str, List[float]]:
        """Decompose a daily series into trend, seasonal, and residual components."""
        arr = np.asarray(series, dtype=float)
        if len(arr) < max(periods) * 2:
            trend = np.full_like(arr, float(np.median(arr)) if len(arr) else 0.0)
            return {
                "trend": trend.tolist(),
                "seasonal": (arr - trend).tolist(),
                "resid": np.zeros_like(arr).tolist(),
            }
        res = MSTL(arr, periods=periods).fit()
        return {
            "trend": res.trend.tolist(),
            "seasonal": res.seasonal.tolist(),
            "resid": res.resid.tolist(),
        }

    def forecast_day(
        self,
        store_base: float,
        category_base: Dict[str, float],
        item_base: Dict[str, float],
    ) -> Dict[str, object]:
        """Reconcile a single day's 3-level base forecasts."""
        return self.reconciler.reconcile(store_base, category_base, item_base)
