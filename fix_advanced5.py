with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

target = """            for h in hours:
                val = item_df[item_df['hour'] == h]['qty'].sum()
                running += float(val)"""

replacement = """            for h in hours:
                val = item_df[item_df['hour'] == h]['qty'].sum()
                if item in ['Brisket', 'Pulled Pork']:
                    val = val / 1000.0
                running += float(val)"""

content = content.replace(target, replacement)

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched for chart scaling.")
