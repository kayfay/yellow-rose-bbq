"""Structural regime shift and motif detection."""
from .regime_detector import detect_regime_shifts
from .stumpy_motifs import compute_matrix_profile_motifs

__all__ = ["detect_regime_shifts", "compute_matrix_profile_motifs"]
