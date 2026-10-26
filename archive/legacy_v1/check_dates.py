import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from clover_api.secure_config import DB_PATH
import sqlite3
import pandas as pd

conn = sqlite3.connect(DB_PATH)
df_orders = pd.read_sql_query("SELECT created_time, total_usd FROM orders WHERE lower(state)='locked' OR state is null", conn)
df_orders['date'] = pd.to_datetime(df_orders['created_time']).dt.strftime('%Y-%m-%d')
daily_sales = df_orders.groupby('date')['total_usd'].sum().reset_index()
print(daily_sales.sort_values('date', ascending=False).head(10))
