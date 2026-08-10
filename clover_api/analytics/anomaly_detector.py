"""
Yellow Rose BBQ - Two-Way Anomaly Detection (Spikes & Downtime)
Uses Scikit-Learn's Isolation Forest to mathematically identify both massive 
positive anomalies (e.g., Catering/Event 4x spikes) and massive negative 
anomalies (e.g., Extreme weather, power outages, 4x drops).
"""

import sqlite3
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from clover_api.secure_config import DB_PATH

def detect_anomalies(contamination: float = 0.05):
    """
    Scans the historical Clover POS data and flags both massive spikes and extreme downtime.
    Contamination = 0.05 means we expect roughly 5% of our historical days to be anomalies.
    """
    if not DB_PATH.exists():
        print("[WARN] Database not found. Please run ingest.py to fetch Clover data.")
        return None

    conn = sqlite3.connect(DB_PATH)
    try:
        # Load daily sales
        df_orders = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE state='LOCKED' OR state is null", conn)
        if df_orders.empty:
            print("[WARN] No order data found in database.")
            return None
            
        df_orders['date'] = pd.to_datetime(df_orders['created_time']).dt.strftime('%Y-%m-%d')
        df_daily = df_orders.groupby('date')['total_usd'].sum().reset_index()
        
    except Exception as e:
        print(f"[ERROR] Database read failed: {e}")
        return None
    finally:
        conn.close()

    if len(df_daily) < 14:
        print("[WARN] Not enough historical data for Isolation Forest. Need at least 14 days.")
        return None

    # We need to account for day-of-week seasonality so a normal slow Monday isn't flagged as an anomaly
    df_daily['date_obj'] = pd.to_datetime(df_daily['date'])
    df_daily['day_of_week'] = df_daily['date_obj'].dt.weekday
    
    # Calculate the rolling mean for that specific day of the week to establish a baseline
    df_daily['dow_mean'] = df_daily.groupby('day_of_week')['total_usd'].transform('mean')
    df_daily['dow_std'] = df_daily.groupby('day_of_week')['total_usd'].transform('std').fillna(1.0)
    
    # Feature 1: The Z-Score relative to that specific day of the week
    df_daily['revenue_zscore'] = (df_daily['total_usd'] - df_daily['dow_mean']) / df_daily['dow_std']
    
    # Prepare features for Isolation Forest
    X = df_daily[['total_usd', 'revenue_zscore']].fillna(0)

    # Initialize Isolation Forest (Two-Way detector)
    # It finds points that are "few and different" in any direction
    iso_forest = IsolationForest(n_estimators=100, contamination=contamination, random_state=42)
    
    # Fit and predict (-1 for anomalies, 1 for normal)
    df_daily['anomaly_score'] = iso_forest.fit_predict(X)
    
    # Filter anomalies
    anomalies = df_daily[df_daily['anomaly_score'] == -1].copy()
    
    # Classify as Positive Spike or Negative Downtime
    anomalies['anomaly_type'] = np.where(anomalies['revenue_zscore'] > 0, "Massive Spike (Event/Catering)", "Extreme Downtime (Weather/Outage)")
    
    print(f"=== Two-Way Anomaly Detection Complete ===")
    print(f"Scanned {len(df_daily)} days of historical data.")
    print(f"Found {len(anomalies)} statistical anomalies.")
    
    if not anomalies.empty:
        print("\n[ANOMALY REPORT]")
        for _, row in anomalies.iterrows():
            direction = "🔺" if row['revenue_zscore'] > 0 else "🔻"
            print(f"{direction} Date: {row['date']} | Type: {row['anomaly_type']} | Revenue: ${row['total_usd']:.2f} (Normal Avg: ${row['dow_mean']:.2f})")
    else:
        print("\nNo anomalies detected in the dataset.")
        
    return anomalies

if __name__ == "__main__":
    detect_anomalies()
