with open("clover_api/analytics/dashboard.py", "r") as f:
    content = f.read()
content = content.replace('demand_index = arima_data["forecast_metrics"]["demand_index"]["future"][:days][i]', 'demand_index = arima_data["forecast_metrics"]["demand_index"][:days][i]')
with open("clover_api/analytics/dashboard.py", "w") as f:
    f.write(content)
