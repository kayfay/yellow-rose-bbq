# Time-Series Intelligence Suite Plan (`PLAN.md`)

## Milestones & Verification Tasks

### Task 1: Baseline Archive & Environment Verification
- **Action:** Archive workspace to `backups/archive_pre_ts_improvements_20261115.tar.gz` (completed) and verify `.venv` dependencies (`numpy`, `scipy`, `statsmodels`, `scikit-learn`, `xgboost`).
- **Verification:** Confirm archive exists and `.venv/bin/python` imports core numerical libraries cleanly.

### Task 2: Hierarchical Coherence (`modules/hierarchical/`)
- **Action:** Implement `reconciler.py` (MinTrace shrinkage reconciliation across `Store -> Category -> Cut/Item`) and `hierarchical_forecast.py` (MSTL 24h/7d decomposition + seasonal forecast).
- **Verification:** Assert $\sum \text{Items} = \sum \text{Categories} = \text{Store Total}$ within `0.01` tolerance.

### Task 3: Probabilistic Quantile Buffers (`modules/probabilistic/`)
- **Action:** Implement `quantile_buffers.py` and `darts_pipeline.py` to compute P10/P50/P90 and map `P90 - P50` into whole kitchen cuts (`+1 brisket` cap).
- **Verification:** Unit tests verify whole-cut outputs and `+1 brisket` cap.

### Task 4: Regime Shifts, Motifs & Causal Impact (`modules/motifs/`, `modules/causal/`)
- **Action:** Implement `regime_detector.py`, `stumpy_motifs.py`, `causal_impact_analyzer.py`, and `feature_extractor.py` using lightweight `numpy`/`scipy`/`statsmodels` engines with optional library hooks.
- **Verification:** Unit tests verify regime shift detection on synthetic step changes and counterfactual lift/drop calculation.

### Task 5: Smokehouse Plain-English Translator & Full Verification
- **Action:** Implement `smokehouse_translator.py` with jargon quarantine, add comprehensive unit tests in `clover_api/tests/test_ts_improvements.py`, and run all deterministic verifiers (`npm run check`, `unittest`, `verify_*`, `npm test`).
- **Verification:** 100% pass rate on all unit tests, copy/jargon audits, and Playwright E2E; Adversarial Critic score ≥ 9/10.
