import os
import glob
import re

analytics_dir = "clover_api/analytics"
for filepath in glob.glob(f"{analytics_dir}/*.py"):
    with open(filepath, 'r') as f:
        content = f.read()

    # advanced_analytics.py has query_hour and query_type and query_cann
    if "advanced_analytics.py" in filepath:
        old_query_hour = '''query_hour = "SELECT hour, item_name, SUM(quantity) as qty FROM order_line_items WHERE item_name LIKE '%Brisket%' OR item_name LIKE '%Ribs%' OR item_name LIKE '%Pork%' GROUP BY hour, item_name"
    df_hour = pd.read_sql_query(query_hour, conn)'''
        new_query_hour = '''query_hour = "SELECT hour, item_name, SUM(quantity) as qty FROM order_line_items WHERE item_name LIKE ? OR item_name LIKE ? OR item_name LIKE ? GROUP BY hour, item_name"
    df_hour = pd.read_sql_query(query_hour, conn, params=('%Brisket%', '%Ribs%', '%Pork%'))'''
        content = content.replace(old_query_hour, new_query_hour)

        old_query_cann = '''    SELECT date(created_time) as date, 
           SUM(CASE WHEN item_name LIKE '%Dino Ribs%' THEN quantity ELSE 0 END) as dino_qty,
           SUM(CASE WHEN item_name LIKE '%Pork Spare Ribs%' THEN quantity ELSE 0 END) as pork_qty
    FROM order_line_items
    GROUP BY date(created_time)
    """
    df_cann = pd.read_sql_query(query_cann, conn)'''
        new_query_cann = '''    SELECT date(created_time) as date, 
           SUM(CASE WHEN item_name LIKE ? THEN quantity ELSE 0 END) as dino_qty,
           SUM(CASE WHEN item_name LIKE ? THEN quantity ELSE 0 END) as pork_qty
    FROM order_line_items
    GROUP BY date(created_time)
    """
    df_cann = pd.read_sql_query(query_cann, conn, params=('%Dino Ribs%', '%Pork Spare Ribs%'))'''
        content = content.replace(old_query_cann, new_query_cann)

        old_query_type = """            CASE 
                WHEN l.order_type LIKE '%To-Go%' THEN 'To-Go'
                ELSE TRIM(l.order_type)
            END as order_type,
            COUNT(DISTINCT o.order_id) as order_count, 
            SUM(o.total_usd) as total_revenue
        FROM orders o
        JOIN (
            SELECT order_id, MAX(order_type) as order_type
            FROM order_line_items
            GROUP BY order_id
        ) l ON o.order_id = l.order_id
        GROUP BY CASE 
            WHEN l.order_type LIKE '%To-Go%' THEN 'To-Go'
            ELSE TRIM(l.order_type)
        END
    \"\"\"
    df_type = pd.read_sql_query(query_type, conn)"""
        new_query_type = """            CASE 
                WHEN l.order_type LIKE ? THEN 'To-Go'
                ELSE TRIM(l.order_type)
            END as order_type,
            COUNT(DISTINCT o.order_id) as order_count, 
            SUM(o.total_usd) as total_revenue
        FROM orders o
        JOIN (
            SELECT order_id, MAX(order_type) as order_type
            FROM order_line_items
            GROUP BY order_id
        ) l ON o.order_id = l.order_id
        GROUP BY CASE 
            WHEN l.order_type LIKE ? THEN 'To-Go'
            ELSE TRIM(l.order_type)
        END
    \"\"\"
    df_type = pd.read_sql_query(query_type, conn, params=('%To-Go%', '%To-Go%'))"""
        content = content.replace(old_query_type, new_query_type)

        with open(filepath, 'w') as f:
            f.write(content)

print("Parameterized advanced_analytics.py")
