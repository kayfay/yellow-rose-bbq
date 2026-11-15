# Time-Series Intelligence Suite Specification (`SPEC.md`)

## 1. Overview
This specification defines the modular time-series intelligence suite under `clover_api/analytics/modules/` for **Yellow Rose BBQ** (`sausage.allen.tools`), integrating hierarchical coherence, probabilistic quantile prep buffers, structural regime/motif detection, causal event impact, and plain-English smokehouse translation.

## 2. Functional Requirements (EARS Syntax)

### REQ-1: 3-Level Hierarchy Coherence (MinTrace)
- **When** predicting category and item sales, **the system shall** apply MinTrace (Minimum Trace / Shrinkage) reconciliation across the 3-level hierarchy (`Store Revenue -> Category [Brisket, Pork, Ribs, Turkey, Sausage, Sides] -> Cut/Item`) so that item-level totals mathematically equal category totals and store revenue within `0.01` tolerance.

### REQ-2: Probabilistic Quantile Prep Buffers
- **When** generating cook targets, **the system shall** compute P10 (Slow Day Floor), P50 (Expected Cook Target), and P90 (Busy Day Ceiling), and output the delta above P50 as *"Extra Weekend Prep"* expressed in whole physical cuts (Briskets, Pork Butts, Racks of Ribs, Turkey Breasts, Sausage Links), **capped at +1 brisket** over expected demand, and **never** as raw percentages.

### REQ-3: Regime Shift & Motif Detection
- **When** analyzing historical daily sales, **the system shall** run PELT/CUSUM structural break detection to flag permanent baseline shifts (`p < 0.01`) and matrix-profile motif/anomaly scoring to identify recurring weekly patterns and anomalous trading days.

### REQ-4: Causal Intervention & Synthetic Controls
- **When** measuring the impact of a past event (e.g., Jaguars home game, weather storm, promotion), **the system shall** compare actual POS revenue against a synthetic counterfactual baseline and report *"Estimated Dollar Lift / Drop"* in plain English.

### REQ-5: Jargon Quarantine & Plain-English Translation
- **The system shall** strictly forbid statistical jargon (`heteroskedasticity`, `eigenvalues`, `matrix profile`, `MinTrace`, `WLS`, `P90`, `P50`, `P10`, `variance`, `regression`, `velocity`, `Z-Score`, `Sigma`) in all rendered JSON text strings and UI views, translating all outputs into whole smokehouse units via `smokehouse_translator.py`.
