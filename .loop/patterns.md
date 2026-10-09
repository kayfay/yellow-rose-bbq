# Turkey Demand Forecasting & Statistical Distillate
1. Conversion & Yield: Raw turkey breast nominal yield = 70% (30% smoke/trim shrinkage; W_raw = W_cooked / 0.70). Pack size: 2 breasts/case (~20 lbs/case).
2. Base Target Formula: Target Forecast = (Base_DOW * M_season) * (1 + Safety_Buffer).
3. Adaptive EMA Error Correction: F_t = alpha * Y_{t-1} + (1 - alpha) * F_{t-1} with Huber outlier damping (|e| > 2 * MAD).
4. Drift Alert Threshold: Trigger warning if |Projected - Actual| / Actual > 0.35.
5. Tracking Signal: TS = sum(Actual - Forecast) / MAD. Recalibrate if TS outside [-4, 4].
6. Performance Bound: Historical 30-day backtest target MAPE < 15%.
7. Maker-Checker Boundary: No task marked complete without printed CLI verification evidence in transcript.

