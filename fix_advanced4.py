with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

target = '''    query_type = """
        SELECT 
            l.order_type, 
            COUNT(DISTINCT o.order_id) as order_count, 
            SUM(o.total_usd) as total_revenue
        FROM orders o
        JOIN (
            SELECT order_id, MAX(order_type) as order_type
            FROM order_line_items
            GROUP BY order_id
        ) l ON o.order_id = l.order_id
        GROUP BY l.order_type
    """'''

replacement = '''    query_type = """
        SELECT 
            CASE 
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
    """'''

content = content.replace(target, replacement)

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched for To-Go merge.")
