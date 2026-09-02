"""
Yellow Rose BBQ - Multivariate ML Regression Model
Trains an XGBoost regressor predicting daily revenue using POS time-series + Weather/Event exogenous variables.
Uses Polars for fast preprocessing and Scikit-Learn for validation.
"""

import sqlite3
import pandas as pd
import polars as pl
import numpy as np
from pathlib import Path
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_percentage_error
from clover_api.secure_config import DB_PATH, ANALYTICS_DIR

def build_training_dataset() -> pl.DataFrame:
    """
    Joins Clover sales with weather and event data to create the ML feature matrix.
    """
    if not DB_PATH.exists():
        print("[WARN] DB not found. Ensure ingest.py and ml_features.py have run.")
        return pl.DataFrame()

    conn = sqlite3.connect(DB_PATH)
    try:
        # Load orders and resample to daily revenue (using Pandas for the SQL read, then convert to Polars)
        df_orders = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE lower(state)='locked' OR state is null", conn)
        df_orders['date'] = pd.to_datetime(df_orders['created_time']).dt.strftime('%Y-%m-%d')
        df_daily_sales = df_orders.groupby('date')['total_usd'].sum().reset_index()
        
        # Load external features
        df_features = pd.read_sql_query("SELECT * FROM weather_events", conn)
    except Exception as e:
        print(f"[ERROR] Could not load tables: {e}")
        conn.close()
        return pl.DataFrame()
    finally:
        conn.close()

    # Convert to Polars for fast feature engineering
    pl_sales = pl.from_pandas(df_daily_sales)
    pl_features = pl.from_pandas(df_features)

    # Join and create date-based features
    pl_merged = pl_sales.join(pl_features, on="date", how="inner")
    
    # Feature Engineering: Day of week, Month
    pl_merged = pl_merged.with_columns([
        pl.col("date").str.to_datetime().dt.weekday().alias("day_of_week"),
        pl.col("date").str.to_datetime().dt.month().alias("month")
    ])
    
    # Drop rows with null weather data if any
    pl_merged = pl_merged.drop_nulls()
    return pl_merged

def train_and_evaluate_model():
    print("=== Starting Multivariate ML Training Pipeline (XGBoost) ===")
    df = build_training_dataset()
    
    if df.is_empty() or df.height < 30:
        print("[WARN] Insufficient historical data for robust ML training. Need at least 30 days of joined data.")
        return

    # Prepare feature matrix (X) and target (y)
    # Target: total_usd
    # Features: day_of_week, month, temp_max_f, precip_mm, is_heavy_rain, is_extreme_heat, is_holiday, is_jaguars_game
    feature_cols = ["day_of_week", "month", "temp_max_f", "precip_mm", 
                    "is_heavy_rain", "is_extreme_heat", "is_holiday", "is_jaguars_game"]
    
    X = df.select(feature_cols).to_numpy()
    y = df.select("total_usd").to_numpy().ravel()

    # Time Series Cross Validation (to prevent data leakage into the future)
    tscv = TimeSeriesSplit(n_splits=3)
    mape_scores = []

    model = xgb.XGBRegressor(
        n_estimators=100,
        learning_rate=0.05,
        max_depth=4,
        objective='reg:squarederror'
    )

    for train_index, test_index in tscv.split(X):
        X_train, X_test = X[train_index], X[test_index]
        y_train, y_test = y[train_index], y[test_index]

        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        
        score = mean_absolute_percentage_error(y_test, preds)
        mape_scores.append(score)

    avg_mape = np.mean(mape_scores)
    print(f"[EVALUATION] TimeSeries CV Average MAPE: {avg_mape:.2%}")

    # Retrain on full dataset
    model.fit(X, y)
    
    # Save model artifact
    model_path = ANALYTICS_DIR / "bbq_xgboost_model.json"
    model.save_model(model_path)
    print(f"[SUCCESS] Trained XGBoost model exported to {model_path}")
    print("=== Training Pipeline Complete ===")

if __name__ == "__main__":
    try:
        train_and_evaluate_model()
    except Exception as e:
        import traceback
        import sys
        print(f"[FATAL ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        sys.exit(1)
