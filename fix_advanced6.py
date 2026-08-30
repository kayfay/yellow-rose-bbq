with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

target = '"x": [f"{h:02d}:00" for h in hours],'
replacement = '"x": [f"{h if h <= 12 else h - 12}:00 {\'AM\' if h < 12 else \'PM\'}" for h in hours],'

content = content.replace(target, replacement)

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched for standard time.")
