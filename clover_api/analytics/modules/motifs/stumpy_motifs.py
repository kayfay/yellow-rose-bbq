"""
Matrix Profile Motif & Anomaly Scoring (lightweight numpy fallback for STUMPY).
Discovers recurring weekly sales patterns and flags anomalous trading days.
"""
from typing import Dict, List, Sequence
import numpy as np


def compute_matrix_profile_motifs(
    values: Sequence[float],
    window: int = 7,
) -> Dict[str, object]:
    """Compute pairwise z-normalized Euclidean distances for subsequence motifs."""
    arr = np.asarray(list(values), dtype=float)
    n = len(arr)
    if n < window * 2:
        return {"motif_index": None, "discord_index": None, "profile": []}

    subseqs = []
    for i in range(n - window + 1):
        sub = arr[i : i + window]
        std = np.std(sub)
        subseqs.append((sub - np.mean(sub)) / std if std > 1e-6 else np.zeros(window))
    subseqs_arr = np.asarray(subseqs)
    m = len(subseqs_arr)
    profile = np.full(m, np.inf)

    for i in range(m):
        for j in range(m):
            if abs(i - j) < max(1, window // 2):
                continue
            dist = float(np.linalg.norm(subseqs_arr[i] - subseqs_arr[j]))
            if dist < profile[i]:
                profile[i] = dist

    finite_mask = np.isfinite(profile)
    if not np.any(finite_mask):
        return {"motif_index": None, "discord_index": None, "profile": []}

    motif_idx = int(np.argmin(np.where(finite_mask, profile, np.inf)))
    discord_idx = int(np.argmax(np.where(finite_mask, profile, -np.inf)))
    return {
        "motif_index": motif_idx,
        "discord_index": discord_idx,
        "profile": [round(float(x), 4) if np.isfinite(x) else None for x in profile],
    }
