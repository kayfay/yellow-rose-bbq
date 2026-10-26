import re

with open('clover_api/analytics/weather_impact.py', 'r') as f:
    content = f.read()

# I will use a precise regex to replace from "    # Create traces for Normal, Heat, and Rain" down to "    payload = {"
pattern = re.compile(r"    # Create traces for Normal, Heat, and Rain.*?    payload = {", re.DOTALL)

replacement = """    # Find the top 3 most recent large sales days (within the last 60 days)
    if 'datetime' not in df_chart.columns:
        df_chart['datetime'] = pd.to_datetime(df_chart['date'])
    recent_60_days = df_chart['datetime'].max() - pd.Timedelta(days=60)
    df_recent_60 = df_chart[df_chart['datetime'] >= recent_60_days]
    
    if not df_recent_60.empty:
        top_3_recent = df_recent_60.nlargest(3, 'daily_revenue')
    else:
        top_3_recent = df_chart.nlargest(3, 'daily_revenue')
    top_3_dates = top_3_recent['date'].tolist()

    # Create traces for Normal, Heat, and Rain
    traces = []
    
    def generate_tooltip(row, condition):
        import pandas as pd
        d_obj = pd.to_datetime(row['date'])
        date_str = d_obj.strftime('%A, %Y-%m-%d')
        
        rank_str = ""
        if row['date'] in top_3_dates:
            rank = top_3_dates.index(row['date']) + 1
            rank_str = f"<br><br><b>🏆 #{rank} Highest Recent Sales Day</b>"

        base = f"<b>{date_str}</b><br>Revenue: ${row['daily_revenue']:,.2f}<br>Weather: {row['temp_max_f']}°F, {row['precip_mm']}mm rain"
        if condition == 'rain':
            return base + rank_str + "<br><br><i>Insight: Heavy rain shifts customers from patio<br>to high-margin To-Go Family Bundles.</i>"
        elif condition == 'heat':
            return base + rank_str + "<br><br><i>Insight: Extreme heat (>90°F) kills patio seating.<br>Push curbside pickup and A/C indoor dining.</i>"
        else:
            return base + rank_str + "<br><br><i>Insight: Ideal patio weather.<br>Maximize walk-in capacity and patio service.</i>"
    
    # Trace 1: Normal Days
    df_normal = df_chart[(df_chart['is_heavy_rain'] == 0) & (df_chart['is_extreme_heat'] == 0)]
    if not df_normal.empty:
        traces.append({
            "x": df_normal['temp_max_f'].tolist(),
            "y": df_normal['daily_revenue'].tolist(),
            "text": df_normal.apply(lambda row: generate_tooltip(row, 'normal'), axis=1).tolist(),
            "hovertemplate": "%{text}<extra></extra>",
            "mode": "markers",
            "name": "Ideal Patio Weather (Normal)",
            "marker": {
                "size": [max(10, min(p * 2 + 10, 20)) for p in df_normal['precip_mm']],
                "color": "#27ae60",
                "opacity": 0.8,
                "line": {
                    "width": [4 if d in top_3_dates else 1.5 for d in df_normal['date']],
                    "color": ["#0f172a" if d in top_3_dates else "white" for d in df_normal['date']]
                }
            }
        })
        
    # Trace 2: Heavy Rain
    df_rain = df_chart[df_chart['is_heavy_rain'] == 1]
    if not df_rain.empty:
        traces.append({
            "x": df_rain['temp_max_f'].tolist(),
            "y": df_rain['daily_revenue'].tolist(),
            "text": df_rain.apply(lambda row: generate_tooltip(row, 'rain'), axis=1).tolist(),
            "hovertemplate": "%{text}<extra></extra>",
            "mode": "markers",
            "name": "Heavy Rain (High To-Go Volume)",
            "marker": {
                "size": [max(14, min(p * 2 + 10, 35)) for p in df_rain['precip_mm']],
                "color": "#3498db",
                "opacity": 0.9,
                "line": {
                    "width": [4 if d in top_3_dates else 1.5 for d in df_rain['date']],
                    "color": ["#0f172a" if d in top_3_dates else "white" for d in df_rain['date']]
                }
            }
        })
        
    # Trace 3: Extreme Heat
    df_heat = df_chart[(df_chart['is_extreme_heat'] == 1) & (df_chart['is_heavy_rain'] == 0)]
    if not df_heat.empty:
        traces.append({
            "x": df_heat['temp_max_f'].tolist(),
            "y": df_heat['daily_revenue'].tolist(),
            "text": df_heat.apply(lambda row: generate_tooltip(row, 'heat'), axis=1).tolist(),
            "hovertemplate": "%{text}<extra></extra>",
            "mode": "markers",
            "name": "Extreme Heat (High Curbside Volume)",
            "marker": {
                "size": [max(10, min(p * 2 + 10, 20)) for p in df_heat['precip_mm']],
                "color": "#e67e22",
                "opacity": 0.8,
                "line": {
                    "width": [4 if d in top_3_dates else 1.5 for d in df_heat['date']],
                    "color": ["#0f172a" if d in top_3_dates else "white" for d in df_heat['date']]
                }
            }
        })

    fig_data = traces

    fig_layout = {
        "title": "Weather vs. Sales: Actionable Operations Insight",
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(20,20,30,0.6)",
        "font": {"color": "#f8fafc", "family": "Outfit, sans-serif"},
        "xaxis": {
            "title": "Daily High Temperature (°F) — Determines Patio Seating & Walk-In Traffic",
            "gridcolor": "rgba(255,255,255,0.1)", 
            "zeroline": False
        },
        "yaxis": {
            "title": "Gross Daily Sales ($) — Target > $5,100 Baseline",
            "gridcolor": "rgba(255,255,255,0.1)", 
            "zeroline": False, 
            "rangemode": "tozero"
        },
        "showlegend": True,
        "legend": {"orientation": "h", "y": -0.25, "x": 0.5, "xanchor": "center"},
        "margin": {"l": 60, "r": 20, "t": 60, "b": 80},
        "hovermode": "closest",
        "hoverlabel": {"bgcolor": "rgba(15, 23, 42, 0.95)", "font": {"family": "Outfit, sans-serif"}},
        "shapes": [
            {
                "type": "line",
                "xref": "paper",
                "x0": 0,
                "x1": 1,
                "y0": normal_avg,
                "y1": normal_avg,
                "line": {
                    "color": "#94a3b8",
                    "width": 2,
                    "dash": "dash"
                }
            }
        ],
        "annotations": [
            {
                "xref": "paper",
                "x": 0.02,
                "y": normal_avg + 300,
                "text": f"Baseline Target (${normal_avg:,.0f})",
                "showarrow": False,
                "font": {"color": "#94a3b8", "size": 12},
                "xanchor": "left"
            }
        ]
    }

    payload = {"""

new_content, count = pattern.subn(replacement, content)
if count == 0:
    print("Failed to replace!")
else:
    with open('clover_api/analytics/weather_impact.py', 'w') as f:
        f.write(new_content)
    print("Success!")
