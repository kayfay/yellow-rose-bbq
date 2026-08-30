with open('app.js', 'r') as f:
    content = f.read()

target = """    categorySelector.addEventListener('change', () => {
      renderPlotlyForecastingChart(14);
    });"""

replacement = """    categorySelector.addEventListener('change', () => {
      document.querySelectorAll('.forecast-preset-group .preset-btn').forEach(b => b.classList.remove('active'));
      renderPlotlyForecastingChart(14);
    });"""

content = content.replace(target, replacement)

with open('app.js', 'w') as f:
    f.write(content)
print("dropdown visual state fixed.")
