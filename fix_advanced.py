with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

target = "    df_items = df_items[df_items['item_name'] != '']"
replacement = "    df_items = df_items[(df_items['item_name'] != '') & (df_items['item_name'] != 'Service Charge')]"

content = content.replace(target, replacement)

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched.")
