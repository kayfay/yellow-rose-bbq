import re

with open('clover_api/analytics/weather_impact.py', 'r') as f:
    content = f.read()

# 1. Add most_recent_date
# Find: top_3_dates = top_3_recent['date'].tolist()
# Replace with: 
# top_3_dates = top_3_recent['date'].tolist()
# most_recent_date = df_chart['date'].max()

content = content.replace("top_3_dates = top_3_recent['date'].tolist()",
                          "top_3_dates = top_3_recent['date'].tolist()\n    most_recent_date = df_chart['date'].max()")

# 2. Update generate_tooltip
# Find:
#         if row['date'] in top_3_dates:
#             rank = top_3_dates.index(row['date']) + 1
#             rank_str = f"<br><br><b>🏆 #{rank} Highest Recent Sales Day</b>"
# Replace with:
tooltip_search = """        if row['date'] in top_3_dates:
            rank = top_3_dates.index(row['date']) + 1
            rank_str = f"<br><br><b>🏆 #{rank} Highest Recent Sales Day</b>\"""
tooltip_replace = """        if row['date'] == most_recent_date:
            rank_str += f"<br><br><b>🌟 YESTERDAY'S SALES</b>"
        if row['date'] in top_3_dates:
            rank = top_3_dates.index(row['date']) + 1
            rank_str += f"<br><br><b>🏆 #{rank} Highest Recent Sales Day</b>\"""
content = content.replace(tooltip_search, tooltip_replace)

# 3. Update marker widths and colors for Normal, Rain, Heat
# From: [4 if d in top_3_dates else 1.5 for d in df_normal['date']]
# To: [5 if d == most_recent_date else (4 if d in top_3_dates else 1.5) for d in df_normal['date']]
for df_name in ['df_normal', 'df_rain', 'df_heat']:
    content = content.replace(f'[4 if d in top_3_dates else 1.5 for d in {df_name}[\'date\']]',
                              f'[5 if d == most_recent_date else (4 if d in top_3_dates else 1.5) for d in {df_name}[\'date\']]')
    content = content.replace(f'["#39ff14" if d in top_3_dates else "white" for d in {df_name}[\'date\']]',
                              f'["#ff10f0" if d == most_recent_date else ("#39ff14" if d in top_3_dates else "white") for d in {df_name}[\'date\']]')

# 4. Add dummy trace for Yesterday
dummy_search = """    # Dummy trace for legend entry
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
    })"""
dummy_replace = """    # Dummy trace for legend entry - Top 3
    traces.append({
        "x": [None],
        "y": [None],
        "mode": "markers",
        "name": "Top 3 Recent Sales (Neon Green Halo)",
        "marker": {
            "size": 12,
            "color": "rgba(0,0,0,0)",
            "line": {"width": 4, "color": "#39ff14"}
        },
        "showlegend": True
    })
    
    # Dummy trace for legend entry - Yesterday
    traces.append({
        "x": [None],
        "y": [None],
        "mode": "markers",
        "name": "Yesterday's Sales (Neon Pink Halo)",
        "marker": {
            "size": 12,
            "color": "rgba(0,0,0,0)",
            "line": {"width": 5, "color": "#ff10f0"}
        },
        "showlegend": True
    })"""
content = content.replace(dummy_search, dummy_replace)

with open('clover_api/analytics/weather_impact.py', 'w') as f:
    f.write(content)

