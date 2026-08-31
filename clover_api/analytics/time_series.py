"""
Time Series Forecasting Blueprint for Yellow Rose BBQ
Performs daily/weekly resampling, seasonal decomposition, and generates static forecast plots.
"""

import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from statsmodels.tsa.seasonal import seasonal_decompose

# Local config imports
from clover_api.secure_config import DB_PATH, ANALYTICS_DIR

def load_sales_data(db_path: Path = DB_PATH) -> pd.DataFrame:
    """Loads cleaned order transactions from SQLite database."""
    if not db_path.exists():
        print(f"[WARN] Database {db_path} not found. Generating synthetic baseline for pipeline demo.")
        return generate_synthetic_bbq_sales()

    conn = sqlite3.connect(db_path)
    df = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE state='LOCKED' OR state is null", conn)
    conn.close()

    df['created_time'] = pd.to_datetime(df['created_time'])
    df.set_index('created_time', inplace=True)
    return df

def generate_synthetic_bbq_sales(days: int = 180) -> pd.DataFrame:
    """Generates synthetic daily transaction data reflecting weekend BBQ spikes."""
    dates = pd.date_range(end=pd.Timestamp.now(), periods=days, freq='D')
    
    # Baseline daily sales with weekly seasonality (high Friday/Saturday) and slight upward trend
    base = 1500.0
    trend = np.linspace(0, 500, days)
    # Day-of-week multiplier: Mon=0.7, Tue=0.7, Wed=0.8, Thu=1.0, Fri=1.4, Sat=1.8, Sun=1.1
    dow_map = {0: 0.7, 1: 0.7, 2: 0.8, 3: 1.0, 4: 1.4, 5: 1.8, 6: 1.1}
    seasonality = np.array([dow_map[d.weekday()] for d in dates])
    noise = np.random.normal(0, 100, days)
    
    sales = (base + trend) * seasonality + noise
    df = pd.DataFrame({"total_usd": np.maximum(sales, 200)}, index=dates)
    df.index.name = "created_time"
    return df

def resample_sales(df: pd.DataFrame, freq: str = 'D') -> pd.DataFrame:
    """Resamples transaction time series into regular intervals (e.g., 'D' for daily, 'W' for weekly)."""
    resampled = df.resample(freq).agg({'total_usd': 'sum'}).fillna(0)
    return resampled

def decompose_bbq_sales(df_daily: pd.DataFrame, period: int = 7):
    """
    Performs seasonal decomposition using statsmodels to separate trend,
    weekly seasonality, and residuals in BBQ sales.
    """
    decomposition = seasonal_decompose(df_daily['total_usd'], model='additive', period=period)
    return decomposition

def generate_forecast_plot(df_daily: pd.DataFrame, decomposition, output_file: Path = ANALYTICS_DIR / "static_forecast.png"):
    """
    Generates and saves static forecast decomposition plot.
    """
    fig, axes = plt.subplots(4, 1, figsize=(12, 10), sharex=True)
    
    # 1. Observed Sales
    axes[0].plot(df_daily.index, df_daily['total_usd'], color='#c0392b', lw=1.5, label='Observed Revenue ($)')
    axes[0].set_title('Yellow Rose BBQ - Daily Revenue & Time Series Decomposition', fontsize=14, fontweight='bold', pad=10)
    axes[0].legend(loc='upper left')
    axes[0].grid(True, alpha=0.3)
    
    # 2. Trend Component
    axes[1].plot(decomposition.trend.index, decomposition.trend, color='#2980b9', lw=2, label='Underlying Trend')
    axes[1].legend(loc='upper left')
    axes[1].grid(True, alpha=0.3)
    
    # 3. Weekly Seasonality Component
    axes[2].plot(decomposition.seasonal.index, decomposition.seasonal, color='#27ae60', lw=1.5, label='Weekly Seasonality Pattern')
    axes[2].legend(loc='upper left')
    axes[2].grid(True, alpha=0.3)
    
    # 4. Residuals (Unexplained variance)
    axes[3].scatter(decomposition.resid.index, decomposition.resid, color='#7f8c8d', s=10, alpha=0.7, label='Residual Noise')
    axes[3].axhline(0, color='black', linestyle='--', linewidth=1)
    axes[3].legend(loc='upper left')
    axes[3].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(output_file, dpi=300)
    plt.close()
    print(f"[ANALYTICS] Forecast plot successfully saved to {output_file}")

def run_analytics_pipeline():
    """Executes full time-series forecasting workflow."""
    print("=== Starting Time-Series Analytics & Forecasting Pipeline ===")
    df_raw = load_sales_data()
    df_daily = resample_sales(df_raw, freq='D')
    
    if len(df_daily) >= 14:  # Need at least 2 full weeks for 7-day seasonal decomposition
        decomp = decompose_bbq_sales(df_daily, period=7)
        generate_forecast_plot(df_daily, decomp)
    else:
        print("[WARN] Insufficient historical data points for full seasonal decomposition.")

    print("=== Time-Series Pipeline Execution Complete ===")

if __name__ == "__main__":
    try:
        run_analytics_pipeline()
    except Exception as e:
        import traceback
        import sys
        print(f"[FATAL ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        sys.exit(1)
