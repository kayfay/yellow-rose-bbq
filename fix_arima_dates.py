import re

with open('clover_api/analytics/arima_baseline.py', 'r') as f:
    content = f.read()

target = """    pd_daily = daily_category_df.to_pandas()
    pd_daily['date'] = pd.to_datetime(pd_daily['date'])
    
    # Ensure full date range for each category
    all_dates = pd.date_range(start=pd_daily['date'].min(), end=pd_daily['date'].max(), freq='D')
    
    # 3. Overall Demand Index (from orders total_usd)
    df_orders = df_orders.to_pandas()
    df_orders['date'] = pd.to_datetime(df_orders['created_time']).dt.strftime('%Y-%m-%d')
    df_daily_rev = df_orders.groupby('date')['total_usd'].sum().reset_index()
    df_daily_rev['date'] = pd.to_datetime(df_daily_rev['date'])"""

replacement = """    pd_daily = daily_category_df.to_pandas()
    pd_daily['date'] = pd.to_datetime(pd_daily['date'])
    
    # Ensure we don't use partial data for today
    today = pd.Timestamp.today().normalize()
    pd_daily = pd_daily[pd_daily['date'] < today]
    
    # Ensure full date range for each category
    all_dates = pd.date_range(start=pd_daily['date'].min(), end=pd_daily['date'].max(), freq='D')
    
    # 3. Overall Demand Index (from orders total_usd)
    df_orders = df_orders.to_pandas()
    df_orders['date'] = pd.to_datetime(df_orders['created_time']).dt.strftime('%Y-%m-%d')
    df_daily_rev = df_orders.groupby('date')['total_usd'].sum().reset_index()
    df_daily_rev['date'] = pd.to_datetime(df_daily_rev['date'])
    df_daily_rev = df_daily_rev[df_daily_rev['date'] < today]"""

if target in content:
    with open('clover_api/analytics/arima_baseline.py', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Fixed arima_baseline.py!")
else:
    print("Target not found in arima_baseline.py")
