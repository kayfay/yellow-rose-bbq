with open('clover_api/analytics/advanced_analytics.py', 'r') as f:
    content = f.read()

content = content.replace("        import numpy as np\n", "")

with open('clover_api/analytics/advanced_analytics.py', 'w') as f:
    f.write(content)
print("advanced_analytics.py patched for numpy scope.")
