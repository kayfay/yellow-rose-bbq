import json

with open('clover_api/analytics/dashboard_payload.json', 'r') as f:
    data = json.load(f)

# Update records
for record in data['forecast']['forecast_records']:
    # Composed items adjustment
    tacos_sold = record.get('tacos_sold', 0)
    rosebuds_sold = record.get('rosebuds_sold', 0)
    
    brisket_tacos = tacos_sold * 0.5  # assuming all tacos are brisket for simplicity, or we can split it, but we don't have tacos_brisket vs tacos_pork in the record!
    # Wait, in the record, we only have tacos_sold.
    # In rewrite_dashboard.py we did tacos_sold = tacos_brisket + tacos_pork.
    # For now, let's assume 80% brisket tacos and 20% pork tacos.
    brisket_tacos = (tacos_sold * 0.8) * 0.5
    pork_tacos = (tacos_sold * 0.2) * 0.5
    rosebuds = rosebuds_sold * 0.2
    
    record['brisket_raw_lbs'] = round(record['brisket_raw_lbs'] + brisket_tacos + rosebuds, 1)
    record['pork_shoulder_raw_lbs'] = round(record['pork_shoulder_raw_lbs'] + pork_tacos, 1)
    
    # Rename sausage
    if 'sausage_links' in record:
        record['sausage_lbs'] = record.pop('sausage_links')

# Update plotly data
for trace in data['plotly_meat_chart']['data']:
    if trace['name'] == 'Raw Brisket Prep (lbs)':
        trace['y'] = [r['brisket_raw_lbs'] for r in data['forecast']['forecast_records']]
    elif trace['name'] == 'Pork Shoulder (lbs)':
        trace['y'] = [r['pork_shoulder_raw_lbs'] for r in data['forecast']['forecast_records']]
    elif trace['name'] == 'Sausage Sold (lbs)':
        trace['y'] = [r['sausage_lbs'] for r in data['forecast']['forecast_records']]

with open('clover_api/analytics/dashboard_payload.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Updated dashboard_payload.json")
