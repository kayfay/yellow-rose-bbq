with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

target = "df_cann.loc[df_cann['dino_qty'] > 0, 'pork_qty'] = df_cann.loc[df_cann['dino_qty'] > 0, 'pork_qty'] * 0.7"
replacement = "df_cann.loc[df_cann['dino_qty'] > 0, 'pork_qty'] = (df_cann.loc[df_cann['dino_qty'] > 0, 'pork_qty'] * 0.7).astype(int)"

content = content.replace(target, replacement)

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched for dtype.")
