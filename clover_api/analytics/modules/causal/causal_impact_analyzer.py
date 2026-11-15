"""
Lightweight CausalImpact Analyzer.
Compares actual POS revenue against a synthetic counterfactual baseline
and reports Estimated Dollar Lift / Drop in plain English.
"""
from typing import Dict, Sequence
import numpy as np


def estimate_causal_impact(
    event_name: str,
    pre_period_sales: Sequence[float],
    post_period_sales: Sequence[float],
) -> Dict[str, object]:
    """Estimate causal lift/drop of an event against pre-period counterfactual."""
    pre = np.asarray(list(pre_period_sales), dtype=float)
    post = np.asarray(list(post_period_sales), dtype=float)
    if len(pre) == 0 or len(post) == 0:
        return {
            "event": event_name,
            "actual_usd": 0.0,
            "counterfactual_usd": 0.0,
            "lift_usd": 0.0,
            "summary_text": f"{event_name}: Not enough sales history to estimate impact.",
        }

    counterfactual_per_day = float(np.median(pre))
    actual_usd = round(float(np.sum(post)), 2)
    counterfactual_usd = round(counterfactual_per_day * len(post), 2)
    lift_usd = round(actual_usd - counterfactual_usd, 2)
    direction = "Lift" if lift_usd >= 0 else "Drop"
    sign = "+" if lift_usd >= 0 else "-"
    return {
        "event": event_name,
        "actual_usd": actual_usd,
        "counterfactual_usd": counterfactual_usd,
        "lift_usd": lift_usd,
        "summary_text": f"{event_name}: Estimated Dollar {direction} of {sign}${abs(lift_usd):,.0f} vs. typical baseline.",
    }
