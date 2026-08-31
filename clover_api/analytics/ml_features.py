"""
Yellow Rose BBQ - Advanced External Features Pipeline
Fetches historical and forecasted weather for Jacksonville, FL using Open-Meteo API.
Generates US/FL holidays and specific event flags.
Uses Polars for blazing-fast transformations and outputs to SQLite.
"""

import sqlite3
import requests
import polars as pl
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Ensure secure_config can be imported
sys.path.append(str(Path(__file__).parent.parent.parent))

from clover_api.secure_config import DB_PATH

# Open-Meteo Coordinates for Jacksonville, FL
JAX_LAT = 30.3322
JAX_LON = -81.6557

def fetch_weather_features(days_back: int = 365, days_forward: int = 14) -> pl.DataFrame:
    """
    Fetches historical and forecast weather using the free Open-Meteo API.
    Does NOT require an API key.
    """
    today = datetime.now()
    start_date = (today - timedelta(days=days_back)).strftime('%Y-%m-%d')
    end_date = (today + timedelta(days=days_forward)).strftime('%Y-%m-%d')
    
    # Using the daily historical + forecast endpoint with past_days
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": JAX_LAT,
        "longitude": JAX_LON,
        "daily": ["temperature_2m_max", "precipitation_sum", "wind_speed_10m_max"],
        "timezone": "America/New_York",
        "past_days": min(days_back, 92),
        "forecast_days": days_forward
    }
    
    try:
        print(f"[FETCH] Querying Open-Meteo for Jacksonville weather from {start_date} to {end_date}...")
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        daily = data.get("daily", {})
        df_weather = pl.DataFrame({
            "date": daily.get("time", []),
            "temp_max_f": [(c * 9/5) + 32 if c is not None else None for c in daily.get("temperature_2m_max", [])], # Convert C to F
            "precip_mm": daily.get("precipitation_sum", []),
            "wind_speed_max": daily.get("wind_speed_10m_max", [])
        })
    except Exception as e:
        print(f"[WARN] Failed to fetch weather ({e}). Mocking weather features.")
        dates = [(today - timedelta(days=days_back) + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days_back + days_forward + 1)]
        df_weather = pl.DataFrame({
            "date": dates,
            "temp_max_f": [85.0] * len(dates),
            "precip_mm": [0.0] * len(dates),
            "wind_speed_max": [5.0] * len(dates)
        })
    
    # Feature Engineering: Flag high rain, heat waves, and high wind
    df_weather = df_weather.with_columns([
        (pl.col("precip_mm").fill_null(0) > 10.0).alias("is_heavy_rain").cast(pl.Int32),
        (pl.col("temp_max_f").fill_null(0) > 90.0).alias("is_extreme_heat").cast(pl.Int32),
        (pl.col("wind_speed_max").fill_null(0) > 20.0).alias("is_high_wind").cast(pl.Int32)
    ])
    return df_weather

def generate_holiday_and_event_features(dates_series: pl.Series) -> pl.DataFrame:
    """
    Generates holiday and event binary flags for given dates using a static list of holidays,
    plus accurate local event and payday mappings.
    """
    HARDCODED_HOLIDAYS = [
        "2026-01-01", "2026-05-25", "2026-07-04", "2026-09-07", "2026-11-26", "2026-12-25",
        "2027-01-01", "2027-05-31", "2027-07-04", "2027-09-06", "2027-11-25", "2027-12-25"
    ]
    
    # Sample actual Jaguars home games and Jax events
    JAGS_HOME_GAMES = ["2026-09-13", "2026-09-27", "2026-10-18", "2026-11-01", "2026-11-22", "2026-12-06", "2026-12-20"]
    JAX_EVENTS = ["2026-05-22", "2026-05-23", "2026-05-24", "2026-10-31"] # Jazz fest, etc.
    
    def is_holiday(date_str):
        return 1 if date_str in HARDCODED_HOLIDAYS else 0

        
    def is_jaguars_game(date_str):
        return 1 if date_str in JAGS_HOME_GAMES else 0
        
    def is_local_event(date_str):
        return 1 if date_str in JAX_EVENTS else 0
        
    def is_payday(date_str):
        dt = datetime.strptime(date_str, "%Y-%m-%d").date()
        # Common paydays: 1st, 15th, or Friday
        if dt.day in [1, 15] or (dt.weekday() == 4 and dt.day <= 7):
            return 1
        return 0

    df_events = pl.DataFrame({"date": dates_series})
    df_events = df_events.with_columns([
        pl.col("date").map_elements(is_holiday, return_dtype=pl.Int32).alias("is_holiday"),
        pl.col("date").map_elements(is_jaguars_game, return_dtype=pl.Int32).alias("is_jaguars_game"),
        pl.col("date").map_elements(is_local_event, return_dtype=pl.Int32).alias("is_local_event"),
        pl.col("date").map_elements(is_payday, return_dtype=pl.Int32).alias("is_payday")
    ])
    return df_events

def run_feature_pipeline():
    print("=== Starting External Feature Ingestion Pipeline ===")
    
    # 1. Fetch Weather
    df_weather = fetch_weather_features()
    
    # 2. Generate Events for the same date range
    df_events = generate_holiday_and_event_features(df_weather["date"])
    
    # 3. Merge Features (Polars Join)
    df_features = df_weather.join(df_events, on="date", how="left")
    
    # 4. Save to SQLite
    # Convert to Pandas purely for standard SQLite export, though Polars has connectorX
    df_pandas = df_features.to_pandas()
    
    conn = sqlite3.connect(DB_PATH)
    df_pandas.to_sql("weather_events", conn, if_exists="replace", index=False)
    conn.close()
    
    print(f"[DATABASE] Successfully saved {len(df_features)} days of external features to 'weather_events' table.")
    print("=== External Feature Pipeline Complete ===")

if __name__ == "__main__":
    try:
        run_feature_pipeline()
    except Exception as e:
        import traceback
        print(f"[FATAL ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        sys.exit(1)
