# Time-Series ML & Architecture Invariants
1. Time-series hourly models: SARIMAX, XGBoost Regressor, and Prophet.
2. Error metrics: MAE and RMSE with strict chronological train/test splits.
3. Feature engineering: Cyclical hour sin/cos, day-of-week, lag_1h, lag_24h, rolling_6h_mean.
4. Anomaly detection: Isolation Forest / Rolling Z-score (threshold > 2.5 sigma).
5. Output API schema (/api/analytics/predictive_hourly.json):
   - `generated_at`: ISO timestamp.
   - `model_version`: String identifier.
   - `horizon_hours`: Int (1-24).
   - `forecasts`: Array of {`timestamp`, `hour`, `predicted_demand`, `predicted_revenue`, `anomaly_score`, `is_anomaly`}.
   - `summary_metrics`: {`test_mae`, `test_rmse`, `peak_hour`, `recommended_prep_lbs`}.
6. Maker-Checker boundary: No task passes without printed CLI verification evidence in transcript.
