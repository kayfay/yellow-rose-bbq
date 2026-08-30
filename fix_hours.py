with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

target = "hours = list(range(9, 22))"
replacement = "hours = list(range(11, 22))"

content = content.replace(target, replacement)

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched for hours.")
