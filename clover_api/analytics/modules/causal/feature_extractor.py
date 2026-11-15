"""
Rolling & Multivariate Feature Extractor (lightweight tsflex/ECOD-style outlier masking).
"""
from typing import Dict, List, Sequence
import numpy as np


def extract_rolling_features(values: Sequence[float], window: int = 7) -> Dict[str, object]:
    """Extract rolling median, robust IQR, and outlier mask."""
    arr = np.asarray(list(values), dtype=float)
    if len(arr) == 0:
        return {"rolling_median": 0.0, "outlier_mask": []}

    q25, med, q75 = np.percentile(arr, [25, 50, 75])
    iqr = max(1e-6, q75 - q25)
    upper = q75 + 1.5 * iqr
    lower = max(0.0, q25 - 1.5 * iqr)
    mask: List[bool] = [bool(x > upper or x < lower) for x in arr]
    tail = arr[-window:] if len(arr) >= window else arr
    return {
        "rolling_median": round(float(np.median(tail)), 2),
        "outlier_mask": mask,
    }
