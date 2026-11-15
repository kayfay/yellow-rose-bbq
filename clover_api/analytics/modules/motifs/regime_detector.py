"""
Regime Shift Detection (CUSUM / PELT-style structural break detector).
Flags dates where daily sales baseline permanently shifted (p < 0.01).
"""
from typing import Dict, List, Sequence
import numpy as np
from scipy import stats


def detect_regime_shifts(
    dates: Sequence[str],
    values: Sequence[float],
    min_segment: int = 7,
    alpha: float = 0.01,
) -> List[Dict[str, object]]:
    """Detect statistically significant mean shifts (p < alpha) in a daily series."""
    arr = np.asarray(list(values), dtype=float)
    n = len(arr)
    if n < min_segment * 2 or len(dates) != n:
        return []

    best_idx = -1
    best_p = 1.0
    best_dir = "up"

    for idx in range(min_segment, n - min_segment + 1):
        left = arr[:idx]
        right = arr[idx:]
        if np.std(left) == 0 and np.std(right) == 0:
            if abs(np.mean(right) - np.mean(left)) > 1e-6:
                p_val = 0.0
            else:
                continue
        else:
            _, p_val = stats.ttest_ind(left, right, equal_var=False)
        if p_val < best_p:
            best_p = float(p_val)
            best_idx = idx
            best_dir = "up" if np.mean(right) > np.mean(left) else "down"

    if best_idx != -1 and best_p < alpha:
        return [
            {
                "date": str(dates[best_idx]),
                "direction": best_dir,
                "p_value": round(best_p, 6),
                "note": f"Permanent Baseline Shift ({best_dir}) detected starting {dates[best_idx]}",
            }
        ]
    return []
