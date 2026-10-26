import os
import glob
import re

# 1. Fix state case sensitivity in all analytics files
analytics_dir = "clover_api/analytics"
for filepath in glob.glob(f"{analytics_dir}/*.py"):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace state='LOCKED' or state='locked' with lower(state)='locked'
    new_content = re.sub(r"state\s*=\s*['\"]LOCKED['\"]", "lower(state)='locked'", content)
    new_content = re.sub(r"state\s*=\s*['\"]locked['\"]", "lower(state)='locked'", new_content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed state case sensitivity in {filepath}")

# 2. Fix portion_transformer.py missing JOIN
portion_file = "clover_api/analytics/portion_transformer.py"
with open(portion_file, 'r') as f:
    portion_code = f.read()

old_query = 'query = "SELECT order_id, created_time, item_name, quantity, modifications FROM order_line_items"'
new_query = '''query = """
        SELECT l.order_id, l.created_time, l.item_name, l.quantity, l.modifications 
        FROM order_line_items l
        LEFT JOIN orders o ON l.order_id = o.order_id
        WHERE lower(o.state)='locked' OR o.state IS NULL
    """'''
if old_query in portion_code:
    portion_code = portion_code.replace(old_query, new_query)
    with open(portion_file, 'w') as f:
        f.write(portion_code)
    print("Fixed JOIN in portion_transformer.py")

# 3. Fix ingest.py cartesian discount
ingest_file = "clover_api/ingest.py"
with open(ingest_file, 'r') as f:
    ingest_code = f.read()

if '"discount_amount": discount_amount,' in ingest_code:
    # Just comment it out or remove it to avoid cartesian duplication
    ingest_code = ingest_code.replace('"discount_amount": discount_amount,', '# "discount_amount": discount_amount, # Removed to prevent cartesian duplication')
    with open(ingest_file, 'w') as f:
        f.write(ingest_code)
    print("Fixed discount cartesian duplication in ingest.py")

# 4. Fix dashboard.py dynamic baseline revenue
dashboard_file = "clover_api/analytics/dashboard.py"
with open(dashboard_file, 'r') as f:
    dash_code = f.read()

if 'base_revenue = 5078.63 * demand_index' in dash_code:
    dynamic_func = '''
def get_dynamic_baseline_revenue() -> float:
    import sqlite3
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT SUM(total_usd)/COUNT(DISTINCT date(created_time)) FROM orders WHERE lower(state)='locked'")
        res = cur.fetchone()[0]
        conn.close()
        return float(res) if res else 5078.63
    except Exception:
        return 5078.63
'''
    # Insert function after load_arima_forecast
    dash_code = dash_code.replace('def load_arima_forecast() -> Dict[str, Any]:', dynamic_func + '\ndef load_arima_forecast() -> Dict[str, Any]:')
    
    # Replace usage
    dash_code = dash_code.replace('base_revenue = 5078.63 * demand_index', 'base_revenue = get_dynamic_baseline_revenue() * demand_index')
    
    with open(dashboard_file, 'w') as f:
        f.write(dash_code)
    print("Fixed dynamic baseline revenue in dashboard.py")

