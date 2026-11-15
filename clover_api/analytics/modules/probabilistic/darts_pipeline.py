"""
Darts Quantile Pipeline wrapper with lightweight numpy/scipy fallback.
"""
from typing import Dict, Sequence
from .quantile_buffers import compute_quantile_prep_buffer


class DartsQuantilePipeline:
    """Produces P10/P50/P90 whole-cut prep buffers for all smokehouse proteins."""

    def __init__(self, max_brisket_buffer: int = 1):
        self.max_brisket_buffer = max_brisket_buffer

    def forecast_quantiles(self, meat: str, historical_cooked_lbs: Sequence[float]) -> Dict[str, object]:
        return compute_quantile_prep_buffer(
            meat=meat,
            historical_cooked_lbs=historical_cooked_lbs,
            max_brisket_buffer=self.max_brisket_buffer,
        )
