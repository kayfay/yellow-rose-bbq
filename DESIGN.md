# Time-Series Intelligence Suite Design (`DESIGN.md`)

## 1. 2D Modular Architecture Blueprint

```
clover_sales.db
   │
   ▼
[1. Multivariate Outlier Masking] (numpy/scipy ECOD-style tail scoring)
   │
   ▼
[2. Feature Extraction & MSTL] (statsmodels MSTL 24h + 7d seasonality)
   │
   ▼
[3. Hierarchical MinTrace Reconciliation] (clover_api/analytics/modules/hierarchical/)
   │   Store Revenue ──▶ Category (Brisket, Pork, Ribs, Turkey, Sausage, Sides) ──▶ Cut/Item
   ▼
[4. Probabilistic Quantile Engine] (clover_api/analytics/modules/probabilistic/)
   │   P10 (Slow Floor) / P50 (Expected) / P90 (Busy Ceiling, +1 brisket cap)
   ▼
[5. Regime & Causal Engines] (modules/motifs/ & modules/causal/)
   │   PELT/CUSUM Regime Shifts + Matrix Profile Motifs + Synthetic Counterfactuals
   ▼
[6. Smokehouse Plain-English Translator] (modules/smokehouse_translator.py)
   │   Zero statistical jargon; whole Briskets, Butts, Racks, Breasts, Links
   ▼
predictive_cache.json / payloads.js
```

## 2. Modular Directory Structure (`clover_api/analytics/modules/`)
- `clover_api/analytics/modules/__init__.py`
- `clover_api/analytics/modules/hierarchical/`
  - `__init__.py`
  - `hierarchical_forecast.py` (3-level MSTL + seasonal forecast)
  - `reconciler.py` (MinTrace shrinkage reconciliation: $S (S^T W^{-1} S)^{-1} S^T W^{-1} \hat{y}$)
- `clover_api/analytics/modules/probabilistic/`
  - `__init__.py`
  - `quantile_buffers.py` (P10/P50/P90 quantile estimation + `+1 brisket` cap)
  - `darts_pipeline.py` (Quantile wrapper with `darts` optional hook & `scipy`/`numpy` fallback)
- `clover_api/analytics/modules/motifs/`
  - `__init__.py`
  - `regime_detector.py` (PELT/CUSUM structural break detection with `ruptures` optional hook)
  - `stumpy_motifs.py` (Matrix profile motif/anomaly scoring with `stumpy` optional hook)
- `clover_api/analytics/modules/causal/`
  - `__init__.py`
  - `causal_impact_analyzer.py` (Synthetic counterfactual lift/drop estimator)
  - `feature_extractor.py` (Rolling & MSTL feature extraction)
- `clover_api/analytics/modules/smokehouse_translator.py` (Plain-English & whole-cut formatter + jargon quarantine)

## 3. Data Contracts
- **Reconciled Forecast:** `{"store_total": float, "categories": dict[str, float], "items": dict[str, float], "coherence_error": float}`
- **Quantile Prep:** `{"meat": str, "p10_cuts": int, "p50_cuts": int, "p90_cuts": int, "extra_weekend_prep": int, "summary_text": str}`
- **Regime Shift:** `{"date": str, "direction": "up"|"down", "p_value": float, "note": str}`
- **Causal Impact:** `{"event": str, "actual_usd": float, "counterfactual_usd": float, "lift_usd": float, "summary_text": str}`
