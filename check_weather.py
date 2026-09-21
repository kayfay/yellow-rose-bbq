import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from clover_api.secure_config import DB_PATH
import sqlite3
import pandas as pd

conn = sqlite3.connect(DB_PATH)
df_weather = pd.read_sql_query("SELECT * FROM weather_events ORDER BY date DESC LIMIT 5", conn)
print(df_weather)
