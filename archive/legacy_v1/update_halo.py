import re

with open('clover_api/analytics/weather_impact.py', 'r') as f:
    content = f.read()

# Replace #0f172a with #39ff14
new_content = content.replace('"#0f172a"', '"#39ff14"')

# Add the dummy trace before fig_data = traces
pattern = re.compile(r"    fig_data = traces")
replacement = """    # Dummy trace for legend entry
    traces.append({
        "x": [None],
        "y": [None],
        "mode": "markers",
        "name": "Top 3 Recent Sales (Neon Halo)",
        "marker": {
            "size": 12,
            "color": "rgba(0,0,0,0)",
            "line": {"width": 4, "color": "#39ff14"}
        },
        "showlegend": True
    })

    fig_data = traces"""

new_content = pattern.sub(replacement, new_content)

with open('clover_api/analytics/weather_impact.py', 'w') as f:
    f.write(new_content)
