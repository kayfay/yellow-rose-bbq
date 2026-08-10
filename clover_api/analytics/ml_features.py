"""
Yellow Rose BBQ - Advanced External Features Pipeline
Fetches historical and forecasted weather for Jacksonville, FL using Open-Meteo API.
Generates US/FL holidays and specific event flags.
Uses Polars for blazing-fast transformations and outputs to SQLite.
"""

import sqlite3
import requests
import holidays
import polars as pl
from datetime import datetime, timedelta
from pathlib import Path
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
        "daily": ["temperature_2m_max", "precipitation_sum"],
        "timezone": "America/New_York",
        "past_days": min(days_back, 92),
        "forecast_days": days_forward
    }
    
    print(f"[FETCH] Querying Open-Meteo for Jacksonville weather from {start_date} to {end_date}...")
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()
    
    daily = data.get("daily", {})
    df_weather = pl.DataFrame({
        "date": daily.get("time", []),
        "temp_max_f": [(c * 9/5) + 32 if c is not None else None for c in daily.get("temperature_2m_max", [])], # Convert C to F
        "precip_mm": daily.get("precipitation_sum", [])
    })
    
    # Feature Engineering: Flag high rain and heat waves
    df_weather = df_weather.with_columns([
        (pl.col("precip_mm") > 10.0).alias("is_heavy_rain").cast(pl.Int32),
        (pl.col("temp_max_f") > 90.0).alias("is_extreme_heat").cast(pl.Int32)
    ])
    return df_weather

def generate_holiday_and_event_features(dates_series: pl.Series) -> pl.DataFrame:
    """
    Generates holiday and event binary flags for given dates using the Python holidays library.
    """
    fl_holidays = holidays.US(state='FL')
    
    def is_holiday(date_str):
        dt = datetime.strptime(date_str, "%Y-%m-%d").date()
        return 1 if dt in fl_holidays else 0
        
    def is_jaguars_game(date_str):
        # Mock logic for Jaguars home games: Sundays in Fall (Sep-Dec)
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if dt.month in [9, 10, 11, 12] and dt.weekday() == 6:
            # Randomize slightly for realistic simulation of home vs away
            return 1 if dt.day % 2 == 0 else 0
        return 0

    df_events = pl.DataFrame({"date": dates_series})
    df_events = df_events.with_columns([
        pl.col("date").map_elements(is_holiday, return_dtype=pl.Int32).alias("is_holiday"),
        pl.col("date").map_elements(is_jaguars_game, return_dtype=pl.Int32).alias("is_jaguars_game")
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
    run_feature_pipeline()
