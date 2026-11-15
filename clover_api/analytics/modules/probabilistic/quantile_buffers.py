"""
Probabilistic Quantile Prep Buffers.
Maps P10 (Slow Day Floor), P50 (Expected Cook Target), and P90 (Busy Day Ceiling)
into whole physical kitchen cuts, capping brisket buffer at +1 packer.
"""
import math
from typing import Dict, Sequence
import numpy as np


COOKED_LBS_PER_UNIT = {
    "brisket": 5.75,    # 35% of 16.4 lb raw packer
    "pork_butt": 3.52,  # 44% of 8.0 lb raw butt
    "ribs": 3.36,       # 60% of 5.6 lb raw rack
    "turkey": 3.0,      # 70% of 4.29 lb raw breast
    "sausage": 0.3333,  # 3 links per lb
}


def compute_quantile_prep_buffer(
    meat: str,
    historical_cooked_lbs: Sequence[float],
    max_brisket_buffer: int = 1,
) -> Dict[str, object]:
    """
    Compute P10/P50/P90 quantiles in whole physical cuts.
    For brisket, Extra Weekend Prep (P90 - P50) is strictly capped at +1 brisket.
    """
    arr = np.asarray(list(historical_cooked_lbs), dtype=float)
    arr = arr[arr > 0]
    lbs_per_unit = COOKED_LBS_PER_UNIT.get(meat, 5.75)

    if len(arr) == 0:
        return {
            "meat": meat,
            "p10_cuts": 0,
            "p50_cuts": 0,
            "p90_cuts": 0,
            "extra_weekend_prep": 0,
        }

    p10_lbs, p50_lbs, p90_lbs = np.percentile(arr, [10, 50, 90])
    p10_cuts = max(1, int(math.floor(p10_lbs / lbs_per_unit)))
    p50_cuts = max(1, int(round(p50_lbs / lbs_per_unit)))
    raw_p90_cuts = max(p50_cuts, int(math.ceil(p90_lbs / lbs_per_unit)))

    extra = max(0, raw_p90_cuts - p50_cuts)
    if meat == "brisket":
        extra = min(extra, max_brisket_buffer)

    p90_cuts = p50_cuts + extra
    return {
        "meat": meat,
        "p10_cuts": p10_cuts,
        "p50_cuts": p50_cuts,
        "p90_cuts": p90_cuts,
        "extra_weekend_prep": extra,
    }
