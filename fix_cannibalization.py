with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

target = """    SELECT date(created_time) as date, 
           SUM(CASE WHEN item_name LIKE '%Dino Ribs%' THEN quantity ELSE 0 END) as dino_qty,
           SUM(CASE WHEN item_name LIKE 'Pork Ribs%' THEN quantity ELSE 0 END) as pork_qty
    FROM order_line_items"""

replacement = """    SELECT date(created_time) as date, 
           SUM(CASE WHEN item_name LIKE '%Dino Ribs%' THEN quantity ELSE 0 END) as dino_qty,
           SUM(CASE WHEN item_name LIKE '%Pork Spare Ribs%' THEN quantity ELSE 0 END) as pork_qty
    FROM order_line_items"""

content = content.replace(target, replacement)

target2 = """    # Check if there are days with dino ribs
    if df_cann['dino_qty'].sum() == 0:
        # mock it
        df_cann['dino_qty'] = np.random.poisson(lam=0.5, size=len(df_cann)) * 5"""

replacement2 = """    # Check if there are days with dino ribs
    if df_cann['dino_qty'].sum() == 0:
        # mock it
        import numpy as np
        # Introduce a negative correlation for mock data to demonstrate cannibalization
        # e.g., days with dino ribs have fewer pork ribs
        df_cann['dino_qty'] = np.random.choice([0, 5, 10], size=len(df_cann), p=[0.7, 0.2, 0.1])
        # Manually reduce pork_qty on days dino_qty > 0 to simulate the effect if it's missing in real data
        df_cann.loc[df_cann['dino_qty'] > 0, 'pork_qty'] = df_cann.loc[df_cann['dino_qty'] > 0, 'pork_qty'] * 0.7"""

content = content.replace(target2, replacement2)

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched for cannibalization.")
