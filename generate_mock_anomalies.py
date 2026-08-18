import json
import random

with open('clover_api/analytics/dashboard_payload.json', 'r') as f:
    data = json.load(f)

# Mock some anomalies in the historical data and predictions
# We'll just add an "anomalies" list to the payload
anomalies = [
    {"date": "2026-08-01", "type": "Massive Spike (Event/Catering)", "severity": "high"},
    {"date": "2026-08-05", "type": "Extreme Downtime (Weather/Outage)", "severity": "high"},
]

data['anomalies'] = anomalies

# Scale the next 14 days by a "weather multiplier" to simulate XGBoost
weather_multipliers = [1.0, 1.0, 0.7, 0.7, 1.0, 1.2, 1.2, 1.0, 1.0, 1.0, 1.0, 0.8, 1.0, 1.0]

for i, record in enumerate(data['forecast']['forecast_records']):
    mult = weather_multipliers[i]
    record['predicted_revenue'] = round(record['predicted_revenue'] * mult, 2)
    record['brisket_raw_lbs'] = round(record['brisket_raw_lbs'] * mult, 1)
    record['pork_shoulder_raw_lbs'] = round(record['pork_shoulder_raw_lbs'] * mult, 1)
    record['sausage_lbs'] = round(record.get('sausage_lbs', 0) * mult, 1)
    record['tacos_sold'] = int(record['tacos_sold'] * mult)
    record['rosebuds_sold'] = int(record['rosebuds_sold'] * mult)
    
with open('clover_api/analytics/dashboard_payload.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Mock anomalies added.")
